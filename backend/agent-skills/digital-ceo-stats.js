/**
 * @name digital-ceo-stats
 * @description In questo tool fetchiamo statistiche KPI sulla palestra (check-in, rischio churn e fatturato recuperato). Da usare per rispondere a un proprietario su Telegram.
 * @params {"chatId": "string - L'ID Telegram o session_id dell'utente. Usalo sempre per identificare la palestra corretta."}
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgres://postgres:ULkAVpnmeGqCiw8IrLzsw97lAgg25VjYQT22zZWqRSomQyBBquBSGNSXT1IP0kTB@v8k04c8kkwwc480s8g44s0gg:5432/postgres?sslmode=disable"
});

async function run(args, context) {
    const chatId = args.chatId || context?.request?.senderId;

    if (!chatId) {
        return JSON.stringify({ error: "Chat ID mancante. Devi passare il chatId del proprietario per sapere di quale palestra recuperare le stats." });
    }

    try {
        // 1. Trova a quale palestra è associato questo utente Telegram
        const tenantRes = await pool.query(`
      SELECT id, name FROM tenants 
      WHERE telegram_chat_id = $1
    `, [chatId]);

        if (tenantRes.rows.length === 0) {
            return JSON.stringify({
                error: "Non risulti collegato a nessuna palestra. Per favore inserisci il PIN di collegamento presente nella tua Dashboard Coach AI.",
                needs_pairing: true
            });
        }

        const tenant = tenantRes.rows[0];
        const tenantId = tenant.id;
        const today = new Date().toISOString().split('T')[0];

        // Check-in di oggi
        const checkinRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM analytics_events 
      WHERE tenant_id = $1 AND event_type = 'checkin' AND DATE(created_at) = $2
    `, [tenantId, today]);

        // Clienti a rischio abbandono
        const churnRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM client_scoring 
      WHERE tenant_id = $1 AND churn_risk >= 0.6
    `, [tenantId]);

        // Valore salvato (ROI Churn)
        const roiRes = await pool.query(`
      SELECT SUM(value_saved) as total_saved 
      FROM brain_recoveries 
      WHERE tenant_id = $1
    `, [tenantId]);

        const result = {
            palestra_nome: tenant.name,
            oggi: today,
            checkin_oggi: parseInt(checkinRes.rows[0].count),
            clienti_a_rischio_churn: parseInt(churnRes.rows[0].count),
            fatturato_recuperato: parseFloat(roiRes.rows[0].total_saved || 0)
        };

        return JSON.stringify(result, null, 2);
    } catch (err) {
        return JSON.stringify({ error: err.message });
    } finally {
        await pool.end();
    }
}

module.exports = { run };
