/**
 * Milestone celebration handler
 * Sends congratulatory messages for check-in streaks
 */

const { renderTemplate, getDefaultVariables } = require('../templates');

/**
 * Process milestone celebrations for a tenant
 * @param {object} tenant - Tenant object
 * @param {object} db - Database module
 * @param {function} sendMessage - WhatsApp send function
 */
async function process(tenant, db, sendMessage) {
  console.log(`[Milestone] Processing tenant: ${tenant.name}`);

  // Get enabled milestone sequences for this tenant
  const sequences = await db.getAutomationSequences(tenant.id, 'milestone');

  // Get all clients with recent activity (last 7 days)
  const activeClients = await db.getActiveClients(tenant.id, 7);
  console.log(`[Milestone] Checking ${activeClients.length} active clients for milestones`);

  for (const client of activeClients) {
    // Get client's current streak
    const streakInfo = await db.getCheckinStreak(tenant.id, client.phone);
    const currentStreak = streakInfo?.current_streak || 0;

    if (currentStreak < 5) continue; // No milestone under 5 days

    // Check each milestone sequence
    for (const sequence of sequences) {
      if (!sequence.is_enabled) continue;

      const requiredStreak = sequence.trigger_config.streak;

      // Check if client just hit this milestone (streak matches exactly)
      if (currentStreak !== requiredStreak) continue;

      const triggerKey = `milestone:streak:${requiredStreak}:${client.phone}`;

      // Check if already celebrated this milestone
      const alreadyCelebrated = await db.hasAutomationJobByKey(tenant.id, triggerKey);

      if (alreadyCelebrated) {
        console.log(`[Milestone] Skipping ${client.phone} - already celebrated ${requiredStreak}-day streak`);
        continue;
      }

      // Render message
      const variables = {
        ...getDefaultVariables(client, tenant),
        streak: currentStreak,
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
          trigger_type: 'milestone',
          trigger_key: triggerKey,
          status: 'sent',
          message_sent: message,
        });

        console.log(`[Milestone] ✓ Celebrated ${requiredStreak}-day streak for ${client.phone}`);

        // Rate limiting
        await sleep(2000);

      } catch (error) {
        console.error(`[Milestone] ✗ Failed to celebrate milestone for ${client.phone}:`, error.message);

        await db.createAutomationJob({
          tenant_id: tenant.id,
          sequence_id: sequence.id,
          phone: client.phone,
          trigger_type: 'milestone',
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
