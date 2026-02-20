/**
 * 🧠 Brain Module 3: Smart Actions Engine
 *
 * Prende decisioni intelligenti per ogni cliente basandosi su:
 * - Score dal Scoring Engine (churn_risk, engagement, consistency)
 * - Segnali dal Conversation Analyzer (motivation_level)
 * - Pattern comportamentali (preferred_days, preferred_time)
 *
 * Genera messaggi UNICI via AI (non template!) e li invia su WhatsApp.
 * Ogni azione viene loggata in brain_actions per tracciabilità.
 */

const scoring = require('./scoring');

// Configurazione AI (verrà impostata dall'init)
let aiClient = null;
let AI_MODEL = null;
let useAnthropic = false;

/**
 * Inizializza il modulo con il client AI
 */
function initAI(client, model, isAnthropic) {
  aiClient = client;
  AI_MODEL = model;
  useAnthropic = isAnthropic;
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
  console.log(`[Brain:Actions] --- Processing: ${tenant.name} ---`);

  // Recupera tutti gli scoring dei clienti
  const clientScores = await db.pool.query(`
    SELECT cs.*, cp.name, cp.fitness_goals, cp.fitness_level,
      cp.conversation_summary, cp.key_facts, cp.injuries,
      cp.preferred_activities
    FROM client_scoring cs
    LEFT JOIN client_profiles cp ON cp.tenant_id = cs.tenant_id AND cp.phone = cs.phone
    WHERE cs.tenant_id = $1
  `, [tenant.id]);

  let actionsCreated = 0;

  for (const client of clientScores.rows) {
    try {
      const action = await decideAction(tenant, client, db);
      if (action) {
        const sent = await executeAction(tenant, client, action, db, sendWhatsAppMessage);
        if (sent) actionsCreated++;
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
 * Ritorna null se nessuna azione è necessaria
 */
async function decideAction(tenant, client, db) {
  const churnRisk = parseFloat(client.churn_risk);
  const engagementScore = parseFloat(client.engagement_score);
  const consistencyScore = parseFloat(client.consistency_score);
  const daysSinceCheckin = parseInt(client.days_since_last_checkin) || 0;
  const motivation = client.motivation_level || 'medium';
  const trend = client.checkin_trend || 'stable';
  const today = new Date().toISOString().split('T')[0];

  // ===== REGOLA 1: Alto rischio churn + inattivo =====
  if (churnRisk >= 0.7 && daysSinceCheckin >= 5) {
    const actionKey = `comeback:${client.phone}:${today}`;
    if (await wasAlreadySent(actionKey, db)) return null;

    return {
      action_type: 'comeback_message',
      reason: `churn_risk=${churnRisk}, inattivo ${daysSinceCheckin}gg, motivation=${motivation}`,
      action_key: actionKey,
      aiPrompt: buildAIPrompt('comeback', tenant, client)
    };
  }

  // ===== REGOLA 2: Rischio medio + trend in calo =====
  if (churnRisk >= 0.5 && trend === 'down') {
    const actionKey = `motivation:${client.phone}:${today}`;
    if (await wasAlreadySent(actionKey, db)) return null;

    return {
      action_type: 'personalized_motivation',
      reason: `churn_risk=${churnRisk}, trend=down, engagement=${engagementScore}`,
      action_key: actionKey,
      aiPrompt: buildAIPrompt('motivation', tenant, client)
    };
  }

  // ===== REGOLA 3: Motivazione bassa dopo frustrazione =====
  if (motivation === 'low' && daysSinceCheckin <= 7) {
    const actionKey = `support:${client.phone}:${today}`;
    if (await wasAlreadySent(actionKey, db)) return null;

    return {
      action_type: 'scheda_adjust',
      reason: `motivation=low, ancora attivo (${daysSinceCheckin}gg), potrebbe mollare`,
      action_key: actionKey,
      aiPrompt: buildAIPrompt('support', tenant, client)
    };
  }

  // ===== REGOLA 4: Cliente attivo + buona consistenza → check progress =====
  if (engagementScore >= 0.6 && consistencyScore >= 0.5 && (parseInt(client.total_checkins_30d) || 0) >= 8) {
    // Controlla se non abbiamo già chiesto feedback negli ultimi 14 giorni
    const recentCheck = await db.pool.query(`
      SELECT id FROM brain_actions
      WHERE tenant_id = $1 AND phone = $2 AND action_type = 'check_progress'
      AND created_at > NOW() - INTERVAL '14 days' AND status = 'sent'
    `, [tenant.id, client.phone]);

    if (recentCheck.rows.length === 0) {
      const actionKey = `progress:${client.phone}:${today}`;
      return {
        action_type: 'check_progress',
        reason: `engagement=${engagementScore}, consistency=${consistencyScore}, ${client.total_checkins_30d} checkins/30d`,
        action_key: actionKey,
        aiPrompt: buildAIPrompt('progress', tenant, client)
      };
    }
  }

  // ===== REGOLA 5: Streak interrotta dopo 7+ giorni consecutivi =====
  if (daysSinceCheckin >= 2 && daysSinceCheckin <= 5 && consistencyScore >= 0.7) {
    const actionKey = `streak:${client.phone}:${today}`;
    if (await wasAlreadySent(actionKey, db)) return null;

    return {
      action_type: 'streak_recovery',
      reason: `consistency alta (${consistencyScore}) ma mancato ${daysSinceCheckin}gg — possibile streak interrotta`,
      action_key: actionKey,
      aiPrompt: buildAIPrompt('streak', tenant, client)
    };
  }

  return null; // Nessuna azione necessaria
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

Scrivi SOLO il messaggio, niente altro.`
  };

  return prompts[type] || prompts.motivation;
}

/**
 * Genera il messaggio via AI e invialo su WhatsApp
 */
async function executeAction(tenant, client, action, db, sendWhatsAppMessage) {
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

    // 3. Invia su WhatsApp
    try {
      await sendWhatsAppMessage(tenant.whatsapp_instance_name, client.phone, messageContent);
    } catch (sendErr) {
      // Invio fallito — segna come failed, NON salvare come messaggio
      console.error(`[Brain:Actions] ❌ Invio WhatsApp fallito per ${client.phone}:`, sendErr.message);
      await db.pool.query(`
        UPDATE brain_actions SET status = 'failed', skip_reason = $3
        WHERE action_key = $1 AND tenant_id = $2
      `, [action.action_key, tenant.id, sendErr.message]).catch(e => console.error('[Brain:Actions] DB update error:', e.message));
      return false;
    }

    // 4. Aggiorna stato a 'sent' (solo se invio riuscito)
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

    // Rate limiting: aspetta 3 secondi tra messaggi
    await sleep(3000);

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
  processAllTenants,
  processActionsForTenant,
  getRecentActions,
  getActionStats
};
