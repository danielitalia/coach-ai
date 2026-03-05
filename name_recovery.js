const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:coachaipass@postgres:5432/coachai',
});

async function run() {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  console.log('Avvio recupero nomi per tenant:', tenantId);

  // 1. Trova clienti senza nome
  const result = await pool.query('SELECT phone FROM clients WHERE tenant_id = $1 AND (name IS NULL OR name = \'\')', [tenantId]);
  const phones = result.rows.map(r => r.phone);
  console.log(`Trovati ${phones.length} clienti senza nome.`);

  for (const phone of phones) {
    // 2. Cerca nel client_profiles se il nome c'è
    const profile = await pool.query('SELECT name FROM client_profiles WHERE tenant_id = $1 AND phone = $2', [tenantId, phone]);
    if (profile.rows[0]?.name) {
      console.log(`Recuperato nome "${profile.rows[0].name}" da profilo per ${phone}`);
      await pool.query('UPDATE clients SET name = $1 WHERE tenant_id = $2 AND phone = $3', [profile.rows[0].name, tenantId, phone]);
      continue;
    }

    // 3. Cerca nel sommario della conversazione se il nome è citato
    const summaryResult = await pool.query('SELECT conversation_summary, key_facts FROM client_profiles WHERE tenant_id = $1 AND phone = $2', [tenantId, phone]);
    const summary = (summaryResult.rows[0]?.conversation_summary || '') + ' ' + (summaryResult.rows[0]?.key_facts || '');
    
    // Pattern semplice per estrarre nomi (es. "Si chiama [Nome]", "Nome: [Nome]")
    const nameMatch = summary.match(/si chiama ([A-Z][a-z]+)/i) || summary.match(/Nome: ([A-Z][a-z]+)/i);
    if (nameMatch && nameMatch[1]) {
      console.log(`Estratto nome "${nameMatch[1]}" da sommario per ${phone}`);
      await pool.query('UPDATE clients SET name = $1 WHERE tenant_id = $2 AND phone = $3', [nameMatch[1], tenantId, phone]);
      await pool.query('UPDATE client_profiles SET name = $1 WHERE tenant_id = $2 AND phone = $3', [nameMatch[1], tenantId, phone]);
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
