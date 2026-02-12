/**
 * Post-checkin followup handler
 * Sends motivational messages after gym check-ins
 */

const { renderTemplate, getDefaultVariables } = require('../templates');

/**
 * Process checkin followups for a tenant
 * @param {object} tenant - Tenant object
 * @param {object} db - Database module
 * @param {function} sendMessage - WhatsApp send function
 */
async function process(tenant, db, sendMessage) {
  console.log(`[Followup] Processing tenant: ${tenant.name}`);

  // Get enabled checkin sequences for this tenant
  const sequences = await db.getAutomationSequences(tenant.id, 'checkin');

  for (const sequence of sequences) {
    if (!sequence.is_enabled) continue;

    const delayMinutes = sequence.trigger_config.delay_minutes || 60;
    console.log(`[Followup] Checking check-ins from ${delayMinutes} minutes ago...`);

    // Get check-ins that happened delayMinutes ago (with 5-minute window)
    const checkins = await db.getCheckinsForFollowup(tenant.id, delayMinutes);
    console.log(`[Followup] Found ${checkins.length} check-ins to follow up`);

    for (const checkin of checkins) {
      const triggerKey = `checkin:${checkin.id}`;

      // Check if already sent followup for this check-in
      const alreadySent = await db.hasAutomationJobByKey(tenant.id, triggerKey);

      if (alreadySent) {
        console.log(`[Followup] Skipping checkin ${checkin.id} - already followed up`);
        continue;
      }

      // Get client info
      const client = await db.getClientByPhone(tenant.id, checkin.phone);
      if (!client) continue;

      // Render message
      const variables = {
        ...getDefaultVariables(client, tenant),
        workout_day: checkin.workout_day || 'oggi',
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
          trigger_type: 'checkin',
          trigger_key: triggerKey,
          status: 'sent',
          message_sent: message,
        });

        console.log(`[Followup] ✓ Sent followup to ${client.phone} for checkin ${checkin.id}`);

        // Rate limiting
        await sleep(2000);

      } catch (error) {
        console.error(`[Followup] ✗ Failed to send followup to ${client.phone}:`, error.message);

        await db.createAutomationJob({
          tenant_id: tenant.id,
          sequence_id: sequence.id,
          phone: client.phone,
          trigger_type: 'checkin',
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
