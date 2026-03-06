// POC: Coach AI - Digital CEO Telegram Bot
// Questo script simulerà la skill di lettura dal DB per OpenClaw
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function getGymStats(tenantId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Query 1: Check-in di oggi
    const checkinRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM analytics_events 
      WHERE tenant_id = $1 
        AND event_type = 'checkin' 
        AND DATE(created_at) = $2
    `, [tenantId, today]);
    
    // Query 2: Clienti a rischio abbandono
    const churnRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM client_scoring 
      WHERE tenant_id = $1 
        AND churn_risk >= 0.6
    `, [tenantId]);

    // Query 3: Valore salvato (ROI Churn)
    const roiRes = await pool.query(`
      SELECT SUM(value_saved) as total_saved 
      FROM brain_recoveries 
      WHERE tenant_id = $1
    `, [tenantId]);

    return JSON.stringify({
      data: today,
      checkin_oggi: parseInt(checkinRes.rows[0].count),
      clienti_a_rischio_churn: parseInt(churnRes.rows[0].count),
      fatturato_recuperato: parseFloat(roiRes.rows[0].total_saved || 0)
    });
  } catch (err) {
    return JSON.stringify({ error: err.message });
  } finally {
    await pool.end();
  }
}

// Se invocato direttamente (per testing)
if (require.main === module) {
  const testTenantId = '5888261e-7f4b-41e8-9cd9-6a91216ef357'; // Fitness Anna
  getGymStats(testTenantId).then(console.log);
}

module.exports = { getGymStats };
