const fs = require('fs');
const path = '/opt/coach-ai/backend/src/brain/scoring.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Line 94 (0-indexed 93) is ": 999;"
if (lines[93].includes(': 999;')) {
  lines[93] = lines[93].replace(': 999;', ': null;');
  console.log('Fixed line 94');
} else {
  console.log('Line 94 does not match:', lines[93]);
}

// Factor 1 starts at 176 (index 175)
if (lines[175].includes('Fattore 1')) {
  lines.splice(176, 5, 
    '  if (daysSinceLastCheckin !== null) {',
    '    if (daysSinceLastCheckin > 30) churnRisk += 0.35;',
    '    else if (daysSinceLastCheckin > 14) churnRisk += 0.25;',
    '    else if (daysSinceLastCheckin > 7) churnRisk += 0.15;',
    '    else if (daysSinceLastCheckin > 3) churnRisk += 0.05;',
    '  } else {',
    '    churnRisk += 0.10;',
    '  }'
  );
  console.log('Fixed Factor 1');
} else {
  console.log('Line 176 does not match:', lines[175]);
}

// Factor 4 starts at line 190 (now shifted by the splice above, but let's re-grep index)
// Splice added 3 lines (replaced 5 with 8)
let f4Index = lines.findIndex(l => l.includes('Fattore 4'));
if (f4Index !== -1) {
  lines.splice(f4Index + 1, 5,
    '  const daysSinceLastMessage = userMessages.length > 0',
    '    ? Math.floor((now - new Date(userMessages[0].created_at)) / (1000 * 60 * 60 * 24))',
    '    : null;',
    '',
    '  const msgWeight = daysSinceLastCheckin === null ? 0.30 : 0.10;',
    '  if (daysSinceLastMessage === null || daysSinceLastMessage > 14) churnRisk += msgWeight;',
    '  else if (daysSinceLastMessage > 7) churnRisk += msgWeight / 2;'
  );
  console.log('Fixed Factor 4');
}

let content = lines.join('\n');
// Global replacements for JSON data
content = content.replace(/daysSinceLastCheckin,(\s*daysSinceLastMessage,)/g, 'daysSinceLastCheckin: daysSinceLastCheckin === null ? 999 : daysSinceLastCheckin,$1');
content = content.replace(/daysSinceLastMessage,(\s*totalCheckins30d,)/g, 'daysSinceLastMessage: daysSinceLastMessage === null ? 999 : daysSinceLastMessage,$1');
content = content.replace(/inactivity: daysSinceLastCheckin,/g, 'inactivity: daysSinceLastCheckin === null ? 999 : daysSinceLastCheckin,');
content = content.replace(/messageSilence: daysSinceLastMessage,/g, 'messageSilence: daysSinceLastMessage === null ? 999 : daysSinceLastMessage,');

fs.writeFileSync(path, content);
