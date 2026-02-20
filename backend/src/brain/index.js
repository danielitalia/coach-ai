/**
 * 🧠 Brain AI - Sistema Intelligente per Palestra
 *
 * Orchestratore dei 3 moduli:
 * 1. Scoring Engine - Analizza pattern e calcola rischio churn
 * 2. Conversation Analyzer - Detecta sentiment e motivazione
 * 3. Smart Actions - Decide e invia messaggi personalizzati
 *
 * Cron Schedule:
 * - Ogni 6 ore: Scoring + Smart Actions (00:30, 06:30, 12:30, 18:30)
 * - Real-time: Conversation Analyzer (hook in processMessage)
 */

const cron = require('node-cron');
const scoring = require('./scoring');
const analyzer = require('./analyzer');
const actions = require('./actions');

let db = null;
let sendWhatsAppMessage = null;
let isRunning = false;

/**
 * Inizializza il Brain
 */
function init(database, sendMessage, aiClient, aiModel, isAnthropic) {
  if (!database || !sendMessage) {
    console.error('[Brain] ❌ Init FAILED: database and sendMessage are required');
    return;
  }
  db = database;
  sendWhatsAppMessage = sendMessage;
  actions.initAI(aiClient, aiModel, isAnthropic);
  console.log('[Brain] 🧠 Module initialized');
}

/**
 * Ciclo completo: Scoring → Actions per tutti i tenant
 */
async function runBrainCycle() {
  if (!db || !sendWhatsAppMessage) {
    console.error('[Brain] Module not initialized');
    return;
  }

  if (isRunning) {
    console.log('[Brain] Previous cycle still running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  console.log('[Brain] 🧠 ====== Starting Brain Cycle ======');

  try {
    // Step 1: Scoring per tutti i tenant
    const tenantsResult = await db.pool.query(`
      SELECT * FROM tenants WHERE whatsapp_connected = true AND whatsapp_instance_name IS NOT NULL
    `);
    const tenants = tenantsResult.rows;

    console.log(`[Brain] Processing ${tenants.length} active tenants`);

    for (const tenant of tenants) {
      try {
        // Scoring
        const scoreResult = await scoring.scoreAllClients(tenant.id, db);
        console.log(`[Brain] ${tenant.name}: scored ${scoreResult.scored} clients`);
      } catch (err) {
        console.error(`[Brain] Scoring error for ${tenant.name}:`, err.message);
      }
    }

    // Step 2: Smart Actions (dopo che tutti gli scoring sono aggiornati)
    const totalActions = await actions.processAllTenants(db, sendWhatsAppMessage);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Brain] 🧠 ====== Brain Cycle Completed in ${duration}s | ${totalActions} actions ======`);

  } catch (error) {
    console.error('[Brain] ❌ Critical error:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Avvia lo scheduler del Brain
 */
function start() {
  // Scoring + Actions ogni 6 ore (alle :30 per non confliggere con altri cron)
  // 00:30, 06:30, 12:30, 18:30
  cron.schedule('30 0,6,12,18 * * *', () => {
    console.log('[Brain] ⏰ Scheduled Brain cycle triggered');
    runBrainCycle();
  });

  console.log('[Brain] 🧠 Scheduler started - running every 6 hours at :30');

  // Prima esecuzione 2 minuti dopo startup
  setTimeout(() => {
    console.log('[Brain] 🧠 Initial Brain cycle after startup');
    runBrainCycle();
  }, 2 * 60 * 1000);
}

/**
 * Esegui ciclo manualmente (per API o testing)
 */
async function runNow() {
  console.log('[Brain] Manual run triggered');
  await runBrainCycle();
}

/**
 * Hook per analizzare messaggi in real-time
 * Da chiamare in processMessage() dopo aver salvato il messaggio user
 */
async function analyzeMessage(tenantId, phone, text) {
  if (!db) return null;
  try {
    return await analyzer.processAndSave(tenantId, phone, text, db);
  } catch (err) {
    console.error('[Brain] Analyzer error:', err.message);
    return null;
  }
}

/**
 * API: Overview per il dashboard
 */
async function getOverview(tenantId) {
  if (!db) return null;

  const [scoringOverview, signalStats, actionStats, atRiskClients, allScores, recentActions] = await Promise.all([
    scoring.getScoringOverview(tenantId, db),
    analyzer.getSignalStats(tenantId, db, 30),
    actions.getActionStats(tenantId, db, 30),
    scoring.getAtRiskClients(tenantId, db, 0.6),
    scoring.getAllClientScores(tenantId, db),
    actions.getRecentActions(tenantId, db, 30)
  ]);

  return {
    scoring: scoringOverview,
    signals: signalStats,
    actions: actionStats,
    atRiskClients,
    allScores,
    recentActions
  };
}

/**
 * Stato del Brain
 */
function getStatus() {
  return {
    isRunning,
    initialized: !!(db && sendWhatsAppMessage),
  };
}

module.exports = {
  init,
  start,
  runNow,
  analyzeMessage,
  getOverview,
  getStatus,
  // Esporta anche i sotto-moduli per accesso diretto
  scoring,
  analyzer,
  actions
};
