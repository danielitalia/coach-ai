const fs = require('fs');
const path = '/opt/coach-ai/backend/src/brain/scoring.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Modifica daysSinceLastCheckin
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const daysSinceLastCheckin = lastCheckin')) {
    // Cerchiamo la riga col 999 che dovrebbe essere 2 righe dopo
    if (lines[i+2] && lines[i+2].includes(': 999;')) {
      lines[i+2] = lines[i+2].replace(': 999;', ': null;');
      console.log('Modified daysSinceLastCheckin at line', i+3);
    }
  }
  
  if (lines[i].includes('// Fattore 1: Inattività (peso 0.35)')) {
    lines[i+1] = '  if (daysSinceLastCheckin !== null) {';
    lines[i+2] = '    if (daysSinceLastCheckin > 30) churnRisk += 0.35;';
    lines[i+3] = '    else if (daysSinceLastCheckin > 14) churnRisk += 0.25;';
    lines[i+4] = '    else if (daysSinceLastCheckin > 7) churnRisk += 0.15;';
    lines[i+5] = '    else if (daysSinceLastCheckin > 3) churnRisk += 0.05;';
    lines[i+6] = '  } else {';
    lines[i+7] = '    churnRisk += 0.10; // Peso base minimo se mancano dati';
    lines[i+8] = '  }';
    console.log('Modified Factor 1 at line', i+1);
  }

  if (lines[i].includes('// Fattore 4: Nessun messaggio recente (peso 0.10)')) {
    lines[i+1] = '  const daysSinceLastMessage = userMessages.length > 0';
    lines[i+2] = '    ? Math.floor((now - new Date(userMessages[0].created_at)) / (1000 * 60 * 60 * 24))';
    lines[i+3] = '    : null;';
    lines[i+4] = '';
    lines[i+5] = '  const msgWeight = daysSinceLastCheckin === null ? 0.30 : 0.10;';
    lines[i+6] = '  if (daysSinceLastMessage === null || daysSinceLastMessage > 14) churnRisk += msgWeight;';
    lines[i+7] = '  else if (daysSinceLastMessage > 7) churnRisk += msgWeight / 2;';
    console.log('Modified Factor 4 at line', i+1);
  }
}

let content = lines.join('\n');
content = content.replace(/daysSinceLastCheckin,(\s*daysSinceLastMessage,)/g, 'daysSinceLastCheckin: daysSinceLastCheckin === null ? 999 : daysSinceLastCheckin,$1');
content = content.replace(/daysSinceLastMessage,(\s*totalCheckins30d,)/g, 'daysSinceLastMessage: daysSinceLastMessage === null ? 999 : daysSinceLastMessage,$1');
content = content.replace(/inactivity: daysSinceLastCheckin,/g, 'inactivity: daysSinceLastCheckin === null ? 999 : daysSinceLastCheckin,');
content = content.replace(/messageSilence: daysSinceLastMessage,/g, 'messageSilence: daysSinceLastMessage === null ? 999 : daysSinceLastMessage,');

fs.writeFileSync(path, content);
