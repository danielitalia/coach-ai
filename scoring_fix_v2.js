const fs = require('fs');
const path = '/opt/coach-ai/backend/src/brain/scoring.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Modifica daysSinceLastCheckin (linea 94 circa)
content = content.replace(/: 999;(\s*\/\/ --- Check-in ultimi 30 giorni ---)/, ': null;$1');

// 2. Modifica Fattore 1: Churn Risk
const factor1Old = `  // Fattore 1: Inattività (peso 0.35)
  if (daysSinceLastCheckin > 30) churnRisk += 0.35;
  else if (daysSinceLastCheckin > 14) churnRisk += 0.25;
  else if (daysSinceLastCheckin > 7) churnRisk += 0.15;
  else if (daysSinceLastCheckin > 3) churnRisk += 0.05;`;

const factor1New = `  // Fattore 1: Inattività (peso 0.35)
  if (daysSinceLastCheckin !== null) {
    if (daysSinceLastCheckin > 30) churnRisk += 0.35;
    else if (daysSinceLastCheckin > 14) churnRisk += 0.25;
    else if (daysSinceLastCheckin > 7) churnRisk += 0.15;
    else if (daysSinceLastCheckin > 3) churnRisk += 0.05;
  } else {
    churnRisk += 0.10; // Peso base minimo se mancano dati
  }`;

if (content.includes('// Fattore 1: Inattività (peso 0.35)')) {
  content = content.replace(factor1Old, factor1New);
}

// 3. Modifica Fattore 4: Messaggi
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

if (content.includes('// Fattore 4: Nessun messaggio recente (peso 0.10)')) {
  content = content.replace(factor4Old, factor4New);
}

// 4. Update JSON scoring_data
content = content.replace(/daysSinceLastCheckin,(\s*daysSinceLastMessage,)/, 'daysSinceLastCheckin: daysSinceLastCheckin === null ? 999 : daysSinceLastCheckin,$1');
content = content.replace(/daysSinceLastMessage,(\s*totalCheckins30d,)/, 'daysSinceLastMessage: daysSinceLastMessage === null ? 999 : daysSinceLastMessage,$1');
content = content.replace(/inactivity: daysSinceLastCheckin,/, 'inactivity: daysSinceLastCheckin === null ? 999 : daysSinceLastCheckin,');
content = content.replace(/messageSilence: daysSinceLastMessage,/, 'messageSilence: daysSinceLastMessage === null ? 999 : daysSinceLastMessage,');

fs.writeFileSync(path, content);
