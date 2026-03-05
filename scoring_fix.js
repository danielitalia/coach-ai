const fs = require('fs');
const path = '/opt/coach-ai/backend/src/brain/scoring.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Modifica default daysSinceLastCheckin da 999 a null
content = content.replace(
  'const daysSinceLastCheckin = lastCheckin\n    ? Math.floor((now - lastCheckin) / (1000 * 60 * 60 * 24))\n    : 999;',
  'const daysSinceLastCheckin = lastCheckin\n    ? Math.floor((now - lastCheckin) / (1000 * 60 * 60 * 24))\n    : null;'
);

// 2. Modifica logica Churn Risk per pesare di più i messaggi se mancano check-in
const churnRiskOld = `  // Fattore 1: Inattività (peso 0.35)
  if (daysSinceLastCheckin > 30) churnRisk += 0.35;
  else if (daysSinceLastCheckin > 14) churnRisk += 0.25;
  else if (daysSinceLastCheckin > 7) churnRisk += 0.15;
  else if (daysSinceLastCheckin > 3) churnRisk += 0.05;`;

const churnRiskNew = `  // Fattore 1: Inattività (peso 0.35)
  if (daysSinceLastCheckin !== null) {
    if (daysSinceLastCheckin > 30) churnRisk += 0.35;
    else if (daysSinceLastCheckin > 14) churnRisk += 0.25;
    else if (daysSinceLastCheckin > 7) churnRisk += 0.15;
    else if (daysSinceLastCheckin > 3) churnRisk += 0.05;
  } else {
    // Se non ci sono check-in mai registrati, non puniamo troppo l'inattività fisica
    // ma diamo un piccolo peso base (0.10) per incentivare l'uso dei check-in in futuro
    churnRisk += 0.10;
  }`;

content = content.replace(churnRiskOld, churnRiskNew);

// 3. Modifica peso messaggi (Fattore 4) per avere più impatto se mancano check-in
const factor4Old = `  // Fattore 4: Nessun messaggio recente (peso 0.10)
  const daysSinceLastMessage = userMessages.length > 0
    ? Math.floor((now - new Date(userMessages[0].created_at)) / (1000 * 60 * 60 * 24))
    : 999;
  if (daysSinceLastMessage > 14) churnRisk += 0.10;
  else if (daysSinceLastMessage > 7) churnRisk += 0.05;`;

const factor4New = `  // Fattore 4: Nessun messaggio recente (peso 0.10 o 0.30 se mancano check-in)
  const daysSinceLastMessage = userMessages.length > 0
    ? Math.floor((now - new Date(userMessages[0].created_at)) / (1000 * 60 * 60 * 24))
    : null;

  const msgWeight = daysSinceLastCheckin === null ? 0.30 : 0.10;
  if (daysSinceLastMessage === null || daysSinceLastMessage > 14) churnRisk += msgWeight;
  else if (daysSinceLastMessage > 7) churnRisk += msgWeight / 2;`;

content = content.replace(factor4Old, factor4New);

// 4. Update JSON scoring_data to handle nulls
content = content.replace('daysSinceLastMessage: daysSinceLastMessage,', 'daysSinceLastMessage: daysSinceLastMessage || 999,');
content = content.replace('messageSilence: daysSinceLastMessage', 'messageSilence: daysSinceLastMessage || 999');

fs.writeFileSync(path, content);
