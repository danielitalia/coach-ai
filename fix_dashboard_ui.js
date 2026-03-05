const fs = require('fs');
const path = '/opt/coach-ai/dashboard/src/components/BrainInsights.jsx';
let content = fs.readFileSync(path, 'utf8');

const oldLine = '{client.days_since_last_checkin}gg inattivo';
const newLine = '{client.days_since_last_checkin === null || client.days_since_last_checkin >= 999 ? "Nessun check-in" : `${client.days_since_last_checkin}gg inattivo`}';

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  fs.writeFileSync(path, content);
  console.log('UI updated successfully');
} else {
  console.log('Target line not found or already updated');
}
