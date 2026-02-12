/**
 * Template rendering for automation messages
 */

/**
 * Render a message template with variables
 * @param {string} template - Message template with {{variable}} placeholders
 * @param {object} variables - Key-value pairs to replace
 * @returns {string} - Rendered message
 */
function renderTemplate(template, variables = {}) {
  let message = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    message = message.replace(placeholder, value || '');
  }

  // Remove any unreplaced placeholders
  message = message.replace(/\{\{\s*\w+\s*\}\}/g, '');

  return message.trim();
}

/**
 * Get default variables for a client
 * @param {object} client - Client object
 * @param {object} tenant - Tenant object
 * @returns {object} - Default variables
 */
function getDefaultVariables(client, tenant) {
  return {
    client_name: client.name || 'Campione',
    gym_name: tenant.name || 'la palestra',
    coach_name: tenant.coach_name || 'Coach AI',
    phone: client.phone,
  };
}

/**
 * Default sequences for new tenants
 */
const defaultSequences = [
  {
    name: 'inactivity_3_days',
    trigger_type: 'inactivity',
    trigger_config: { days: 3 },
    message_template: 'Ciao {{client_name}}! Non ti vediamo da qualche giorno. Tutto bene? Il tuo prossimo allenamento ti aspetta! 💪',
  },
  {
    name: 'inactivity_7_days',
    trigger_type: 'inactivity',
    trigger_config: { days: 7 },
    message_template: 'Ehi {{client_name}}! È passata una settimana dal tuo ultimo check-in. Non mollare, ogni allenamento conta! 🏋️',
  },
  {
    name: 'inactivity_14_days',
    trigger_type: 'inactivity',
    trigger_config: { days: 14 },
    message_template: '{{client_name}}, sono passate due settimane! Mi manchi in palestra. Che ne dici di tornare questa settimana? 🎯',
  },
  {
    name: 'post_checkin',
    trigger_type: 'checkin',
    trigger_config: { delay_minutes: 60 },
    message_template: 'Grande {{client_name}}! Ottimo allenamento oggi! 🔥 Ricordati di idratarti e riposare bene.',
  },
  {
    name: 'streak_5',
    trigger_type: 'milestone',
    trigger_config: { streak: 5 },
    message_template: '🎉 WOW {{client_name}}! 5 giorni consecutivi in palestra! Sei una macchina! Continua così! 💪🔥',
  },
  {
    name: 'streak_10',
    trigger_type: 'milestone',
    trigger_config: { streak: 10 },
    message_template: '🏆 INCREDIBILE {{client_name}}! 10 giorni di streak! Sei tra i TOP 10% dei nostri membri più costanti! 🌟',
  },
  {
    name: 'streak_20',
    trigger_type: 'milestone',
    trigger_config: { streak: 20 },
    message_template: '🥇 LEGGENDA {{client_name}}! 20 giorni consecutivi! Passa in reception per il tuo premio speciale! 🎁',
  },
];

module.exports = {
  renderTemplate,
  getDefaultVariables,
  defaultSequences,
};
