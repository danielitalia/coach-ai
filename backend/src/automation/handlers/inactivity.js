/**
 * Inactivity reminder handler
 * Sends reminders to clients who haven't checked in for X days
 */

const { renderTemplate, getDefaultVariables } = require('../templates');

/**
 * Process inactivity reminders for a tenant
 * @param {object} tenant - Tenant object
 * @param {object} db - Database module
 * @param {function} sendMessage - WhatsApp send function
 */
async function process(tenant, db, sendMessage) {
  console.log(`[Inactivity] Processing tenant: ${tenant.name}`);

  // Get enabled inactivity sequences for this tenant
  const sequences = await db.getAutomationSequences(tenant.id, 'inactivity');

  for (const sequence of sequences) {
    if (!sequence.is_enabled) continue;

    const { days } = sequence.trigger_config;
    console.log(`[Inactivity] Checking ${days}-day inactivity...`);

    // Get clients inactive for exactly this many days (with 1-day window)
    const inactiveClients = await db.getInactiveClients(tenant.id, days);
    console.log(`[Inactivity] Found ${inactiveClients.length} clients inactive ${days}+ days`);

    for (const client of inactiveClients) {
      const triggerKey = `inactivity:${days}`;

      // Check if already sent this reminder in last 30 days
      const alreadySent = await db.hasRecentAutomationJob(
        tenant.id,
        client.phone,
        triggerKey,
        30 // days to look back
      );

      if (alreadySent) {
        console.log(`[Inactivity] Skipping ${client.phone} - already sent ${days}-day reminder`);
        continue;
      }

      // Render message
      const variables = {
        ...getDefaultVariables(client, tenant),
        days_inactive: days,
      };
      const message = renderTemplate(sequence.message_template, variables);

      // Send message
      try {
        await sendMessage(tenant.whatsapp_instance_name, client.phone, message);

        // Log successful job
        await db.createAutomationJob({
          tenant_id: tenant.id,
          sequence_id: sequence.id,
          phone: client.phone,
          trigger_type: 'inactivity',
          trigger_key: triggerKey,
          status: 'sent',
          message_sent: message,
        });

        // Also save as message in conversation (for history)
        await db.addMessage(tenant.id, client.phone, 'assistant', message, {
          isReminder: true,
        });

        console.log(`[Inactivity] ✓ Sent ${days}-day reminder to ${client.phone}`);

        // Rate limiting: wait 2 seconds between messages
        await sleep(2000);

      } catch (error) {
        console.error(`[Inactivity] ✗ Failed to send to ${client.phone}:`, error.message);

        // Log failed job
        await db.createAutomationJob({
          tenant_id: tenant.id,
          sequence_id: sequence.id,
          phone: client.phone,
          trigger_type: 'inactivity',
          trigger_key: triggerKey,
          status: 'failed',
          error_message: error.message,
        });
      }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { process };
