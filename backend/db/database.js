const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:coachaipass@postgres:5432/coachai',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Inizializza database con schema
async function initDatabase() {
  const client = await pool.connect();
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log('Database schema initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// ========== CLIENTS ==========

async function getClient(phone) {
  const result = await pool.query(
    'SELECT * FROM clients WHERE phone = $1',
    [phone]
  );
  return result.rows[0] || null;
}

async function getAllClients() {
  const result = await pool.query(
    'SELECT * FROM clients ORDER BY last_activity DESC'
  );
  return result.rows;
}

async function upsertClient(phone, data = {}) {
  const result = await pool.query(`
    INSERT INTO clients (phone, name, objective, experience, days_per_week, limitations, last_activity)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (phone) DO UPDATE SET
      name = COALESCE($2, clients.name),
      objective = COALESCE($3, clients.objective),
      experience = COALESCE($4, clients.experience),
      days_per_week = COALESCE($5, clients.days_per_week),
      limitations = COALESCE($6, clients.limitations),
      last_activity = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [phone, data.name, data.objective, data.experience, data.daysPerWeek, data.limitations]);
  return result.rows[0];
}

async function updateClientActivity(phone) {
  // Crea cliente se non esiste, altrimenti aggiorna last_activity
  await pool.query(`
    INSERT INTO clients (phone, last_activity)
    VALUES ($1, CURRENT_TIMESTAMP)
    ON CONFLICT (phone) DO UPDATE SET
      last_activity = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `, [phone]);

  // Rimuovi promemoria inviati quando il cliente risponde
  await pool.query('DELETE FROM sent_reminders WHERE phone = $1', [phone]);
}

async function getInactiveClients(days) {
  const result = await pool.query(`
    SELECT c.* FROM clients c
    WHERE c.last_activity < NOW() - INTERVAL '1 day' * $1
  `, [days]);
  return result.rows;
}

// ========== MESSAGES ==========

async function getMessages(phone, limit = 50) {
  const result = await pool.query(`
    SELECT * FROM messages
    WHERE phone = $1
    ORDER BY created_at ASC
    LIMIT $2
  `, [phone, limit]);
  return result.rows;
}

async function getRecentMessages(phone, limit = 20) {
  const result = await pool.query(`
    SELECT role, content FROM messages
    WHERE phone = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [phone, limit]);
  // Ritorna in ordine cronologico
  return result.rows.reverse();
}

async function addMessage(phone, role, content, options = {}) {
  const result = await pool.query(`
    INSERT INTO messages (phone, role, content, is_reminder, is_workout_plan)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [phone, role, content, options.isReminder || false, options.isWorkoutPlan || false]);
  return result.rows[0];
}

async function getConversationsList() {
  const result = await pool.query(`
    SELECT
      c.phone,
      c.name,
      c.last_activity,
      m.content as last_message,
      m.created_at as message_time
    FROM clients c
    LEFT JOIN LATERAL (
      SELECT content, created_at
      FROM messages
      WHERE phone = c.phone
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON true
    ORDER BY COALESCE(m.created_at, c.last_activity) DESC
  `);
  return result.rows;
}

// ========== WORKOUT PLANS ==========

async function getWorkoutPlan(planId) {
  const result = await pool.query(
    'SELECT * FROM workout_plans WHERE id = $1',
    [planId]
  );
  return result.rows[0] || null;
}

async function getWorkoutPlansByPhone(phone) {
  const result = await pool.query(
    'SELECT * FROM workout_plans WHERE phone = $1 ORDER BY created_at DESC',
    [phone]
  );
  return result.rows;
}

async function getAllWorkoutPlans() {
  const result = await pool.query(
    'SELECT * FROM workout_plans ORDER BY created_at DESC'
  );
  return result.rows;
}

async function saveWorkoutPlan(plan) {
  const result = await pool.query(`
    INSERT INTO workout_plans (id, phone, client_name, objective, experience, days_per_week, limitations, workouts, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    plan.id,
    plan.phone,
    plan.clientName,
    plan.objective,
    plan.experience,
    plan.daysPerWeek,
    plan.limitations,
    JSON.stringify(plan.workouts),
    plan.notes
  ]);
  return result.rows[0];
}

async function deleteWorkoutPlan(planId) {
  const result = await pool.query(
    'DELETE FROM workout_plans WHERE id = $1 RETURNING *',
    [planId]
  );
  return result.rows[0];
}

async function getWorkoutStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_plans,
      COUNT(DISTINCT phone) as clients_with_plans,
      COUNT(*) FILTER (WHERE objective = 'dimagrire') as dimagrire,
      COUNT(*) FILTER (WHERE objective = 'massa') as massa,
      COUNT(*) FILTER (WHERE objective = 'tonificare') as tonificare,
      COUNT(*) FILTER (WHERE objective = 'salute') as salute
    FROM workout_plans
  `);
  return result.rows[0];
}

// ========== REMINDERS ==========

async function getSentReminders(phone) {
  const result = await pool.query(
    'SELECT reminder_days FROM sent_reminders WHERE phone = $1',
    [phone]
  );
  return result.rows.map(r => r.reminder_days);
}

async function addSentReminder(phone, days) {
  await pool.query(`
    INSERT INTO sent_reminders (phone, reminder_days)
    VALUES ($1, $2)
    ON CONFLICT (phone, reminder_days) DO NOTHING
  `, [phone, days]);
}

async function clearSentReminders(phone) {
  await pool.query('DELETE FROM sent_reminders WHERE phone = $1', [phone]);
}

async function getAllSentReminders() {
  const result = await pool.query(`
    SELECT phone, array_agg(reminder_days) as reminder_days
    FROM sent_reminders
    GROUP BY phone
  `);
  return result.rows;
}

// ========== CONFIG ==========

async function getConfig(key) {
  const result = await pool.query(
    'SELECT value FROM config WHERE key = $1',
    [key]
  );
  return result.rows[0]?.value || null;
}

async function setConfig(key, value) {
  await pool.query(`
    INSERT INTO config (key, value, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET
      value = $2,
      updated_at = CURRENT_TIMESTAMP
  `, [key, JSON.stringify(value)]);
}

// ========== CHECK-INS ==========

async function addCheckin(phone, workoutDay = null, notes = null) {
  const result = await pool.query(`
    INSERT INTO checkins (phone, workout_day, notes)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [phone, workoutDay, notes]);
  return result.rows[0];
}

async function getCheckins(phone, limit = 30) {
  const result = await pool.query(`
    SELECT * FROM checkins
    WHERE phone = $1
    ORDER BY checked_in_at DESC
    LIMIT $2
  `, [phone, limit]);
  return result.rows;
}

async function getTodayCheckin(phone) {
  const result = await pool.query(`
    SELECT * FROM checkins
    WHERE phone = $1
    AND DATE(checked_in_at) = CURRENT_DATE
    ORDER BY checked_in_at DESC
    LIMIT 1
  `, [phone]);
  return result.rows[0] || null;
}

async function getCheckinStats(phone) {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_checkins,
      COUNT(*) FILTER (WHERE checked_in_at > NOW() - INTERVAL '7 days') as this_week,
      COUNT(*) FILTER (WHERE checked_in_at > NOW() - INTERVAL '30 days') as this_month,
      MAX(checked_in_at) as last_checkin
    FROM checkins
    WHERE phone = $1
  `, [phone]);
  return result.rows[0];
}

async function getCheckinStreak(phone) {
  // Calcola la streak corrente (giorni consecutivi)
  const result = await pool.query(`
    WITH daily_checkins AS (
      SELECT DISTINCT DATE(checked_in_at) as checkin_date
      FROM checkins
      WHERE phone = $1
      ORDER BY checkin_date DESC
    ),
    streaks AS (
      SELECT
        checkin_date,
        checkin_date - (ROW_NUMBER() OVER (ORDER BY checkin_date DESC))::int AS streak_group
      FROM daily_checkins
    )
    SELECT COUNT(*) as streak
    FROM streaks
    WHERE streak_group = (
      SELECT streak_group FROM streaks WHERE checkin_date = CURRENT_DATE
      UNION
      SELECT streak_group FROM streaks WHERE checkin_date = CURRENT_DATE - 1
      LIMIT 1
    )
  `, [phone]);
  return parseInt(result.rows[0]?.streak) || 0;
}

async function getAllCheckinsToday() {
  const result = await pool.query(`
    SELECT c.*, cl.name
    FROM checkins c
    JOIN clients cl ON c.phone = cl.phone
    WHERE DATE(c.checked_in_at) = CURRENT_DATE
    ORDER BY c.checked_in_at DESC
  `);
  return result.rows;
}

// ========== REFERRALS ==========

// Genera codice referral univoco
function generateReferralCode(phone) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Aggiungi ultime 3 cifre del telefono per unicità
  return code + phone.slice(-3);
}

async function createReferralCode(phone) {
  // Controlla se esiste già un codice per questo cliente
  const existing = await pool.query(
    'SELECT referral_code FROM referrals WHERE referrer_phone = $1 AND referred_phone IS NULL LIMIT 1',
    [phone]
  );

  if (existing.rows[0]) {
    return existing.rows[0].referral_code;
  }

  // Crea nuovo codice
  const code = generateReferralCode(phone);
  await pool.query(`
    INSERT INTO referrals (referrer_phone, referral_code)
    VALUES ($1, $2)
    ON CONFLICT (referral_code) DO NOTHING
  `, [phone, code]);

  return code;
}

async function getReferralByCode(code) {
  const result = await pool.query(
    'SELECT * FROM referrals WHERE referral_code = $1',
    [code.toUpperCase()]
  );
  return result.rows[0] || null;
}

async function useReferralCode(code, referredPhone) {
  // Verifica che il codice esista e non sia già usato
  const referral = await getReferralByCode(code);

  if (!referral) {
    return { success: false, error: 'Codice non valido' };
  }

  if (referral.referred_phone) {
    return { success: false, error: 'Codice già utilizzato' };
  }

  if (referral.referrer_phone === referredPhone) {
    return { success: false, error: 'Non puoi usare il tuo stesso codice!' };
  }

  // Aggiorna il referral
  await pool.query(`
    UPDATE referrals
    SET referred_phone = $1, status = 'registered', converted_at = CURRENT_TIMESTAMP
    WHERE referral_code = $2
  `, [referredPhone, code.toUpperCase()]);

  return { success: true, referrerPhone: referral.referrer_phone };
}

async function completeReferral(referredPhone) {
  // Chiamato quando il nuovo cliente fa il primo check-in o completa onboarding
  const result = await pool.query(`
    UPDATE referrals
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE referred_phone = $1 AND status = 'registered'
    RETURNING *
  `, [referredPhone]);

  if (result.rows[0]) {
    // Crea reward per chi ha invitato
    await createReward(result.rows[0].referrer_phone, 'free_week', 'Settimana gratuita - Hai invitato un amico!', result.rows[0].id);
    // Crea reward anche per il nuovo iscritto
    await createReward(referredPhone, 'welcome_bonus', 'Bonus benvenuto - Sei stato invitato da un amico!', result.rows[0].id);
  }

  return result.rows[0];
}

async function getReferralStats(phone) {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'registered') as registered,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) as total_invites
    FROM referrals
    WHERE referrer_phone = $1
  `, [phone]);
  return result.rows[0];
}

async function getMyReferrals(phone) {
  const result = await pool.query(`
    SELECT r.*, c.name as referred_name
    FROM referrals r
    LEFT JOIN clients c ON r.referred_phone = c.phone
    WHERE r.referrer_phone = $1
    ORDER BY r.created_at DESC
  `, [phone]);
  return result.rows;
}

async function getAllReferrals() {
  const result = await pool.query(`
    SELECT
      r.*,
      c1.name as referrer_name,
      c2.name as referred_name
    FROM referrals r
    LEFT JOIN clients c1 ON r.referrer_phone = c1.phone
    LEFT JOIN clients c2 ON r.referred_phone = c2.phone
    ORDER BY r.created_at DESC
  `);
  return result.rows;
}

async function getReferralLeaderboard(limit = 10) {
  const result = await pool.query(`
    SELECT
      r.referrer_phone as phone,
      c.name,
      COUNT(*) FILTER (WHERE r.status = 'completed') as completed_referrals,
      COUNT(*) as total_referrals
    FROM referrals r
    JOIN clients c ON r.referrer_phone = c.phone
    GROUP BY r.referrer_phone, c.name
    HAVING COUNT(*) FILTER (WHERE r.status = 'completed') > 0
    ORDER BY completed_referrals DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

// ========== REWARDS ==========

async function createReward(phone, rewardType, description, referralId = null) {
  // Scadenza tra 90 giorni
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const result = await pool.query(`
    INSERT INTO rewards (phone, reward_type, description, referral_id, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [phone, rewardType, description, referralId, expiresAt]);
  return result.rows[0];
}

async function getRewards(phone) {
  const result = await pool.query(`
    SELECT * FROM rewards
    WHERE phone = $1
    ORDER BY created_at DESC
  `, [phone]);
  return result.rows;
}

async function getUnclaimedRewards(phone) {
  const result = await pool.query(`
    SELECT * FROM rewards
    WHERE phone = $1 AND claimed = FALSE AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
  `, [phone]);
  return result.rows;
}

async function claimReward(rewardId, phone) {
  const result = await pool.query(`
    UPDATE rewards
    SET claimed = TRUE, claimed_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND phone = $2 AND claimed = FALSE
    RETURNING *
  `, [rewardId, phone]);
  return result.rows[0];
}

async function getAllRewardsStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_rewards,
      COUNT(*) FILTER (WHERE claimed = TRUE) as claimed,
      COUNT(*) FILTER (WHERE claimed = FALSE AND (expires_at IS NULL OR expires_at > NOW())) as pending,
      COUNT(*) FILTER (WHERE expires_at < NOW() AND claimed = FALSE) as expired
    FROM rewards
  `);
  return result.rows[0];
}

// ========== STATS ==========

async function getStats() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM clients) as total_clients,
      (SELECT COUNT(*) FROM clients WHERE last_activity > NOW() - INTERVAL '1 day') as active_today,
      (SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '7 days') as messages_this_week
  `);
  return result.rows[0];
}

module.exports = {
  pool,
  initDatabase,
  // Clients
  getClient,
  getAllClients,
  upsertClient,
  updateClientActivity,
  getInactiveClients,
  // Messages
  getMessages,
  getRecentMessages,
  addMessage,
  getConversationsList,
  // Workout Plans
  getWorkoutPlan,
  getWorkoutPlansByPhone,
  getAllWorkoutPlans,
  saveWorkoutPlan,
  deleteWorkoutPlan,
  getWorkoutStats,
  // Reminders
  getSentReminders,
  addSentReminder,
  clearSentReminders,
  getAllSentReminders,
  // Check-ins
  addCheckin,
  getCheckins,
  getTodayCheckin,
  getCheckinStats,
  getCheckinStreak,
  getAllCheckinsToday,
  // Referrals
  createReferralCode,
  getReferralByCode,
  useReferralCode,
  completeReferral,
  getReferralStats,
  getMyReferrals,
  getAllReferrals,
  getReferralLeaderboard,
  // Rewards
  createReward,
  getRewards,
  getUnclaimedRewards,
  claimReward,
  getAllRewardsStats,
  // Config
  getConfig,
  setConfig,
  // Stats
  getStats
};
