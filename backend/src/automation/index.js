/**
 * Marketing Automation Scheduler
 * Runs automated WhatsApp campaigns based on client behavior
 */

const cron = require('node-cron');
const inactivityHandler = require('./handlers/inactivity');
const followupsHandler = require('./handlers/followups');
const milestonesHandler = require('./handlers/milestones');

let db = null;
let sendWhatsAppMessage = null;
let isRunning = false;

/**
 * Initialize the automation module
 * @param {object} database - Database module
 * @param {function} sendMessage - WhatsApp message send function
 */
function init(database, sendMessage) {
  db = database;
  sendWhatsAppMessage = sendMessage;
  console.log('[Automation] Module initialized');
}

/**
 * Run all automation handlers for all tenants
 */
async function runAutomations() {
  if (!db || !sendWhatsAppMessage) {
    console.error('[Automation] Module not initialized');
    return;
  }

  if (isRunning) {
    console.log('[Automation] Previous run still in progress, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  console.log('[Automation] ====== Starting automation cycle ======');

  try {
    // Get all active tenants
    const tenants = await db.getAllActiveTenants();
    console.log(`[Automation] Processing ${tenants.length} active tenants`);

    for (const tenant of tenants) {
      // Skip tenants without WhatsApp connected
      if (!tenant.whatsapp_instance_name) {
        console.log(`[Automation] Skipping ${tenant.name} - no WhatsApp instance`);
        continue;
      }

      console.log(`[Automation] --- Processing: ${tenant.name} ---`);

      try {
        // Run all handlers for this tenant
        await inactivityHandler.process(tenant, db, sendWhatsAppMessage);
        await followupsHandler.process(tenant, db, sendWhatsAppMessage);
        await milestonesHandler.process(tenant, db, sendWhatsAppMessage);
      } catch (error) {
        console.error(`[Automation] Error processing tenant ${tenant.name}:`, error);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Automation] ====== Cycle completed in ${duration}s ======`);

  } catch (error) {
    console.error('[Automation] Critical error in automation cycle:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the automation scheduler
 */
function start() {
  // Run every hour at minute 5 (e.g., 10:05, 11:05, 12:05)
  // This avoids conflicts with other scheduled tasks that often run at :00
  cron.schedule('5 * * * *', () => {
    console.log('[Automation] Scheduled run triggered');
    runAutomations();
  });

  console.log('[Automation] Scheduler started - running hourly at :05');

  // Initial run 1 minute after startup (to allow database connections to stabilize)
  setTimeout(() => {
    console.log('[Automation] Initial run after startup');
    runAutomations();
  }, 60 * 1000);
}

/**
 * Run automations manually (for testing or API trigger)
 */
async function runNow() {
  console.log('[Automation] Manual run triggered');
  await runAutomations();
}

/**
 * Get automation status
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
  getStatus,
};
