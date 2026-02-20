/**
 * 🧠 Brain Module 1: Client Scoring Engine
 *
 * Analizza i pattern comportamentali di ogni cliente e calcola:
 * - churn_risk: probabilità di abbandono (0.0 = safe, 1.0 = drop-out)
 * - engagement_score: livello di engagement recente
 * - consistency_score: regolarità degli allenamenti
 * - preferred_days/time: quando il cliente si allena di solito
 * - checkin_trend: trend up/stable/down
 */

/**
 * Calcola lo scoring per tutti i clienti di un tenant
 */
async function scoreAllClients(tenantId, db) {
  const startTime = Date.now();
  console.log(`[Brain:Scoring] Avvio scoring per tenant ${tenantId}`);

  try {
    // Recupera tutti i clienti con almeno 1 check-in
    const clientsResult = await db.pool.query(`
      SELECT DISTINCT c.phone, c.name,
        cp.fitness_goals, cp.fitness_level, cp.total_messages, cp.total_checkins,
        cp.member_since, cp.conversation_summary,
        cs.motivation_level, cs.churn_risk as prev_churn_risk
      FROM clients c
      LEFT JOIN client_profiles cp ON cp.tenant_id = c.tenant_id AND cp.phone = c.phone
      LEFT JOIN client_scoring cs ON cs.tenant_id = c.tenant_id AND cs.phone = c.phone
      WHERE c.tenant_id = $1
    `, [tenantId]);

    const clients = clientsResult.rows;
    console.log(`[Brain:Scoring] Trovati ${clients.length} clienti da analizzare`);

    let scored = 0;
    for (const client of clients) {
      try {
        const score = await scoreClient(tenantId, client.phone, db);
        if (score) scored++;
      } catch (err) {
        console.error(`[Brain:Scoring] Errore scoring ${client.phone}:`, err.message);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Brain:Scoring] ✅ Scoring completato: ${scored}/${clients.length} clienti in ${duration}s`);
    return { scored, total: clients.length };

  } catch (error) {
    console.error(`[Brain:Scoring] ❌ Errore critico:`, error.message);
    return { scored: 0, total: 0, error: error.message };
  }
}

/**
 * Calcola lo scoring per un singolo cliente
 */
async function scoreClient(tenantId, phone, db) {
  // 1. Recupera check-in degli ultimi 60 giorni
  const checkinsResult = await db.pool.query(`
    SELECT created_at, workout_day
    FROM checkins
    WHERE tenant_id = $1 AND phone = $2 AND created_at > NOW() - INTERVAL '60 days'
    ORDER BY created_at DESC
  `, [tenantId, phone]);

  const checkins = checkinsResult.rows;

  // 2. Recupera messaggi degli ultimi 30 giorni
  const messagesResult = await db.pool.query(`
    SELECT created_at, role
    FROM messages
    WHERE tenant_id = $1 AND phone = $2 AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY created_at DESC
  `, [tenantId, phone]);

  const messages = messagesResult.rows;
  const userMessages = messages.filter(m => m.role === 'user');

  // 3. Recupera scoring precedente (per motivation_level)
  const prevScoring = await db.pool.query(`
    SELECT motivation_level FROM client_scoring WHERE tenant_id = $1 AND phone = $2
  `, [tenantId, phone]);
  const motivationLevel = prevScoring.rows[0]?.motivation_level || 'medium';

  // 4. Calcola metriche
  const now = new Date();

  // --- Giorni dall'ultimo check-in ---
  const lastCheckin = checkins.length > 0 ? new Date(checkins[0].created_at) : null;
  const daysSinceLastCheckin = lastCheckin
    ? Math.floor((now - lastCheckin) / (1000 * 60 * 60 * 24))
    : 999;

  // --- Check-in ultimi 30 giorni ---
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const checkins30d = checkins.filter(c => new Date(c.created_at) > thirtyDaysAgo);
  const totalCheckins30d = checkins30d.length;
  const avgCheckinsPerWeek = Math.round((totalCheckins30d / 4.3) * 10) / 10;

  // --- Trend settimanale (ultime 4 settimane) ---
  const weeklyHistory = [];
  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(now - (w + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now - w * 7 * 24 * 60 * 60 * 1000);
    const count = checkins.filter(c => {
      const d = new Date(c.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeklyHistory.unshift(count); // [settimana -4, -3, -2, -1]
  }

  let checkinTrend = 'stable';
  if (weeklyHistory.length >= 2) {
    const recent = weeklyHistory[3] + weeklyHistory[2];
    const older = weeklyHistory[1] + weeklyHistory[0];
    if (recent > older * 1.3) checkinTrend = 'up';
    else if (recent < older * 0.7) checkinTrend = 'down';
  }

  // --- Giorni e orari preferiti ---
  const dayCount = {};
  const hourCount = {};
  for (const c of checkins) {
    const d = new Date(c.created_at);
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
    const hour = d.getHours();
    dayCount[dayName] = (dayCount[dayName] || 0) + 1;
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  }

  const preferredDays = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);

  const preferredHour = Object.entries(hourCount)
    .sort((a, b) => b[1] - a[1])[0];
  const preferredTime = preferredHour ? `${String(preferredHour[0]).padStart(2, '0')}:00` : null;

  // --- CONSISTENCY SCORE (0.0 - 1.0) ---
  // Basato sulla regolarità: poca deviazione tra intervalli = alta consistenza
  let consistencyScore = 0.5;
  if (checkins.length >= 3) {
    const intervals = [];
    for (let i = 0; i < checkins.length - 1; i++) {
      const diff = (new Date(checkins[i].created_at) - new Date(checkins[i + 1].created_at)) / (1000 * 60 * 60 * 24);
      intervals.push(diff);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    // Bassa deviazione = alta consistenza
    consistencyScore = Math.max(0, Math.min(1, 1 - (stdDev / (avgInterval + 1))));
  } else if (checkins.length > 0) {
    consistencyScore = 0.3; // Pochi dati
  } else {
    consistencyScore = 0.1; // Nessun check-in
  }

  // --- ENGAGEMENT SCORE (0.0 - 1.0) ---
  // Combina: messaggi recenti + check-in recenti + frequenza interazione
  const msgScore = Math.min(1, userMessages.length / 20); // 20+ messaggi = max
  const checkinScore = Math.min(1, totalCheckins30d / 12); // 12+ checkin/mese = max
  const recencyScore = daysSinceLastCheckin <= 3 ? 1.0
    : daysSinceLastCheckin <= 7 ? 0.7
    : daysSinceLastCheckin <= 14 ? 0.4
    : daysSinceLastCheckin <= 30 ? 0.2
    : 0.05;

  const engagementScore = Math.round((msgScore * 0.2 + checkinScore * 0.4 + recencyScore * 0.4) * 100) / 100;

  // --- CHURN RISK (0.0 - 1.0) ---
  let churnRisk = 0.1; // Base: basso rischio

  // Fattore 1: Inattività (peso 0.35)
  if (daysSinceLastCheckin > 30) churnRisk += 0.35;
  else if (daysSinceLastCheckin > 14) churnRisk += 0.25;
  else if (daysSinceLastCheckin > 7) churnRisk += 0.15;
  else if (daysSinceLastCheckin > 3) churnRisk += 0.05;

  // Fattore 2: Trend in calo (peso 0.25)
  if (checkinTrend === 'down') churnRisk += 0.25;
  else if (checkinTrend === 'stable' && avgCheckinsPerWeek < 1) churnRisk += 0.10;

  // Fattore 3: Motivazione bassa (peso 0.20)
  if (motivationLevel === 'low') churnRisk += 0.20;
  else if (motivationLevel === 'medium') churnRisk += 0.05;

  // Fattore 4: Nessun messaggio recente (peso 0.10)
  const daysSinceLastMessage = userMessages.length > 0
    ? Math.floor((now - new Date(userMessages[0].created_at)) / (1000 * 60 * 60 * 24))
    : 999;
  if (daysSinceLastMessage > 14) churnRisk += 0.10;
  else if (daysSinceLastMessage > 7) churnRisk += 0.05;

  // Fattore 5: Bassa consistenza (peso 0.10)
  if (consistencyScore < 0.3) churnRisk += 0.10;

  churnRisk = Math.round(Math.min(1, churnRisk) * 100) / 100;

  // 5. Salva/aggiorna scoring nel DB
  await db.pool.query(`
    INSERT INTO client_scoring (
      tenant_id, phone, churn_risk, engagement_score, consistency_score,
      motivation_level, preferred_days, preferred_time,
      avg_checkins_per_week, days_since_last_checkin, total_checkins_30d,
      checkin_trend, weekly_checkins_history, scoring_data, last_scored_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
    ON CONFLICT (tenant_id, phone) DO UPDATE SET
      churn_risk = $3,
      engagement_score = $4,
      consistency_score = $5,
      preferred_days = $7,
      preferred_time = $8,
      avg_checkins_per_week = $9,
      days_since_last_checkin = $10,
      total_checkins_30d = $11,
      checkin_trend = $12,
      weekly_checkins_history = $13,
      scoring_data = $14,
      last_scored_at = NOW()
  `, [
    tenantId, phone, churnRisk, engagementScore, consistencyScore,
    motivationLevel, preferredDays, preferredTime,
    avgCheckinsPerWeek, daysSinceLastCheckin, totalCheckins30d,
    checkinTrend, JSON.stringify(weeklyHistory),
    JSON.stringify({
      daysSinceLastCheckin,
      daysSinceLastMessage,
      totalCheckins30d,
      userMessages30d: userMessages.length,
      weeklyHistory,
      checkinTrend,
      factors: {
        inactivity: daysSinceLastCheckin,
        trend: checkinTrend,
        motivation: motivationLevel,
        messageSilence: daysSinceLastMessage,
        consistency: consistencyScore
      }
    })
  ]);

  return {
    phone, churnRisk, engagementScore, consistencyScore,
    motivationLevel, preferredDays, preferredTime,
    avgCheckinsPerWeek, checkinTrend
  };
}

/**
 * Recupera i clienti a rischio per un tenant
 */
async function getAtRiskClients(tenantId, db, minChurnRisk = 0.6) {
  const result = await db.pool.query(`
    SELECT cs.*, cp.name, cp.fitness_goals, cp.conversation_summary, cp.key_facts
    FROM client_scoring cs
    LEFT JOIN client_profiles cp ON cp.tenant_id = cs.tenant_id AND cp.phone = cs.phone
    WHERE cs.tenant_id = $1 AND cs.churn_risk >= $2
    ORDER BY cs.churn_risk DESC
  `, [tenantId, minChurnRisk]);
  return result.rows;
}

/**
 * Recupera overview scoring per il dashboard
 */
async function getScoringOverview(tenantId, db) {
  const result = await db.pool.query(`
    SELECT
      COUNT(*) as total_clients,
      COUNT(*) FILTER (WHERE churn_risk >= 0.7) as high_risk,
      COUNT(*) FILTER (WHERE churn_risk >= 0.5 AND churn_risk < 0.7) as medium_risk,
      COUNT(*) FILTER (WHERE churn_risk < 0.5) as low_risk,
      COUNT(*) FILTER (WHERE engagement_score >= 0.7) as highly_engaged,
      COUNT(*) FILTER (WHERE checkin_trend = 'up') as trending_up,
      COUNT(*) FILTER (WHERE checkin_trend = 'down') as trending_down,
      COUNT(*) FILTER (WHERE motivation_level = 'high') as motivation_high,
      COUNT(*) FILTER (WHERE motivation_level = 'low') as motivation_low,
      ROUND(AVG(churn_risk)::numeric, 2) as avg_churn_risk,
      ROUND(AVG(engagement_score)::numeric, 2) as avg_engagement,
      ROUND(AVG(avg_checkins_per_week)::numeric, 1) as avg_weekly_checkins
    FROM client_scoring
    WHERE tenant_id = $1
  `, [tenantId]);
  return result.rows[0];
}

/**
 * Recupera tutti i client scoring per il dashboard
 */
async function getAllClientScores(tenantId, db) {
  const result = await db.pool.query(`
    SELECT cs.phone, cs.churn_risk, cs.engagement_score, cs.consistency_score,
      cs.motivation_level, cs.preferred_days, cs.preferred_time,
      cs.avg_checkins_per_week, cs.days_since_last_checkin, cs.checkin_trend,
      cs.weekly_checkins_history, cs.last_scored_at,
      cp.name, cp.fitness_goals, cp.fitness_level
    FROM client_scoring cs
    LEFT JOIN client_profiles cp ON cp.tenant_id = cs.tenant_id AND cp.phone = cs.phone
    WHERE cs.tenant_id = $1
    ORDER BY cs.churn_risk DESC
  `, [tenantId]);
  return result.rows;
}

module.exports = {
  scoreAllClients,
  scoreClient,
  getAtRiskClients,
  getScoringOverview,
  getAllClientScores
};
