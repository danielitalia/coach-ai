/**
 * @name link-tenant-telegram
 * @description Associa un account Telegram (chatbot) a una palestra specifica usando il PIN di sicurezza fornito dal proprietario. Da usare solo la prima volta che un proprietario scrive un PIN.
 * @params {"pin": "string - Il PIN segreto di 6 cifre fornito dall'utente.", "chatId": "string - L'ID Telegram o la session list del mittente."}
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgres://postgres:ULkAVpnmeGqCiw8IrLzsw97lAgg25VjYQT22zZWqRSomQyBBquBSGNSXT1IP0kTB@v8k04c8kkwwc480s8g44s0gg:5432/postgres?sslmode=disable"
});

async function run(args, context) {
    const pin = args.pin?.toUpperCase().replace(/\s/g, '');
    const chatId = args.chatId || context?.request?.senderId || 'unknown_chat_id';

    if (!pin || pin.length < 5) {
        return JSON.stringify({ error: "PIN non valido. Il PIN deve essere lungo almeno 5 o 6 caratteri." });
    }

    try {
        // Cerca il tenant base al PIN
        const tenantRes = await pool.query(`
      SELECT id, name FROM tenants 
      WHERE telegram_pin = $1
    `, [pin]);

        if (tenantRes.rows.length === 0) {
            return JSON.stringify({ error: "Nessun account trovato per questo PIN. Assicurati che il codice sia corretto esplorando la Dashboard Impostazioni." });
        }

        const tenant = tenantRes.rows[0];

        // Se lo trova, aggiorna l'ID Telegram sul tenant
        await pool.query(`
      UPDATE tenants 
      SET telegram_chat_id = $1 
      WHERE id = $2
    `, [chatId, tenant.id]);

        return JSON.stringify({
            success: true,
            message: `Account collegato con successo! Benvenuto CEO di ${tenant.name}. Ora puoi chiedermi statistiche come 'Quanti check-in oggi?' o 'Chi rischia l'abbandono?'.`,
            tenant_name: tenant.name
        });
    } catch (err) {
        return JSON.stringify({ error: err.message });
    } finally {
        await pool.end();
    }
}

module.exports = { run };
