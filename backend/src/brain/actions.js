/**
 * 🧠 Brain Module 3: Smart Actions Engine
 *
 * Prende decisioni intelligenti per ogni cliente basandosi su:
 * - Score dal Scoring Engine (churn_risk, engagement, consistency)
 * - Segnali dal Conversation Analyzer (motivation_level)
 * - Pattern comportamentali (preferred_days, preferred_time)
 * - Settings configurabili per tenant (brain_settings)
 *
 * Genera messaggi UNICI via AI (non template!) e li invia su WhatsApp.
 * Ogni azione viene loggata in brain_actions per tracciabilità.
 */

const scoring = require('./scoring');

// Configurazione AI (verrà impostata dall'init)
let aiClient = null;
let AI_MODEL = null;
let useAnthropic = false;

// Funzione di invio WhatsApp (verrà impostata dall'init)
let enqueueMessage = null;

// Default settings (usati se non ci sono settings per il tenant)
const DEFAULT_SETTINGS = {
  brain_enabled: true,
  max_messages_per_day: 10,
  max_messages_per_client_per_week: 3,
  min_hours_between_messages: 24,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  churn_threshold_high: 0.70,
  churn_threshold_medium: 0.50,
  inactivity_days_high: 14,
  inactivity_days_support_max: 7,
  streak_recovery_min_days: 3,
  streak_recovery_max_days: 7,
  engagement_threshold: 0.50,
  consistency_threshold_progress: 0.50,
  consistency_threshold_streak: 0.50,
  min_checkins_for_progress: 6,
  check_progress_interval_days: 14,
  delay_between_messages_ms: 3000
};

/**
 * Inizializza il modulo con il client AI e la funzione di invio
 */
function initAI(client, model, isAnthropic, enqueueFn) {
  aiClient = client;
  AI_MODEL = model;
  useAnthropic = isAnthropic;
  if (enqueueFn) enqueueMessage = enqueueFn;
}

/**
 * Carica i settings per un tenant dal DB, con fallback ai default
 */
async function getSettings(tenantId, db) {
  try {
    const result = await db.pool.query(
      'SELECT * FROM brain_settings WHERE tenant_id = $1',
      [tenantId]
    );
    if (result.rows.length > 0) {
      // Merge con default per coprire eventuali colonne nuove non ancora migrate
      return { ...DEFAULT_SETTINGS, ...result.rows[0] };
    }
  } catch (err) {
    // Tabella potrebbe non esistere ancora (prima della migration)
    console.log('[Brain:Actions] brain_settings non trovato, uso defaults');
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Controlla se siamo in orario silenzioso
 */
function isQuietHour(settings) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startH, startM] = settings.quiet_hours_start.split(':').map(Number);
  const [endH, endM] = settings.quiet_hours_end.split(':').map(Number);
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;

  // Gestisci range che attraversa la mezzanotte (es. 22:00 - 07:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }
  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Controlla il limite giornaliero di messaggi per tenant
 */
async function getDailyMessageCount(tenantId, db) {
  const result = await db.pool.query(`
    SELECT COUNT(*) as count FROM brain_actions
    WHERE tenant_id = $1 AND status = 'sent'
    AND created_at > NOW() - INTERVAL '24 hours'
  `, [tenantId]);
  return parseInt(result.rows[0].count) || 0;
}

/**
 * Controlla il limite settimanale di messaggi per un singolo cliente
 */
async function getWeeklyClientMessageCount(tenantId, phone, db) {
  const result = await db.pool.query(`
    SELECT COUNT(*) as count FROM brain_actions
    WHERE tenant_id = $1 AND phone = $2 AND status = 'sent'
    AND created_at > NOW() - INTERVAL '7 days'
  `, [tenantId, phone]);
  return parseInt(result.rows[0].count) || 0;
}

/**
 * Controlla l'ultimo messaggio inviato a un cliente
 */
async function getHoursSinceLastMessage(tenantId, phone, db) {
  const result = await db.pool.query(`
    SELECT sent_at FROM brain_actions
    WHERE tenant_id = $1 AND phone = $2 AND status = 'sent'
    ORDER BY sent_at DESC LIMIT 1
  `, [tenantId, phone]);
  if (result.rows.length === 0) return 9999;
  const lastSent = new Date(result.rows[0].sent_at);
  return (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
}

/**
 * Processa le smart actions per tutti i tenant
 */
async function processAllTenants(db, sendWhatsAppMessage) {
  const startTime = Date.now();
  console.log('[Brain:Actions] ====== Inizio ciclo Smart Actions ======');

  try {
    const tenantsResult = await db.pool.query(`
      SELECT * FROM tenants WHERE whatsapp_connected = true AND whatsapp_instance_name IS NOT NULL
    `);
    const tenants = tenantsResult.rows;

    let totalActions = 0;
    for (const tenant of tenants) {
      try {
        const actions = await processActionsForTenant(tenant, db, sendWhatsAppMessage);
        totalActions += actions;
      } catch (err) {
        console.error(`[Brain:Actions] Errore tenant ${tenant.name}:`, err.message);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Brain:Actions] ====== Ciclo completato: ${totalActions} azioni in ${duration}s ======`);
    return totalActions;

  } catch (error) {
    console.error('[Brain:Actions] ❌ Errore critico:', error.message);
    return 0;
  }
}

/**
 * Processa le smart actions per un singolo tenant
 */
async function processActionsForTenant(tenant, db, sendWhatsAppMessage) {
  // Carica settings per questo tenant
  const settings = await getSettings(tenant.id, db);

  // Check: Brain abilitato?
  if (!settings.brain_enabled) {
    console.log(`[Brain:Actions] ${tenant.name}: Brain DISABILITATO, skip`);
    return 0;
  }

  // Check: Siamo in orario silenzioso?
  if (isQuietHour(settings)) {
    console.log(`[Brain:Actions] ${tenant.name}: Orario silenzioso (${settings.quiet_hours_start}-${settings.quiet_hours_end}), skip`);
    return 0;
  }

  // Check: Limite giornaliero raggiunto?
  const dailyCount = await getDailyMessageCount(tenant.id, db);
  if (dailyCount >= settings.max_messages_per_day) {
    console.log(`[Brain:Actions] ${tenant.name}: Limite giornaliero raggiunto (${dailyCount}/${settings.max_messages_per_day}), skip`);
    return 0;
  }

  console.log(`[Brain:Actions] --- Processing: ${tenant.name} (${dailyCount}/${settings.max_messages_per_day} msg oggi) ---`);

  // Recupera tutti gli scoring dei clienti
  const clientScores = await db.pool.query(`
    SELECT cs.*, cp.name, cp.fitness_goals, cp.fitness_level,
      cp.conversation_summary, cp.key_facts, cp.injuries,
      cp.preferred_activities, cp.member_since
    FROM client_scoring cs
    LEFT JOIN client_profiles cp ON cp.tenant_id = cs.tenant_id AND cp.phone = cs.phone
    WHERE cs.tenant_id = $1
  `, [tenant.id]);

  let actionsCreated = 0;
  let currentDailyCount = dailyCount;

  for (const client of clientScores.rows) {
    // Re-check limite giornaliero durante il ciclo
    if (currentDailyCount >= settings.max_messages_per_day) {
      console.log(`[Brain:Actions] ${tenant.name}: Limite giornaliero raggiunto durante ciclo, stop`);
      break;
    }

    try {
      // Check limiti per-client prima di decidere l'azione
      const weeklyCount = await getWeeklyClientMessageCount(tenant.id, client.phone, db);
      if (weeklyCount >= settings.max_messages_per_client_per_week) {
        continue; // Skip silenzioso - troppi messaggi questa settimana
      }

      const hoursSinceLastMsg = await getHoursSinceLastMessage(tenant.id, client.phone, db);
      if (hoursSinceLastMsg < settings.min_hours_between_messages) {
        continue; // Skip - troppo presto dall'ultimo messaggio
      }

      const action = await decideAction(tenant, client, db, settings);
      if (action) {
        const sent = await executeAction(tenant, client, action, db, sendWhatsAppMessage, settings);
        if (sent) {
          actionsCreated++;
          currentDailyCount++;
        }
      }
    } catch (err) {
      console.error(`[Brain:Actions] Errore per ${client.phone}:`, err.message);
    }
  }

  console.log(`[Brain:Actions] ${tenant.name}: ${actionsCreated} azioni eseguite`);
  return actionsCreated;
}

/**
 * Decide quale azione intraprendere per un cliente
 * Usa logica score-based: valuta TUTTE le regole applicabili,
 * assegna priorità e sceglie la migliore.
 * Ritorna null se nessuna azione è necessaria.
 */
async function decideAction(tenant, client, db, settings) {
  const churnRisk = parseFloat(client.churn_risk) || 0;
  const engagementScore = parseFloat(client.engagement_score) || 0;
  const consistencyScore = parseFloat(client.consistency_score) || 0;
  const daysSinceCheckin = parseInt(client.days_since_last_checkin) || 0;
  const motivation = client.motivation_level || 'medium';
  const trend = client.checkin_trend || 'stable';
  const today = new Date().toISOString().split('T')[0];
  const totalCheckins30d = parseInt(client.total_checkins_30d) || 0;

  // Raccogli tutte le azioni candidate con la loro priorità
  const candidates = [];

  // ===== REGOLA 1: Comeback — inattivo da molto tempo =====
  if (churnRisk >= parseFloat(settings.churn_threshold_high) &&
      daysSinceCheckin >= settings.inactivity_days_high) {
    candidates.push({
      action_type: 'comeback_message',
      priority: 90 + Math.min(daysSinceCheckin, 30), // Più inattivo = più urgente
      reason: `churn_risk=${churnRisk}, inattivo ${daysSinceCheckin}gg, motivation=${motivation}`,
      actionKeyPrefix: 'comeback',
      promptType: 'comeback'
    });
  }

  // ===== REGOLA 2: Streak recovery — mancato pochi giorni ma era costante =====
  if (daysSinceCheckin >= settings.streak_recovery_min_days &&
      daysSinceCheckin <= settings.streak_recovery_max_days &&
      consistencyScore >= parseFloat(settings.consistency_threshold_streak)) {
    candidates.push({
      action_type: 'streak_recovery',
      priority: 80 + Math.round(consistencyScore * 10), // Alta consistency = più priorità
      reason: `consistency=${consistencyScore}, mancato ${daysSinceCheckin}gg — streak interrotta`,
      actionKeyPrefix: 'streak',
      promptType: 'streak'
    });
  }

  // ===== REGOLA 3: Motivazione personalizzata — trend in calo o motivazione bassa =====
  if ((churnRisk >= parseFloat(settings.churn_threshold_medium) && trend === 'down') ||
      (motivation === 'low' && engagementScore > 0.2)) {
    candidates.push({
      action_type: 'personalized_motivation',
      priority: 70 + Math.round(churnRisk * 20),
      reason: `churn_risk=${churnRisk}, trend=${trend}, motivation=${motivation}, engagement=${engagementScore}`,
      actionKeyPrefix: 'motivation',
      promptType: 'motivation'
    });
  }

  // ===== REGOLA 4: Supporto — motivazione bassa, ancora attivo =====
  if (motivation === 'low' && daysSinceCheckin <= settings.inactivity_days_support_max) {
    candidates.push({
      action_type: 'scheda_adjust',
      priority: 75,
      reason: `motivation=low, ancora attivo (${daysSinceCheckin}gg), potrebbe mollare`,
      actionKeyPrefix: 'support',
      promptType: 'support'
    });
  }

  // ===== REGOLA 5: Check progress — cliente attivo e costante =====
  if (engagementScore >= parseFloat(settings.engagement_threshold) &&
      consistencyScore >= parseFloat(settings.consistency_threshold_progress) &&
      totalCheckins30d >= settings.min_checkins_for_progress) {
    // Controlla se non abbiamo già chiesto feedback di recente
    const recentCheck = await db.pool.query(`
      SELECT id FROM brain_actions
      WHERE tenant_id = $1 AND phone = $2 AND action_type = 'check_progress'
      AND created_at > NOW() - INTERVAL '1 day' * $3 AND status = 'sent'
    `, [tenant.id, client.phone, settings.check_progress_interval_days]);

    if (recentCheck.rows.length === 0) {
      candidates.push({
        action_type: 'check_progress',
        priority: 50 + Math.round(engagementScore * 20),
        reason: `engagement=${engagementScore}, consistency=${consistencyScore}, ${totalCheckins30d} checkins/30d`,
        actionKeyPrefix: 'progress',
        promptType: 'progress'
      });
    }
  }

  // ===== REGOLA 6: Welcome — nuovo cliente senza azioni Brain precedenti =====
  const memberSince = client.member_since ? new Date(client.member_since) : null;
  if (memberSince) {
    const daysSinceJoin = Math.floor((Date.now() - memberSince.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceJoin <= 14) {
      const prevActions = await db.pool.query(`
        SELECT id FROM brain_actions
        WHERE tenant_id = $1 AND phone = $2 AND status = 'sent' LIMIT 1
      `, [tenant.id, client.phone]);

      if (prevActions.rows.length === 0) {
        candidates.push({
          action_type: 'welcome_message',
          priority: 100, // Alta priorità per nuovi clienti
          reason: `nuovo cliente (${daysSinceJoin}gg fa), nessuna azione Brain precedente`,
          actionKeyPrefix: 'welcome',
          promptType: 'welcome'
        });
      }
    }
  }

  // Se non ci sono candidati, nessuna azione
  if (candidates.length === 0) return null;

  // Ordina per priorità decrescente e prova il migliore
  candidates.sort((a, b) => b.priority - a.priority);

  for (const candidate of candidates) {
    const actionKey = `${candidate.actionKeyPrefix}:${client.phone}:${today}`;
    if (await wasAlreadySent(actionKey, db)) continue;

    return {
      action_type: candidate.action_type,
      reason: candidate.reason,
      action_key: actionKey,
      aiPrompt: buildAIPrompt(candidate.promptType, tenant, client)
    };
  }

  return null; // Tutte le azioni candidate erano già state inviate oggi
}

/**
 * Costruisci il prompt AI per generare un messaggio personalizzato
 */
function buildAIPrompt(type, tenant, client) {
  const clientInfo = `
Cliente: ${client.name || 'sconosciuto'}
Obiettivi: ${client.fitness_goals || 'non specificati'}
Livello: ${client.fitness_level || 'non specificato'}
Infortuni/limitazioni: ${client.injuries || 'nessuno'}
Attività preferite: ${client.preferred_activities || 'non specificate'}
Giorni inattivo: ${client.days_since_last_checkin || 0}
Check-in medi/settimana: ${client.avg_checkins_per_week || 0}
Motivazione attuale: ${client.motivation_level || 'medium'}
Fatti importanti: ${client.key_facts || 'nessuno'}
`.trim();

  const prompts = {
    comeback: `Sei il coach virtuale della palestra "${tenant.name}". Devi scrivere un messaggio WhatsApp BREVE (max 3 frasi) per riavvicinare un cliente che non viene da un po'.

${clientInfo}

REGOLE:
- Sii empatico, NON accusatorio ("ci manchi" non "perché non vieni?")
- Cita qualcosa di specifico del cliente (obiettivi, attività preferite)
- Chiudi con una domanda aperta o proposta concreta
- Usa 1-2 emoji max, tono amichevole
- NON mettere il nome della palestra, solo il messaggio

Scrivi SOLO il messaggio, niente altro.`,

    motivation: `Sei il coach virtuale della palestra "${tenant.name}". Devi scrivere un messaggio WhatsApp motivazionale BREVE (max 3 frasi) personalizzato.

${clientInfo}

REGOLE:
- Cita gli obiettivi specifici del cliente
- Riconosci lo sforzo fatto finora
- Dai una spinta motivazionale concreta
- Usa 1-2 emoji max, tono energico ma non forzato
- NON mettere il nome della palestra

Scrivi SOLO il messaggio, niente altro.`,

    support: `Sei il coach virtuale della palestra "${tenant.name}". Il cliente sembra frustrato o demotivato. Devi scrivere un messaggio WhatsApp di SUPPORTO BREVE (max 3 frasi).

${clientInfo}

REGOLE:
- Mostra comprensione e empatia
- Se ha infortuni/dolori, suggerisci delicatamente una modifica
- Proponi un'alternativa concreta (esercizio più leggero, giorno di riposo)
- Tono caldo e rassicurante
- NON mettere il nome della palestra

Scrivi SOLO il messaggio, niente altro.`,

    progress: `Sei il coach virtuale della palestra "${tenant.name}". Il cliente sta andando bene! Devi scrivere un messaggio WhatsApp per chiedere feedback sulla scheda attuale (max 2 frasi).

${clientInfo}

REGOLE:
- Complimentati per la costanza
- Chiedi come si trova con la scheda (troppo facile/difficile?)
- Tono positivo e professionale
- NON mettere il nome della palestra

Scrivi SOLO il messaggio, niente altro.`,

    streak: `Sei il coach virtuale della palestra "${tenant.name}". Il cliente era molto costante ma ha saltato qualche giorno. Devi scrivere un messaggio BREVE (max 2 frasi) per motivarlo a riprendere.

${clientInfo}

REGOLE:
- Riconosci la costanza precedente
- Invita gentilmente a riprendere senza pressione
- Tono leggero e incoraggiante
- NON mettere il nome della palestra

Scrivi SOLO il messaggio, niente altro.`,

    welcome: `Sei il coach virtuale della palestra "${tenant.name}". Devi scrivere un messaggio di BENVENUTO WhatsApp BREVE (max 3 frasi) per un nuovo iscritto.

${clientInfo}

REGOLE:
- Presentati come il coach AI della palestra
- Spiega brevemente che sei lì per aiutarlo (check-in, motivazione, schede)
- Chiedi come si trova e quali sono i suoi obiettivi
- Tono caloroso e accogliente
- Usa 1-2 emoji max
- NON mettere il nome della palestra

Scrivi SOLO il messaggio, niente altro.`
  };

  return prompts[type] || prompts.motivation;
}

/**
 * Genera il messaggio via AI e invialo su WhatsApp
 */
async function executeAction(tenant, client, action, db, sendWhatsAppMessage, settings) {
  try {
    // 1. Genera messaggio con AI
    let messageContent;

    if (aiClient) {
      try {
        if (useAnthropic) {
          const completion = await aiClient.messages.create({
            model: AI_MODEL,
            max_tokens: 200,
            system: 'Sei un assistente che scrive messaggi WhatsApp per palestre. Scrivi SOLO il messaggio, niente altro.',
            messages: [{ role: 'user', content: action.aiPrompt }]
          });
          messageContent = completion.content[0]?.text;
        } else {
          const completion = await aiClient.chat.completions.create({
            model: AI_MODEL,
            messages: [
              { role: 'system', content: 'Sei un assistente che scrive messaggi WhatsApp per palestre. Scrivi SOLO il messaggio, niente altro.' },
              { role: 'user', content: action.aiPrompt }
            ],
            max_tokens: 200,
            temperature: 0.8
          });
          messageContent = completion.choices[0]?.message?.content;
        }
      } catch (aiErr) {
        console.error(`[Brain:Actions] Errore AI:`, aiErr.message);
        messageContent = null;
      }
    }

    // Fallback se AI non disponibile
    if (!messageContent) {
      messageContent = getFallbackMessage(action.action_type, client, tenant);
    }

    // Pulisci il messaggio (rimuovi virgolette, spazi extra)
    messageContent = messageContent.replace(/^["']|["']$/g, '').trim();

    // 2. Salva l'azione nel DB
    await db.pool.query(`
      INSERT INTO brain_actions (tenant_id, phone, action_type, reason, trigger_conditions, message_content, status, action_key)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
    `, [
      tenant.id, client.phone, action.action_type, action.reason,
      JSON.stringify({ churn_risk: client.churn_risk, engagement: client.engagement_score, motivation: client.motivation_level }),
      messageContent, action.action_key
    ]);

    // 3. Invia su WhatsApp (via BullMQ se disponibile, altrimenti diretto)
    try {
      if (enqueueMessage) {
        // Usa BullMQ: retry automatici, timeout, rate limiting
        const result = await enqueueMessage(tenant.id, tenant.whatsapp_instance_name, client.phone, messageContent);
        if (!result.success) {
          throw new Error(result.error || 'Errore coda BullMQ');
        }
      } else {
        // Fallback: invio diretto
        await sendWhatsAppMessage(tenant.whatsapp_instance_name, client.phone, messageContent);
      }
    } catch (sendErr) {
      // Invio fallito — segna come failed, NON salvare come messaggio
      console.error(`[Brain:Actions] ❌ Invio WhatsApp fallito per ${client.phone}:`, sendErr.message);
      await db.pool.query(`
        UPDATE brain_actions SET status = 'failed', skip_reason = $3
        WHERE action_key = $1 AND tenant_id = $2
      `, [action.action_key, tenant.id, sendErr.message]).catch(e => console.error('[Brain:Actions] DB update error:', e.message));
      return false;
    }

    // 4. Aggiorna stato a 'sent' (BullMQ gestisce retry in background)
    await db.pool.query(`
      UPDATE brain_actions SET status = 'sent', sent_at = NOW()
      WHERE action_key = $1 AND tenant_id = $2
    `, [action.action_key, tenant.id]);

    // 5. Salva anche come messaggio nella conversazione
    await db.addMessage(tenant.id, client.phone, 'assistant', messageContent, {
      isBrainAction: true,
      actionType: action.action_type
    });

    console.log(`[Brain:Actions] ✅ ${action.action_type} → ${client.phone} (${client.name || 'N/A'})`);

    // Rate limiting configurabile
    const delay = settings?.delay_between_messages_ms || DEFAULT_SETTINGS.delay_between_messages_ms;
    await sleep(delay);

    return true;

  } catch (error) {
    console.error(`[Brain:Actions] ❌ Errore esecuzione ${action.action_type} per ${client.phone}:`, error.message);

    // Log fallimento
    await db.pool.query(`
      UPDATE brain_actions SET status = 'failed', skip_reason = $3
      WHERE action_key = $1 AND tenant_id = $2
    `, [action.action_key, tenant.id, error.message]).catch(e => console.error('[Brain:Actions] DB update error:', e.message));

    return false;
  }
}

/**
 * Messaggi di fallback se l'AI non è disponibile
 */
function getFallbackMessage(actionType, client, tenant) {
  const name = client.name || '';
  const greeting = name ? `Ciao ${name}!` : 'Ciao!';

  const fallbacks = {
    comeback_message: `${greeting} 😊 È un po' che non ti vediamo! Come stai? Quando ti va, passa a trovarci — il tuo percorso ti aspetta! 💪`,
    personalized_motivation: `${greeting} 💪 Stai facendo un ottimo lavoro con i tuoi allenamenti. Ricorda che ogni sessione ti avvicina al tuo obiettivo. Non mollare! 🔥`,
    scheda_adjust: `${greeting} 🤝 Come ti trovi con la scheda attuale? Se qualche esercizio ti dà problemi, possiamo adattarla per renderla più adatta a te.`,
    check_progress: `${greeting} 📊 Stai andando alla grande con la costanza! Come ti senti con la scheda? Troppo facile, troppo difficile, o va bene così?`,
    streak_recovery: `${greeting} 🏋️ Eri in una serie fantastica! Pronto a riprendere? Anche una sessione leggera conta!`,
    welcome_message: `${greeting} 👋 Benvenuto! Sono il tuo coach AI, sono qui per aiutarti nel tuo percorso fitness. Raccontami i tuoi obiettivi!`,
    celebration: `${greeting} 🎉 Complimenti per la tua dedizione! Stai facendo progressi incredibili, continua così!`
  };

  return fallbacks[actionType] || fallbacks.personalized_motivation;
}

/**
 * Controlla se un'azione è già stata inviata (anti-duplicato)
 */
async function wasAlreadySent(actionKey, db) {
  const result = await db.pool.query(`
    SELECT id FROM brain_actions WHERE action_key = $1 AND status = 'sent'
  `, [actionKey]);
  return result.rows.length > 0;
}

/**
 * Recupera le azioni recenti per il dashboard
 */
async function getRecentActions(tenantId, db, limit = 50) {
  const result = await db.pool.query(`
    SELECT ba.*, cp.name
    FROM brain_actions ba
    LEFT JOIN client_profiles cp ON cp.tenant_id = ba.tenant_id AND cp.phone = ba.phone
    WHERE ba.tenant_id = $1
    ORDER BY ba.created_at DESC
    LIMIT $2
  `, [tenantId, limit]);
  return result.rows;
}

/**
 * Recupera statistiche azioni per il dashboard
 */
async function getActionStats(tenantId, db, days = 30) {
  const result = await db.pool.query(`
    SELECT
      action_type,
      status,
      COUNT(*) as count
    FROM brain_actions
    WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
    GROUP BY action_type, status
    ORDER BY count DESC
  `, [tenantId, days]);
  return result.rows;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  initAI,
  getSettings,
  processAllTenants,
  processActionsForTenant,
  getRecentActions,
  getActionStats,
  DEFAULT_SETTINGS
};
