const fs = require('fs');
const path = '/opt/coach-ai/backend/src/brain/scoring.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Modifica daysSinceLastCheckin
content = content.replace(/(const daysSinceLastCheckin\s*=\s*lastCheckin\s*\?\s*Math\.floor\(\(now\s*-\s*lastCheckin\)\s*\/\s*\(1000\s*\*\s*60\s*\*\s*60\s*\*\s*24\)\)\s*:\s*)999;/, '$1null;');

// 2. Modifica Fattore 1
const f1Old = /\/\/ Fattore 1: Inattività \(peso 0\.35\)[\s\S]*?if \(daysSinceLastCheckin > 30\) churnRisk \+= 0\.35;[\s\S]*?else if \(daysSinceLastCheckin > 14\) churnRisk \+= 0\.25;[\s\S]*?else if \(daysSinceLastCheckin > 7\) churnRisk \+= 0\.15;[\s\S]*?else if \(daysSinceLastCheckin > 3\) churnRisk \+= 0\.05;/;
const f1New = `// Fattore 1: Inattività (peso 0.35)
  if (daysSinceLastCheckin !== null) {
    if (daysSinceLastCheckin > 30) churnRisk += 0.35;
    else if (daysSinceLastCheckin > 14) churnRisk += 0.25;
    else if (daysSinceLastCheckin > 7) churnRisk += 0.15;
    else if (daysSinceLastCheckin > 3) churnRisk += 0.05;
  } else {
    churnRisk += 0.10;
  }`;
content = content.replace(f1Old, f1New);

// 3. Modifica Fattore 4
const f4Old = /\/\/ Fattore 4: Nessun messaggio recente \(peso 0\.10\)[\s\S]*?const daysSinceLastMessage = userMessages\.length > 0[\s\S]*?\? Math\.floor\(\(now - new Date\(userMessages\[0\]\.created_at\)\) \/ \(1000 \* 60 \* 60 \* 24\)\)[\s\S]*?: 999;[\s\S]*?if \(daysSinceLastMessage > 14\) churnRisk \+= 0\.10;[\s\S]*?else if \(daysSinceLastMessage > 7\) churnRisk \+= 0\.05;/;
const f4New = `// Fattore 4: Nessun messaggio recente (peso 0.10 o 0.30 se mancano check-in)
  const daysSinceLastMessage = userMessages.length > 0
    ? Math.floor((now - new Date(userMessages[0].created_at)) / (1000 * 60 * 60 * 24))
    : null;

  const msgWeight = daysSinceLastCheckin === null ? 0.30 : 0.10;
  if (daysSinceLastMessage === null || daysSinceLastMessage > 14) churnRisk += msgWeight;
  else if (daysSinceLastMessage > 7) churnRisk += msgWeight / 2;`;
content = content.replace(f4Old, f4New);

// 4. Update JSON
content = content.replace(/daysSinceLastCheckin,(\s*daysSinceLastMessage,)/g, 'daysSinceLastCheckin: daysSinceLastCheckin === null ? 999 : daysSinceLastCheckin,$1');
content = content.replace(/daysSinceLastMessage,(\s*totalCheckins30d,)/g, 'daysSinceLastMessage: daysSinceLastMessage === null ? 999 : daysSinceLastMessage,$1');
content = content.replace(/inactivity: daysSinceLastCheckin,/g, 'inactivity: daysSinceLastCheckin === null ? 999 : daysSinceLastCheckin,');
content = content.replace(/messageSilence: daysSinceLastMessage,/g, 'messageSilence: daysSinceLastMessage === null ? 999 : daysSinceLastMessage,');

fs.writeFileSync(path, content);
console.log('Patch V4 applied');
