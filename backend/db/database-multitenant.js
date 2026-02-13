const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:coachaipass@postgres:5432/coachai',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ========== INIZIALIZZAZIONE ==========

async function initDatabase() {
  const client = await pool.connect();
  try {
    // Verifica se il database è già stato migrato a multi-tenant
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'tenants'
      ) as tenants_exist
    `);

    if (checkResult.rows[0].tenants_exist) {
      console.log('Database multi-tenant già inizializzato');
      return;
    }

    // Se non esiste, esegui solo lo schema multi-tenant (include tutto)
    const multitenantPath = path.join(__dirname, 'schema-multitenant.sql');
    if (fs.existsSync(multitenantPath)) {
      const multitenantSchema = fs.readFileSync(multitenantPath, 'utf8');
      await client.query(multitenantSchema);
    }

    console.log('Database schema initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// ========== TENANTS ==========

async function createTenant(data) {
  const slug = data.slug || data.name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');

  const result = await pool.query(`
    INSERT INTO tenants (name, slug, whatsapp_number, coach_name, subscription_plan)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [data.name, slug, data.whatsappNumber, data.coachName || 'Coach AI', data.plan || 'trial']);

  return result.rows[0];
}

async function getTenant(tenantId) {
  const result = await pool.query(
    'SELECT * FROM tenants WHERE id = $1',
    [tenantId]
  );
  return result.rows[0] || null;
}

async function getTenantBySlug(slug) {
  const result = await pool.query(
    'SELECT * FROM tenants WHERE slug = $1',
    [slug]
  );
  return result.rows[0] || null;
}

async function getTenantByWhatsApp(whatsappNumber) {
  // Normalizza il numero (rimuovi + e spazi)
  const normalized = whatsappNumber.replace(/[+\s]/g, '');
  const result = await pool.query(
    'SELECT * FROM tenants WHERE whatsapp_number = $1 OR whatsapp_number = $2',
    [whatsappNumber, normalized]
  );
  return result.rows[0] || null;
}

async function getTenantByInstanceName(instanceName) {
  const result = await pool.query(
    'SELECT * FROM tenants WHERE whatsapp_instance_name = $1',
    [instanceName]
  );
  return result.rows[0] || null;
}

async function updateTenant(tenantId, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'name', 'whatsapp_number', 'whatsapp_instance_name', 'whatsapp_connected',
    'logo_url', 'primary_color', 'coach_name', 'coach_personality',
    'use_emoji', 'custom_system_prompt', 'subscription_plan', 'subscription_status'
  ];

  for (const [key, value] of Object.entries(data)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      fields.push(`${snakeKey} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return getTenant(tenantId);

  values.push(tenantId);
  const result = await pool.query(`
    UPDATE tenants SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0];
}

async function getAllTenants() {
  const result = await pool.query(
    'SELECT * FROM tenants ORDER BY created_at DESC'
  );
  return result.rows;
}

// ========== USERS ==========

async function createUser(data) {
  const passwordHash = await bcrypt.hash(data.password, 10);

  const result = await pool.query(`
    INSERT INTO users (email, password_hash, name)
    VALUES ($1, $2, $3)
    RETURNING id, email, name, created_at
  `, [data.email.toLowerCase(), passwordHash, data.name]);

  return result.rows[0];
}

async function getUserByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

async function getUserById(userId) {
  const result = await pool.query(
    'SELECT id, email, name, avatar_url, email_verified, created_at FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

async function updateUserPassword(userId, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
}

async function setPasswordResetToken(email, token, expires) {
  await pool.query(`
    UPDATE users SET password_reset_token = $1, password_reset_expires = $2
    WHERE email = $3
  `, [token, expires, email.toLowerCase()]);
}

async function getUserByResetToken(token) {
  const result = await pool.query(`
    SELECT * FROM users
    WHERE password_reset_token = $1 AND password_reset_expires > NOW()
  `, [token]);
  return result.rows[0] || null;
}

async function clearPasswordResetToken(userId) {
  await pool.query(`
    UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL
    WHERE id = $1
  `, [userId]);
}

// ========== USER-TENANT RELATIONS ==========

async function addUserToTenant(userId, tenantId, role = 'staff') {
  const result = await pool.query(`
    INSERT INTO user_tenants (user_id, tenant_id, role, accepted_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = $3
    RETURNING *
  `, [userId, tenantId, role]);
  return result.rows[0];
}

async function getUserTenants(userId) {
  const result = await pool.query(`
    SELECT t.*, ut.role
    FROM tenants t
    JOIN user_tenants ut ON t.id = ut.tenant_id
    WHERE ut.user_id = $1
    ORDER BY t.name
  `, [userId]);
  return result.rows;
}

async function getTenantUsers(tenantId) {
  const result = await pool.query(`
    SELECT u.id, u.email, u.name, u.avatar_url, ut.role, ut.accepted_at
    FROM users u
    JOIN user_tenants ut ON u.id = ut.user_id
    WHERE ut.tenant_id = $1
    ORDER BY ut.role, u.name
  `, [tenantId]);
  return result.rows;
}

async function getUserTenantRole(userId, tenantId) {
  const result = await pool.query(
    'SELECT role FROM user_tenants WHERE user_id = $1 AND tenant_id = $2',
    [userId, tenantId]
  );
  return result.rows[0]?.role || null;
}

async function removeUserFromTenant(userId, tenantId) {
  await pool.query(
    'DELETE FROM user_tenants WHERE user_id = $1 AND tenant_id = $2',
    [userId, tenantId]
  );
}

// ========== SESSIONS ==========

async function createSession(userId, refreshTokenHash, userAgent, ipAddress, expiresAt) {
  const result = await pool.query(`
    INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [userId, refreshTokenHash, userAgent, ipAddress, expiresAt]);
  return result.rows[0];
}

async function getSession(sessionId) {
  const result = await pool.query(
    'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
    [sessionId]
  );
  return result.rows[0] || null;
}

async function deleteSession(sessionId) {
  await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

async function deleteUserSessions(userId) {
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

async function cleanExpiredSessions() {
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
}

// ========== CLIENTS (con tenant) ==========

async function getClient(tenantId, phone) {
  const result = await pool.query(
    'SELECT * FROM clients WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );
  return result.rows[0] || null;
}

async function getAllClients(tenantId) {
  const result = await pool.query(
    'SELECT * FROM clients WHERE tenant_id = $1 ORDER BY last_activity DESC',
    [tenantId]
  );
  return result.rows;
}

async function upsertClient(tenantId, phone, data = {}) {
  const result = await pool.query(`
    INSERT INTO clients (tenant_id, phone, name, objective, experience, days_per_week, limitations, last_activity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id, phone) DO UPDATE SET
      name = COALESCE($3, clients.name),
      objective = COALESCE($4, clients.objective),
      experience = COALESCE($5, clients.experience),
      days_per_week = COALESCE($6, clients.days_per_week),
      limitations = COALESCE($7, clients.limitations),
      last_activity = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [tenantId, phone, data.name, data.objective, data.experience, data.daysPerWeek, data.limitations]);
  return result.rows[0];
}

async function updateClientActivity(tenantId, phone) {
  await pool.query(`
    INSERT INTO clients (tenant_id, phone, last_activity)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id, phone) DO UPDATE SET
      last_activity = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `, [tenantId, phone]);

  await pool.query(
    'DELETE FROM sent_reminders WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );
}

async function getInactiveClients(tenantId, days) {
  const result = await pool.query(`
    SELECT c.* FROM clients c
    WHERE c.tenant_id = $1 AND c.last_activity < NOW() - INTERVAL '1 day' * $2
  `, [tenantId, days]);
  return result.rows;
}

// ========== MESSAGES (con tenant) ==========

async function getMessages(tenantId, phone, limit = 50) {
  const result = await pool.query(`
    SELECT * FROM messages
    WHERE tenant_id = $1 AND phone = $2
    ORDER BY created_at ASC
    LIMIT $3
  `, [tenantId, phone, limit]);
  return result.rows;
}

async function getRecentMessages(tenantId, phone, limit = 20) {
  const result = await pool.query(`
    SELECT role, content FROM messages
    WHERE tenant_id = $1 AND phone = $2
    ORDER BY created_at DESC
    LIMIT $3
  `, [tenantId, phone, limit]);
  return result.rows.reverse();
}

async function addMessage(tenantId, phone, role, content, options = {}) {
  const result = await pool.query(`
    INSERT INTO messages (tenant_id, phone, role, content, is_reminder, is_workout_plan)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [tenantId, phone, role, content, options.isReminder || false, options.isWorkoutPlan || false]);
  return result.rows[0];
}

async function getConversationsList(tenantId) {
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
      WHERE tenant_id = $1 AND phone = c.phone
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON true
    WHERE c.tenant_id = $1
    ORDER BY COALESCE(m.created_at, c.last_activity) DESC
  `, [tenantId]);
  return result.rows;
}

// ========== WORKOUT PLANS (con tenant) ==========

async function getWorkoutPlan(tenantId, planId) {
  const result = await pool.query(
    'SELECT * FROM workout_plans WHERE tenant_id = $1 AND id = $2',
    [tenantId, planId]
  );
  return result.rows[0] || null;
}

// Ottiene scheda per ID (per link pubblico, senza verifica tenant)
async function getWorkoutPlanById(planId) {
  const result = await pool.query(
    'SELECT wp.*, t.name as tenant_name, t.primary_color FROM workout_plans wp LEFT JOIN tenants t ON wp.tenant_id = t.id WHERE wp.id = $1',
    [planId]
  );
  return result.rows[0] || null;
}

async function getWorkoutPlansByPhone(tenantId, phone) {
  const result = await pool.query(
    'SELECT * FROM workout_plans WHERE tenant_id = $1 AND phone = $2 ORDER BY created_at DESC',
    [tenantId, phone]
  );
  return result.rows;
}

async function getAllWorkoutPlans(tenantId) {
  const result = await pool.query(
    'SELECT * FROM workout_plans WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId]
  );
  return result.rows;
}

async function saveWorkoutPlan(tenantId, plan) {
  const result = await pool.query(`
    INSERT INTO workout_plans (tenant_id, id, phone, client_name, objective, experience, days_per_week, limitations, workouts, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    tenantId,
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

async function deleteWorkoutPlan(tenantId, planId) {
  const result = await pool.query(
    'DELETE FROM workout_plans WHERE tenant_id = $1 AND id = $2 RETURNING *',
    [tenantId, planId]
  );
  return result.rows[0];
}

async function updateWorkoutPlan(tenantId, planId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  // Campi aggiornabili
  if (updates.workouts !== undefined) {
    fields.push(`workouts = $${paramIndex++}`);
    values.push(JSON.stringify(updates.workouts));
  }
  if (updates.notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`);
    values.push(updates.notes);
  }
  if (updates.objective !== undefined) {
    fields.push(`objective = $${paramIndex++}`);
    values.push(updates.objective);
  }
  if (updates.daysPerWeek !== undefined) {
    fields.push(`days_per_week = $${paramIndex++}`);
    values.push(updates.daysPerWeek);
  }
  if (updates.clientName !== undefined) {
    fields.push(`client_name = $${paramIndex++}`);
    values.push(updates.clientName);
  }

  if (fields.length === 0) {
    return await getWorkoutPlan(tenantId, planId);
  }

  // Aggiungi updated_at
  fields.push(`updated_at = NOW()`);

  values.push(tenantId, planId);
  const result = await pool.query(`
    UPDATE workout_plans
    SET ${fields.join(', ')}
    WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0];
}

// ========== REMINDERS (con tenant) ==========

async function getSentReminders(tenantId, phone) {
  const result = await pool.query(
    'SELECT reminder_days FROM sent_reminders WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );
  return result.rows.map(r => r.reminder_days);
}

async function addSentReminder(tenantId, phone, days) {
  await pool.query(`
    INSERT INTO sent_reminders (tenant_id, phone, reminder_days)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `, [tenantId, phone, days]);
}

// ========== CHECK-INS (con tenant) ==========

async function addCheckin(tenantId, phone, workoutDay = null, notes = null) {
  const result = await pool.query(`
    INSERT INTO checkins (tenant_id, phone, workout_day, notes)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [tenantId, phone, workoutDay, notes]);
  return result.rows[0];
}

async function getCheckins(tenantId, phone, limit = 30) {
  const result = await pool.query(`
    SELECT * FROM checkins
    WHERE tenant_id = $1 AND phone = $2
    ORDER BY checked_in_at DESC
    LIMIT $3
  `, [tenantId, phone, limit]);
  return result.rows;
}

async function getTodayCheckin(tenantId, phone) {
  const result = await pool.query(`
    SELECT * FROM checkins
    WHERE tenant_id = $1 AND phone = $2
    AND DATE(checked_in_at) = CURRENT_DATE
    ORDER BY checked_in_at DESC
    LIMIT 1
  `, [tenantId, phone]);
  return result.rows[0] || null;
}

async function getCheckinStats(tenantId, phone) {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_checkins,
      COUNT(*) FILTER (WHERE checked_in_at > NOW() - INTERVAL '7 days') as this_week,
      COUNT(*) FILTER (WHERE checked_in_at > NOW() - INTERVAL '30 days') as this_month,
      MAX(checked_in_at) as last_checkin
    FROM checkins
    WHERE tenant_id = $1 AND phone = $2
  `, [tenantId, phone]);
  return result.rows[0];
}

async function getCheckinStreak(tenantId, phone) {
  const result = await pool.query(`
    WITH daily_checkins AS (
      SELECT DISTINCT DATE(checked_in_at) as checkin_date
      FROM checkins
      WHERE tenant_id = $1 AND phone = $2
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
  `, [tenantId, phone]);
  return parseInt(result.rows[0]?.streak) || 0;
}

async function getAllCheckinsToday(tenantId) {
  const result = await pool.query(`
    SELECT c.*, cl.name
    FROM checkins c
    JOIN clients cl ON c.tenant_id = cl.tenant_id AND c.phone = cl.phone
    WHERE c.tenant_id = $1 AND DATE(c.checked_in_at) = CURRENT_DATE
    ORDER BY c.checked_in_at DESC
  `, [tenantId]);
  return result.rows;
}

// ========== REFERRALS (con tenant) ==========

function generateReferralCode(phone) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code + phone.slice(-3);
}

async function createReferralCode(tenantId, phone) {
  const existing = await pool.query(
    'SELECT referral_code FROM referrals WHERE tenant_id = $1 AND referrer_phone = $2 AND referred_phone IS NULL LIMIT 1',
    [tenantId, phone]
  );

  if (existing.rows[0]) {
    return existing.rows[0].referral_code;
  }

  const code = generateReferralCode(phone);
  await pool.query(`
    INSERT INTO referrals (tenant_id, referrer_phone, referral_code)
    VALUES ($1, $2, $3)
    ON CONFLICT (referral_code) DO NOTHING
  `, [tenantId, phone, code]);

  return code;
}

async function getReferralByCode(tenantId, code) {
  const result = await pool.query(
    'SELECT * FROM referrals WHERE tenant_id = $1 AND referral_code = $2',
    [tenantId, code.toUpperCase()]
  );
  return result.rows[0] || null;
}

async function useReferralCode(tenantId, code, referredPhone) {
  const referral = await getReferralByCode(tenantId, code);

  if (!referral) {
    return { success: false, error: 'Codice non valido' };
  }

  if (referral.referred_phone) {
    return { success: false, error: 'Codice già utilizzato' };
  }

  if (referral.referrer_phone === referredPhone) {
    return { success: false, error: 'Non puoi usare il tuo stesso codice!' };
  }

  await pool.query(`
    UPDATE referrals
    SET referred_phone = $1, status = 'registered', converted_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $2 AND referral_code = $3
  `, [referredPhone, tenantId, code.toUpperCase()]);

  return { success: true, referrerPhone: referral.referrer_phone };
}

async function completeReferral(tenantId, referredPhone) {
  const result = await pool.query(`
    UPDATE referrals
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1 AND referred_phone = $2 AND status = 'registered'
    RETURNING *
  `, [tenantId, referredPhone]);

  if (result.rows[0]) {
    await createReward(tenantId, result.rows[0].referrer_phone, 'free_week', 'Settimana gratuita - Hai invitato un amico!', result.rows[0].id);
    await createReward(tenantId, referredPhone, 'welcome_bonus', 'Bonus benvenuto - Sei stato invitato da un amico!', result.rows[0].id);
  }

  return result.rows[0];
}

async function getReferralStats(tenantId, phone) {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'registered') as registered,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) as total_invites
    FROM referrals
    WHERE tenant_id = $1 AND referrer_phone = $2
  `, [tenantId, phone]);
  return result.rows[0];
}

async function getAllReferrals(tenantId) {
  const result = await pool.query(`
    SELECT
      r.*,
      c1.name as referrer_name,
      c2.name as referred_name
    FROM referrals r
    LEFT JOIN clients c1 ON r.tenant_id = c1.tenant_id AND r.referrer_phone = c1.phone
    LEFT JOIN clients c2 ON r.tenant_id = c2.tenant_id AND r.referred_phone = c2.phone
    WHERE r.tenant_id = $1
    ORDER BY r.created_at DESC
  `, [tenantId]);
  return result.rows;
}

async function getReferralLeaderboard(tenantId, limit = 10) {
  const result = await pool.query(`
    SELECT
      r.referrer_phone as phone,
      c.name,
      COUNT(*) FILTER (WHERE r.status = 'completed') as completed_referrals,
      COUNT(*) as total_referrals
    FROM referrals r
    JOIN clients c ON r.tenant_id = c.tenant_id AND r.referrer_phone = c.phone
    WHERE r.tenant_id = $1
    GROUP BY r.referrer_phone, c.name
    HAVING COUNT(*) FILTER (WHERE r.status = 'completed') > 0
    ORDER BY completed_referrals DESC
    LIMIT $2
  `, [tenantId, limit]);
  return result.rows;
}

// ========== REWARDS (con tenant) ==========

async function createReward(tenantId, phone, rewardType, description, referralId = null) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const result = await pool.query(`
    INSERT INTO rewards (tenant_id, phone, reward_type, description, referral_id, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [tenantId, phone, rewardType, description, referralId, expiresAt]);
  return result.rows[0];
}

async function getRewards(tenantId, phone) {
  const result = await pool.query(`
    SELECT * FROM rewards
    WHERE tenant_id = $1 AND phone = $2
    ORDER BY created_at DESC
  `, [tenantId, phone]);
  return result.rows;
}

async function getUnclaimedRewards(tenantId, phone) {
  const result = await pool.query(`
    SELECT * FROM rewards
    WHERE tenant_id = $1 AND phone = $2 AND claimed = FALSE AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
  `, [tenantId, phone]);
  return result.rows;
}

async function claimReward(tenantId, rewardId, phone) {
  const result = await pool.query(`
    UPDATE rewards
    SET claimed = TRUE, claimed_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1 AND id = $2 AND phone = $3 AND claimed = FALSE
    RETURNING *
  `, [tenantId, rewardId, phone]);
  return result.rows[0];
}

async function getAllRewards(tenantId) {
  const result = await pool.query(`
    SELECT r.*, c.name as client_name
    FROM rewards r
    LEFT JOIN clients c ON r.tenant_id = c.tenant_id AND r.phone = c.phone
    WHERE r.tenant_id = $1
    ORDER BY r.created_at DESC
  `, [tenantId]);
  return result.rows;
}

// ========== CONFIG (con tenant) ==========

async function getConfig(tenantId, key) {
  const result = await pool.query(
    'SELECT value FROM config WHERE tenant_id = $1 AND key = $2',
    [tenantId, key]
  );
  return result.rows[0]?.value || null;
}

async function setConfig(tenantId, key, value) {
  await pool.query(`
    INSERT INTO config (tenant_id, key, value, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id, key) DO UPDATE SET
      value = $3,
      updated_at = CURRENT_TIMESTAMP
  `, [tenantId, key, JSON.stringify(value)]);
}

// ========== STATS (con tenant) ==========

async function getStats(tenantId) {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM clients WHERE tenant_id = $1) as total_clients,
      (SELECT COUNT(*) FROM clients WHERE tenant_id = $1 AND last_activity > NOW() - INTERVAL '1 day') as active_today,
      (SELECT COUNT(*) FROM messages WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days') as messages_this_week
  `, [tenantId]);
  return result.rows[0];
}

async function getCheckinStatsGlobal(tenantId) {
  const today = await getAllCheckinsToday(tenantId);
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_checkins,
      COUNT(DISTINCT phone) as unique_clients,
      COUNT(*) FILTER (WHERE checked_in_at > NOW() - INTERVAL '7 days') as this_week,
      COUNT(*) FILTER (WHERE checked_in_at > NOW() - INTERVAL '30 days') as this_month
    FROM checkins
    WHERE tenant_id = $1
  `, [tenantId]);
  const stats = result.rows[0];

  return {
    today: today.length,
    totalCheckins: parseInt(stats.total_checkins) || 0,
    uniqueClients: parseInt(stats.unique_clients) || 0,
    thisWeek: parseInt(stats.this_week) || 0,
    thisMonth: parseInt(stats.this_month) || 0
  };
}

async function getReferralStatsGlobal(tenantId) {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_referrals,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'registered') as registered,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(DISTINCT referrer_phone) as total_referrers
    FROM referrals
    WHERE tenant_id = $1
  `, [tenantId]);

  const rewardResult = await pool.query(`
    SELECT
      COUNT(*) as total_rewards,
      COUNT(*) FILTER (WHERE claimed = TRUE) as claimed,
      COUNT(*) FILTER (WHERE claimed = FALSE AND (expires_at IS NULL OR expires_at > NOW())) as pending,
      COUNT(*) FILTER (WHERE expires_at < NOW() AND claimed = FALSE) as expired
    FROM rewards
    WHERE tenant_id = $1
  `, [tenantId]);

  const stats = result.rows[0];
  const rewardStats = rewardResult.rows[0];

  return {
    totalReferrals: parseInt(stats.total_referrals) || 0,
    pending: parseInt(stats.pending) || 0,
    registered: parseInt(stats.registered) || 0,
    completed: parseInt(stats.completed) || 0,
    totalReferrers: parseInt(stats.total_referrers) || 0,
    rewards: rewardStats
  };
}

// ========== AUDIT LOG ==========

async function addAuditLog(tenantId, userId, action, entityType, entityId, details, ipAddress) {
  await pool.query(`
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [tenantId, userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddress]);
}

// ========== ONBOARDING ==========

const crypto = require('crypto');

async function createOnboardingToken(tenantId, expiresInDays = 7) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const result = await pool.query(`
    INSERT INTO onboarding_tokens (tenant_id, token, expires_at)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [tenantId, token, expiresAt]);

  return result.rows[0];
}

async function getOnboardingByToken(token) {
  const result = await pool.query(`
    SELECT ot.*, t.name as tenant_name, t.slug as tenant_slug
    FROM onboarding_tokens ot
    JOIN tenants t ON ot.tenant_id = t.id
    WHERE ot.token = $1
  `, [token]);
  return result.rows[0] || null;
}

async function getOnboardingByTenant(tenantId) {
  const result = await pool.query(`
    SELECT * FROM onboarding_tokens
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [tenantId]);
  return result.rows[0] || null;
}

async function updateOnboardingProgress(token, step, stepData) {
  const result = await pool.query(`
    UPDATE onboarding_tokens
    SET current_step = $2,
        step_data = step_data || $3::jsonb,
        status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
        started_at = COALESCE(started_at, NOW())
    WHERE token = $1
    RETURNING *
  `, [token, step, JSON.stringify(stepData)]);
  return result.rows[0];
}

async function completeOnboarding(token) {
  // Aggiorna token come completato
  const tokenResult = await pool.query(`
    UPDATE onboarding_tokens
    SET status = 'completed', completed_at = NOW(), current_step = 4
    WHERE token = $1
    RETURNING *
  `, [token]);

  if (tokenResult.rows[0]) {
    // Aggiorna anche il tenant
    await pool.query(`
      UPDATE tenants
      SET onboarding_completed = TRUE
      WHERE id = $1
    `, [tokenResult.rows[0].tenant_id]);
  }

  return tokenResult.rows[0];
}

async function updateTenantOnboardingData(tenantId, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'name', 'coach_name', 'coach_tone', 'welcome_message',
    'gym_address', 'gym_phone', 'gym_hours', 'logo_url',
    'whatsapp_instance_name', 'whatsapp_connected'
  ];

  for (const [key, value] of Object.entries(data)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      fields.push(`${snakeKey} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return getTenant(tenantId);

  values.push(tenantId);
  const result = await pool.query(`
    UPDATE tenants SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0];
}

async function expireOldOnboardingTokens() {
  await pool.query(`
    UPDATE onboarding_tokens
    SET status = 'expired'
    WHERE status IN ('pending', 'in_progress') AND expires_at < NOW()
  `);
}

// ========== AUTOMATION ==========

async function getAllActiveTenants() {
  const result = await pool.query(`
    SELECT * FROM tenants
    WHERE subscription_status = 'active' OR subscription_status IS NULL
    ORDER BY created_at
  `);
  return result.rows;
}

async function getAutomationSequences(tenantId, triggerType = null) {
  let query = 'SELECT * FROM automation_sequences WHERE tenant_id = $1';
  const params = [tenantId];

  if (triggerType) {
    query += ' AND trigger_type = $2';
    params.push(triggerType);
  }

  query += ' AND is_enabled = TRUE ORDER BY created_at';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getAllAutomationSequences(tenantId) {
  const result = await pool.query(
    'SELECT * FROM automation_sequences WHERE tenant_id = $1 ORDER BY trigger_type, created_at',
    [tenantId]
  );
  return result.rows;
}

async function getAutomationSequence(tenantId, sequenceId) {
  const result = await pool.query(
    'SELECT * FROM automation_sequences WHERE tenant_id = $1 AND id = $2',
    [tenantId, sequenceId]
  );
  return result.rows[0] || null;
}

async function createAutomationSequence(tenantId, data) {
  const result = await pool.query(`
    INSERT INTO automation_sequences (tenant_id, name, trigger_type, trigger_config, message_template, is_enabled)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    tenantId,
    data.name,
    data.trigger_type,
    JSON.stringify(data.trigger_config),
    data.message_template,
    data.is_enabled !== false
  ]);
  return result.rows[0];
}

async function updateAutomationSequence(tenantId, sequenceId, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.trigger_config !== undefined) {
    fields.push(`trigger_config = $${paramIndex++}`);
    values.push(JSON.stringify(data.trigger_config));
  }
  if (data.message_template !== undefined) {
    fields.push(`message_template = $${paramIndex++}`);
    values.push(data.message_template);
  }
  if (data.is_enabled !== undefined) {
    fields.push(`is_enabled = $${paramIndex++}`);
    values.push(data.is_enabled);
  }

  if (fields.length === 0) return getAutomationSequence(tenantId, sequenceId);

  fields.push(`updated_at = NOW()`);
  values.push(tenantId, sequenceId);

  const result = await pool.query(`
    UPDATE automation_sequences
    SET ${fields.join(', ')}
    WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0];
}

async function deleteAutomationSequence(tenantId, sequenceId) {
  const result = await pool.query(
    'DELETE FROM automation_sequences WHERE tenant_id = $1 AND id = $2 RETURNING *',
    [tenantId, sequenceId]
  );
  return result.rows[0];
}

async function createAutomationJob(data) {
  const result = await pool.query(`
    INSERT INTO automation_jobs (tenant_id, sequence_id, phone, trigger_type, trigger_key, status, message_sent, error_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    data.tenant_id,
    data.sequence_id || null,
    data.phone,
    data.trigger_type,
    data.trigger_key,
    data.status || 'sent',
    data.message_sent || null,
    data.error_message || null
  ]);
  return result.rows[0];
}

async function hasRecentAutomationJob(tenantId, phone, triggerKey, daysBack = 30) {
  const result = await pool.query(`
    SELECT 1 FROM automation_jobs
    WHERE tenant_id = $1 AND phone = $2 AND trigger_key = $3
    AND status = 'sent'
    AND executed_at > NOW() - INTERVAL '1 day' * $4
    LIMIT 1
  `, [tenantId, phone, triggerKey, daysBack]);
  return result.rows.length > 0;
}

async function hasAutomationJobByKey(tenantId, triggerKey) {
  const result = await pool.query(`
    SELECT 1 FROM automation_jobs
    WHERE tenant_id = $1 AND trigger_key = $2 AND status = 'sent'
    LIMIT 1
  `, [tenantId, triggerKey]);
  return result.rows.length > 0;
}

async function getAutomationJobs(tenantId, limit = 100) {
  const result = await pool.query(`
    SELECT aj.*, as2.name as sequence_name
    FROM automation_jobs aj
    LEFT JOIN automation_sequences as2 ON aj.sequence_id = as2.id
    WHERE aj.tenant_id = $1
    ORDER BY aj.executed_at DESC
    LIMIT $2
  `, [tenantId, limit]);
  return result.rows;
}

async function getAutomationStats(tenantId) {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_jobs,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE executed_at > NOW() - INTERVAL '24 hours') as last_24h,
      COUNT(*) FILTER (WHERE executed_at > NOW() - INTERVAL '7 days') as last_7d
    FROM automation_jobs
    WHERE tenant_id = $1
  `, [tenantId]);
  return result.rows[0];
}

async function getCheckinsForFollowup(tenantId, delayMinutes) {
  const result = await pool.query(`
    SELECT * FROM checkins
    WHERE tenant_id = $1
    AND checked_in_at > NOW() - INTERVAL '1 minute' * ($2 + 10)
    AND checked_in_at < NOW() - INTERVAL '1 minute' * ($2 - 5)
    ORDER BY checked_in_at
  `, [tenantId, delayMinutes]);
  return result.rows;
}

async function getActiveClients(tenantId, daysActive = 7) {
  const result = await pool.query(`
    SELECT * FROM clients
    WHERE tenant_id = $1
    AND last_activity > NOW() - INTERVAL '1 day' * $2
    ORDER BY last_activity DESC
  `, [tenantId, daysActive]);
  return result.rows;
}

async function getClientByPhone(tenantId, phone) {
  return getClient(tenantId, phone);
}

// ========== EXPORTS ==========

module.exports = {
  pool,
  initDatabase,

  // Tenants
  createTenant,
  getTenant,
  getTenantBySlug,
  getTenantByWhatsApp,
  getTenantByInstanceName,
  updateTenant,
  getAllTenants,

  // Users
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  updateUserPassword,
  setPasswordResetToken,
  getUserByResetToken,
  clearPasswordResetToken,

  // User-Tenant
  addUserToTenant,
  getUserTenants,
  getTenantUsers,
  getUserTenantRole,
  removeUserFromTenant,

  // Sessions
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
  cleanExpiredSessions,

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
  getWorkoutPlanById,
  getWorkoutPlansByPhone,
  getAllWorkoutPlans,
  saveWorkoutPlan,
  updateWorkoutPlan,
  deleteWorkoutPlan,

  // Reminders
  getSentReminders,
  addSentReminder,

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
  getAllReferrals,
  getReferralLeaderboard,

  // Rewards
  createReward,
  getRewards,
  getUnclaimedRewards,
  claimReward,
  getAllRewards,

  // Config
  getConfig,
  setConfig,

  // Stats
  getStats,
  getCheckinStatsGlobal,
  getReferralStatsGlobal,

  // Audit
  addAuditLog,

  // Automation
  getAllActiveTenants,
  getAutomationSequences,
  getAllAutomationSequences,
  getAutomationSequence,
  createAutomationSequence,
  updateAutomationSequence,
  deleteAutomationSequence,
  createAutomationJob,
  hasRecentAutomationJob,
  hasAutomationJobByKey,
  getAutomationJobs,
  getAutomationStats,
  getCheckinsForFollowup,
  getActiveClients,
  getClientByPhone,

  // Onboarding
  createOnboardingToken,
  getOnboardingByToken,
  getOnboardingByTenant,
  updateOnboardingProgress,
  completeOnboarding,
  updateTenantOnboardingData,
  expireOldOnboardingTokens
};
