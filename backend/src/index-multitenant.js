const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database Multi-tenant
const db = require('../db/database-multitenant');

// Auth routes
const authRoutes = require('./routes/auth');
const tenantRoutes = require('./routes/tenants');
const { requireTenant, identifyTenantFromWhatsApp } = require('./middleware/auth');

// Marketing Automation
const automation = require('./automation');

// Monitoring System
const MonitoringSystem = require('./monitoring');

// Directory per salvare i PDF delle schede
const WORKOUTS_DIR = path.join(__dirname, '../workouts');
if (!fs.existsSync(WORKOUTS_DIR)) {
  fs.mkdirSync(WORKOUTS_DIR, { recursive: true });
}

const app = express();
app.use(express.json());

// CORS per dashboard
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Tenant-Id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// AI Client - Supporta OpenAI, Groq, e Anthropic Claude
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4-20250514';

let aiClient;
let useAnthropic = false;

if (AI_PROVIDER === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
  // Usa Anthropic Claude
  aiClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  useAnthropic = true;
  console.log(`AI Provider: Anthropic Claude (${AI_MODEL})`);
} else {
  // Usa OpenAI-compatible API (OpenAI, Groq, Ollama)
  const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'http://host.docker.internal:11434/v1';
  const AI_API_KEY = process.env.OPENAI_API_KEY || 'ollama';
  aiClient = new OpenAI({
    baseURL: AI_BASE_URL,
    apiKey: AI_API_KEY,
    timeout: 60000,
  });
  console.log(`AI Provider: ${AI_BASE_URL.includes('ollama') || AI_BASE_URL.includes('11434') ? 'Ollama (local)' : 'OpenAI API'}`);
}

// Alias per compatibilità
const openai = aiClient;

// Evolution API config
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// ========== AUTH ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);

// ========== SCHEDA WEB (Link pubblico) ==========
app.get('/scheda/:workoutId', async (req, res) => {
  try {
    const { workoutId } = req.params;

    // Recupera la scheda dal database
    const workout = await db.getWorkoutPlanById(workoutId);
    if (!workout) {
      return res.status(404).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Scheda non trovata</h1>
            <p>Questa scheda potrebbe essere stata eliminata o il link non è valido.</p>
          </body>
        </html>
      `);
    }

    // Recupera info tenant
    const tenant = await db.getTenant(workout.tenant_id);
    const gymName = tenant?.name || 'Coach AI';
    const primaryColor = tenant?.primary_color || '#667eea';

    // Leggi il template
    const templatePath = path.join(__dirname, 'templates', 'workout-template.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Genera HTML per i giorni di allenamento
    let workoutDaysHtml = '';

    // La colonna si chiama 'workouts' (array di giorni)
    const workoutsArray = typeof workout.workouts === 'string'
      ? JSON.parse(workout.workouts)
      : workout.workouts;

    if (workoutsArray && workoutsArray.length > 0) {
      workoutsArray.forEach((day, index) => {
        const dayIcons = ['🏋️', '💪', '🔥', '⚡', '🎯', '🚀', '💥'];
        const icon = dayIcons[index % dayIcons.length];

        workoutDaysHtml += `
          <div class="day-card">
            <div class="day-header">
              <span class="icon">${icon}</span>
              ${day.name || 'Giorno ' + (index + 1)}
            </div>
            <div class="exercises">
        `;

        if (day.exercises && day.exercises.length > 0) {
          day.exercises.forEach(ex => {
            workoutDaysHtml += `
              <div class="exercise">
                <span class="exercise-name">${ex.name || ex}</span>
                <div class="exercise-details">
                  ${ex.sets ? `<span class="exercise-badge">${ex.sets}x${ex.reps || '?'}</span>` : ''}
                  ${ex.rest ? `<span class="exercise-badge">${ex.rest}</span>` : ''}
                </div>
              </div>
            `;
          });
        }

        workoutDaysHtml += `
            </div>
          </div>
        `;
      });
    }

    // Sostituisci i placeholder
    template = template
      .replace(/\{\{gymName\}\}/g, gymName)
      .replace(/\{\{primaryColor\}\}/g, primaryColor)
      .replace(/\{\{clientName\}\}/g, workout.client_name || 'Atleta')
      .replace(/\{\{objective\}\}/g, workout.objective || 'Fitness generale')
      .replace(/\{\{experience\}\}/g, workout.experience || 'Intermedio')
      .replace(/\{\{daysPerWeek\}\}/g, workout.days_per_week || '3')
      .replace(/\{\{workoutDays\}\}/g, workoutDaysHtml)
      .replace(/\{\{date\}\}/g, new Date(workout.created_at).toLocaleDateString('it-IT'));

    res.send(template);
  } catch (error) {
    console.error('Errore visualizzazione scheda:', error);
    res.status(500).send('Errore nel caricamento della scheda');
  }
});

// ========== FUNZIONI HELPER ==========

// Genera system prompt per tenant specifico
function getSystemPrompt(tenant) {
  const coachName = tenant?.coach_name || 'Coach AI';
  const gymName = tenant?.name || 'la palestra';
  const useEmoji = tenant?.use_emoji !== false;

  let prompt = `Sei un personal trainer virtuale amichevole e motivante.
Il tuo nome è ${coachName} e lavori per ${gymName}.

Le tue responsabilità:
1. Accogliere nuovi clienti e fare un questionario iniziale
2. Creare schede di allenamento personalizzate
3. Motivare i clienti a venire in palestra
4. Rispondere a domande su esercizi e alimentazione
5. Monitorare la costanza e riattivare chi molla

Stile di comunicazione:
- Amichevole ma professionale
- Usa emoji con moderazione (1-2 per messaggio)
- Messaggi brevi e chiari
- Sempre positivo e motivante

Quando un nuovo cliente scrive per la prima volta, fai queste domande UNA ALLA VOLTA:
1. Nome
2. Obiettivo (dimagrire/tonificare/massa muscolare/salute generale)
3. Esperienza in palestra (principiante/intermedio/esperto)
4. Giorni disponibili per allenarsi (2/3/4/5)
5. Problemi fisici o limitazioni

FORMATO SCHEDA ALLENAMENTO (OBBLIGATORIO):
Quando generi una scheda, usa SEMPRE questo formato esatto per ogni esercizio:
- Nome Esercizio: 3x12 (60s)
Dove 3 = serie, 12 = ripetizioni, 60s = recupero.

Esempio corretto:
**Giorno 1 - Petto e Tricipiti**
- Panca Piana: 4x10 (90s)
- Croci ai Cavi: 3x12 (60s)
- French Press: 3x12 (60s)

NON scrivere mai "3 serie di 12 ripetizioni", usa SEMPRE il formato "3x12 (60s)".`;

  if (!useEmoji) {
    prompt += '\n\nIMPORTANTE: Non usare emoji nelle risposte.';
  }

  if (tenant?.custom_system_prompt) {
    prompt += '\n\n' + tenant.custom_system_prompt;
  }

  return prompt;
}

// Invia messaggio WhatsApp (Evolution API v2.x format)
async function sendWhatsAppMessage(instanceName, phoneNumber, message) {
  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        number: phoneNumber,
        text: message
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        }
      }
    );
    console.log('Messaggio inviato a', phoneNumber);
    return response.data;
  } catch (error) {
    console.error('Errore invio messaggio:', error.response?.data || error.message);
    throw error;
  }
}

// Invia documento PDF WhatsApp (Evolution API v2.x format)
async function sendWhatsAppDocument(instanceName, phoneNumber, pdfBuffer, fileName, caption) {
  try {
    const base64PDF = pdfBuffer.toString('base64');

    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      {
        number: phoneNumber,
        mediatype: 'document',
        mimetype: 'application/pdf',
        caption: caption || '',
        media: base64PDF,
        fileName: fileName
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        }
      }
    );
    console.log('PDF inviato a', phoneNumber, '-', fileName);
    return response.data;
  } catch (error) {
    console.error('Errore invio PDF:', error.response?.data || error.message);
    throw error;
  }
}

// ========== GENERAZIONE PDF SCHEDA ==========

async function generateWorkoutPDF(tenant, client, workoutData) {
  // Protezione contro client null/undefined
  const safeClient = client || {};
  const clientName = safeClient.name || 'Cliente';

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Scheda Allenamento - ${clientName}`,
          Author: tenant?.name || 'Coach AI'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primaryColor = '#2563eb';
      const secondaryColor = '#64748b';
      const accentColor = '#10b981';

      // === HEADER ===
      doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);

      doc.fillColor('white')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text(tenant?.name || 'COACH AI', 50, 40);

      doc.fontSize(12)
         .font('Helvetica')
         .text('Scheda di Allenamento Personalizzata', 50, 75);

      // === INFO CLIENTE ===
      doc.fillColor('#1e293b')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text(clientName, 50, 150);

      doc.fontSize(11)
         .fillColor(secondaryColor)
         .font('Helvetica');

      const infoY = 175;
      const col1 = 50;
      const col2 = 250;

      doc.text(`Obiettivo: ${safeClient.objective || 'Non specificato'}`, col1, infoY);
      doc.text(`Esperienza: ${safeClient.experience || 'Non specificata'}`, col2, infoY);
      doc.text(`Giorni/settimana: ${safeClient.days_per_week || '3'}`, col1, infoY + 18);
      doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, col2, infoY + 18);

      if (client.limitations) {
        doc.text(`Note: ${client.limitations}`, col1, infoY + 36, { width: 450 });
      }

      // === LINEA SEPARATRICE ===
      doc.moveTo(50, 230).lineTo(545, 230).strokeColor('#e2e8f0').lineWidth(1).stroke();

      // === WORKOUT DAYS ===
      let yPos = 250;
      const pageHeight = doc.page.height - 80;

      for (const workout of workoutData) {
        // Controlla se serve nuova pagina
        if (yPos > pageHeight - 150) {
          doc.addPage();
          yPos = 50;
        }

        // Titolo giorno
        doc.rect(50, yPos, 495, 30).fill(primaryColor);
        doc.fillColor('white')
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(workout.day.toUpperCase(), 60, yPos + 9);

        yPos += 45;

        // Header tabella
        doc.fillColor(secondaryColor)
           .fontSize(9)
           .font('Helvetica-Bold');
        doc.text('ESERCIZIO', 55, yPos);
        doc.text('SERIE', 320, yPos);
        doc.text('RIPETIZIONI', 380, yPos);
        doc.text('RECUPERO', 470, yPos);

        yPos += 20;

        // Esercizi
        doc.font('Helvetica').fontSize(10);
        let rowIndex = 0;

        for (const exercise of workout.exercises) {
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 50;
          }

          // Riga alternata
          if (rowIndex % 2 === 0) {
            doc.rect(50, yPos - 5, 495, 22).fill('#f8fafc');
          }

          doc.fillColor('#1e293b');
          doc.text(exercise.name, 55, yPos, { width: 250 });
          doc.text(exercise.sets, 325, yPos);
          doc.text(exercise.reps, 385, yPos);
          doc.fillColor(accentColor);
          doc.text(exercise.rest, 475, yPos);

          yPos += 22;
          rowIndex++;
        }

        yPos += 25;
      }

      // === FOOTER ===
      const footerY = doc.page.height - 60;
      doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e2e8f0').lineWidth(1).stroke();

      doc.fillColor(secondaryColor)
         .fontSize(9)
         .font('Helvetica')
         .text(`Generato da ${tenant.coach_name || 'Coach AI'} - ${tenant.name || 'La tua palestra'}`, 50, footerY + 15);
      doc.text('Buon allenamento! 💪', 450, footerY + 15);

      // === NOTE FINALI ===
      if (yPos < pageHeight - 100) {
        yPos += 10;
        doc.rect(50, yPos, 495, 60).fill('#f0fdf4').stroke('#10b981');
        doc.fillColor('#166534')
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('💡 Consigli:', 60, yPos + 10);
        doc.font('Helvetica')
           .fontSize(9)
           .text('• Esegui sempre 5-10 minuti di riscaldamento prima di iniziare', 60, yPos + 25);
        doc.text('• Mantieni una corretta idratazione durante l\'allenamento', 60, yPos + 37);
        doc.text('• Se hai dubbi su un esercizio, chiedi al tuo Coach AI!', 60, yPos + 49);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Funzione per estrarre workout strutturato dalla risposta AI
function extractWorkoutFromAIResponse(aiResponse) {
  const workouts = [];

  // Split per giorni usando vari pattern
  const dayBlocks = aiResponse.split(/(?=\*\*Giorno|\*Giorno|Giorno\s*\d)/gi).filter(block =>
    block.toLowerCase().includes('giorno')
  );

  for (const block of dayBlocks) {
    // Estrai numero e titolo giorno
    const dayHeaderMatch = block.match(/\*?\*?Giorno\s*(\d+)[:\s\-–]*([^\n*]*)/i);
    if (!dayHeaderMatch) continue;

    const dayNum = dayHeaderMatch[1];
    const dayDesc = dayHeaderMatch[2]?.trim() || '';
    const dayTitle = dayDesc ? `Giorno ${dayNum} - ${dayDesc}` : `Giorno ${dayNum}`;

    const exercises = [];

    // Pattern multipli per catturare vari formati di esercizi
    const patterns = [
      // Formato: "- Panca Piana: 3x12 (60s)" o "* Panca Piana: 3x12 (60s)"
      /[-•*]\s*([^:\n]+?):\s*(\d+)\s*[xX]\s*([\d\-]+)\s*(?:\(([^)]+)\))?/g,
      // Formato: "- Panca Piana: 3 serie di 12 ripetizioni"
      /[-•*]\s*([^:\n]+?):\s*(\d+)\s*serie?\s*(?:di|x)?\s*(\d+[\d\-]*)\s*(?:ripetizioni?)?/gi,
      // Formato: "Panca Piana - 3x12"
      /([A-Za-zÀ-ú\s]+)\s*[-–:]\s*(\d+)\s*[xX]\s*([\d\-]+)/g,
      // Formato con numero: "1. Panca Piana: 3x12"
      /\d+\.\s*([^:\n]+?):\s*(\d+)\s*[xX]\s*([\d\-]+)/g
    ];

    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(block)) !== null) {
        const name = match[1]?.trim().replace(/\*\*/g, '').replace(/\*/g, '');
        const sets = match[2];
        const reps = match[3];
        const rest = match[4] || '60s';

        // Evita duplicati e nomi troppo lunghi/invalidi
        if (name && sets && reps &&
            name.length > 2 && name.length < 50 &&
            !exercises.find(e => e.name.toLowerCase() === name.toLowerCase()) &&
            !name.toLowerCase().includes('riscaldamento') &&
            !name.toLowerCase().includes('defaticamento') &&
            !name.toLowerCase().includes('stretching')) {
          exercises.push({ name, sets, reps, rest });
        }
      }
    }

    if (exercises.length > 0) {
      workouts.push({
        day: dayTitle.replace(/\*\*/g, '').replace(/\*/g, '').trim(),
        exercises
      });
    }
  }

  console.log(`[PDF Parser] Estratti ${workouts.length} giorni con esercizi`);
  return workouts;
}

// ========== WEBHOOK MULTI-TENANT ==========

app.post('/webhook', identifyTenantFromWhatsApp, async (req, res) => {
  try {
    const body = req.body;
    console.log('Webhook ricevuto:', JSON.stringify(body, null, 2));

    // Se non abbiamo un tenant, non possiamo processare
    if (!req.tenant) {
      console.log('Nessun tenant trovato per questo webhook');
      return res.json({ success: true, skipped: true });
    }

    const tenantId = req.tenantId;
    const tenant = req.tenant;
    const instanceName = tenant.whatsapp_instance_name || 'palestra';

    const event = body.event;

    if (event === 'messages.upsert') {
      const data = body.data;
      const messages = Array.isArray(data) ? data : [data];

      for (const msgData of messages) {
        const key = msgData.key || {};
        const messageContent = msgData.message || {};

        if (key.fromMe) continue;

        const remoteJid = key.remoteJid || '';

        // Numero per il database (per identificare il cliente)
        // Se è un LID, usiamo il LID stesso come identificatore
        let phoneNumber;
        // Numero per inviare la risposta WhatsApp
        let replyNumber;

        if (remoteJid.includes('@lid')) {
          // Per i LID, usiamo il remoteJid completo per rispondere
          // e il LID numerico per il database
          phoneNumber = remoteJid.replace('@lid', '');
          replyNumber = remoteJid; // Mantieni il formato completo @lid per la risposta
        } else {
          phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
          replyNumber = phoneNumber;
        }

        const text = messageContent.conversation ||
                     messageContent.extendedTextMessage?.text ||
                     msgData.body || '';

        if (!text || !phoneNumber) continue;

        console.log(`[${tenant.name}] Messaggio da ${phoneNumber}: ${text}`);

        // Aggiorna attività cliente nel DB
        await db.updateClientActivity(tenantId, phoneNumber);

        // Controlla comandi speciali
        const checkinKeywords = ['check-in', 'checkin', 'check in', 'sono in palestra', 'arrivo', 'eccomi', 'sono arrivato', 'sono arrivata', 'presente'];
        const isCheckin = checkinKeywords.some(keyword => text.toLowerCase().includes(keyword));

        const referralKeywords = ['invita', 'porta un amico', 'referral', 'codice amico', 'invita amico'];
        const isReferralRequest = referralKeywords.some(keyword => text.toLowerCase().includes(keyword));

        // Codice referral: esattamente 9 caratteri alfanumerici che contengono SIA lettere CHE numeri
        const referralCodeMatch = text.toUpperCase().match(/\b([A-Z0-9]{9})\b/);
        const hasLettersAndNumbers = referralCodeMatch &&
          /[A-Z]/.test(referralCodeMatch[1]) &&
          /[0-9]/.test(referralCodeMatch[1]);
        const isUsingReferralCode = hasLettersAndNumbers && !isReferralRequest;

        const rewardKeywords = ['premi', 'rewards', 'i miei premi', 'miei premi', 'bonus'];
        const isRewardRequest = rewardKeywords.some(keyword => text.toLowerCase().includes(keyword));

        let response;
        if (isCheckin) {
          response = await processCheckin(tenantId, tenant, phoneNumber);
        } else if (isReferralRequest) {
          response = await processReferralRequest(tenantId, phoneNumber);
        } else if (isUsingReferralCode) {
          response = await processReferralCode(tenantId, phoneNumber, referralCodeMatch[1]);
        } else if (isRewardRequest) {
          response = await processRewardRequest(tenantId, phoneNumber);
        } else {
          response = await processMessage(tenantId, tenant, phoneNumber, text);
        }

        // Usa replyNumber per rispondere (supporta sia numeri normali che LID)
        // Se response è null, il messaggio (link scheda) è già stato inviato
        if (response) {
          await sendWhatsAppMessage(instanceName, replyNumber, response);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Errore webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PROCESS MESSAGE ==========

async function processMessage(tenantId, tenant, phoneNumber, text) {
  try {
    await db.addMessage(tenantId, phoneNumber, 'user', text);

    const history = await db.getRecentMessages(tenantId, phoneNumber, 20);

    let aiResponse;

    if (useAnthropic) {
      // Usa Anthropic Claude API
      const messages = history.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const completion = await aiClient.messages.create({
        model: AI_MODEL,
        max_tokens: 1000,
        system: getSystemPrompt(tenant),
        messages: messages,
      });

      aiResponse = completion.content[0]?.text ||
        "Mi scusi, ho avuto un problema tecnico. Può ripetere?";
    } else {
      // Usa OpenAI-compatible API
      const completion = await aiClient.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: getSystemPrompt(tenant) },
          ...history.map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      aiResponse = completion.choices[0]?.message?.content ||
        "Mi scusi, ho avuto un problema tecnico. Può ripetere?";
    }

    await db.addMessage(tenantId, phoneNumber, 'assistant', aiResponse);

    // Detecta se la risposta contiene una scheda di allenamento completa
    const daysMatched = (aiResponse.match(/giorno\s*\d/gi) || []);
    console.log(`[PDF Debug] Risposta AI (primi 200 char): ${aiResponse.substring(0, 200)}`);
    console.log(`[PDF Debug] Giorni trovati: ${daysMatched.length}`, daysMatched);

    if (daysMatched.length >= 2) {
      console.log(`[PDF Debug] Avvio generazione PDF per ${phoneNumber}`);
      try {
        await detectAndSaveWorkoutPlan(tenantId, tenant, phoneNumber, aiResponse);
        console.log(`[PDF Debug] PDF generato con successo`);
        // Non ritornare il testo della scheda - il link viene già inviato da detectAndSaveWorkoutPlan
        return null; // Segnala che non serve inviare altro messaggio
      } catch (pdfErr) {
        console.error(`[PDF Debug] ERRORE generazione PDF:`, pdfErr);
        // Se fallisce la generazione del link, invia il testo normale
        return aiResponse;
      }
    } else {
      console.log(`[PDF Debug] Nessuna scheda rilevata, skip PDF`);
    }

    return aiResponse;
  } catch (error) {
    console.error('Errore AI DETTAGLIATO:', error.message);
    console.error('Stack:', error.stack);
    console.error('Full error:', JSON.stringify(error, null, 2));
    return "Ops! Ho avuto un problema tecnico. Riprova tra poco! 🙏";
  }
}

// ========== CHECK-IN ==========

async function processCheckin(tenantId, tenant, phoneNumber) {
  try {
    const todayCheckin = await db.getTodayCheckin(tenantId, phoneNumber);
    if (todayCheckin) {
      return `Hai già fatto check-in oggi alle ${new Date(todayCheckin.checked_in_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}! 💪\n\nBuon allenamento!`;
    }

    const client = await db.getClient(tenantId, phoneNumber);
    const clientName = client?.name || 'Campione';

    const workoutPlans = await db.getWorkoutPlansByPhone(tenantId, phoneNumber);
    const latestPlan = workoutPlans[0];

    let workoutDay = null;
    let workoutMessage = '';

    if (latestPlan) {
      const workouts = typeof latestPlan.workouts === 'string'
        ? JSON.parse(latestPlan.workouts)
        : latestPlan.workouts;

      const checkinStats = await db.getCheckinStats(tenantId, phoneNumber);
      const totalCheckins = parseInt(checkinStats?.total_checkins) || 0;
      const dayIndex = totalCheckins % workouts.length;
      const todayWorkout = workouts[dayIndex];
      workoutDay = todayWorkout.day;

      workoutMessage = `\n\n📋 *${todayWorkout.day}*\n`;
      todayWorkout.exercises.forEach((ex, i) => {
        workoutMessage += `${i + 1}. ${ex.name}: ${ex.sets}x${ex.reps} (${ex.rest})\n`;
      });
    }

    await db.addCheckin(tenantId, phoneNumber, workoutDay);

    // Completa referral se primo check-in
    const checkinStats = await db.getCheckinStats(tenantId, phoneNumber);
    const isFirstCheckin = parseInt(checkinStats?.total_checkins) === 1;

    let referralBonus = '';
    if (isFirstCheckin) {
      const completedReferral = await db.completeReferral(tenantId, phoneNumber);
      if (completedReferral) {
        const referrer = await db.getClient(tenantId, completedReferral.referrer_phone);
        referralBonus = `\n\n🎉 *Bonus sbloccato!*\nTu e ${referrer?.name || 'il tuo amico'} avete ricevuto un premio!\nScrivi "premi" per vedere il tuo bonus!`;

        const instanceName = tenant.whatsapp_instance_name || 'palestra';
        const referrerRewardMsg = `🎉 *Grande notizia!*\n\n${clientName} ha fatto il primo check-in!\n\nHai guadagnato una settimana gratuita! 🎁\nScrivi "premi" per vedere i dettagli.`;
        await sendWhatsAppMessage(instanceName, completedReferral.referrer_phone, referrerRewardMsg);
      }
    }

    const stats = await db.getCheckinStats(tenantId, phoneNumber);
    const streak = await db.getCheckinStreak(tenantId, phoneNumber);
    const thisMonth = parseInt(stats?.this_month) || 1;

    let message = `*Check-in registrato!* ✅\n\n`;
    message += `Ciao ${clientName}! 💪\n`;

    if (streak > 1) {
      message += `🔥 Streak: ${streak} giorni consecutivi!\n`;
    }
    message += `📊 Allenamenti questo mese: ${thisMonth}\n`;

    if (workoutMessage) {
      message += workoutMessage;
    } else {
      message += `\nNon hai ancora una scheda! Scrivi "voglio una scheda" per crearne una personalizzata.`;
    }

    message += referralBonus;
    message += `\n\n*Buon allenamento!* 🏋️`;

    await db.addMessage(tenantId, phoneNumber, 'user', 'check-in');
    await db.addMessage(tenantId, phoneNumber, 'assistant', message);

    return message;
  } catch (error) {
    console.error('Errore check-in:', error);
    return 'Check-in registrato! ✅ Buon allenamento! 💪';
  }
}

// ========== REFERRAL FUNCTIONS ==========

async function processReferralRequest(tenantId, phoneNumber) {
  try {
    const client = await db.getClient(tenantId, phoneNumber);
    const clientName = client?.name || 'Amico';

    const referralCode = await db.createReferralCode(tenantId, phoneNumber);
    const stats = await db.getReferralStats(tenantId, phoneNumber);
    const completed = parseInt(stats?.completed) || 0;

    let message = `🎁 *Programma Porta un Amico*\n\n`;
    message += `Ciao ${clientName}! Ecco il tuo codice personale:\n\n`;
    message += `📱 *${referralCode}*\n\n`;
    message += `*Come funziona:*\n`;
    message += `1️⃣ Condividi il codice con un amico\n`;
    message += `2️⃣ Il tuo amico scrive il codice in chat quando si iscrive\n`;
    message += `3️⃣ Quando fa il primo check-in, entrambi ricevete un premio!\n\n`;
    message += `🏆 *I tuoi inviti:* ${completed} amici portati\n`;

    if (completed > 0) {
      message += `\nScrivi "premi" per vedere i tuoi bonus! 🎉`;
    }

    await db.addMessage(tenantId, phoneNumber, 'user', 'richiesta codice referral');
    await db.addMessage(tenantId, phoneNumber, 'assistant', message);

    return message;
  } catch (error) {
    console.error('Errore referral request:', error);
    return 'Ops! Qualcosa è andato storto. Riprova tra poco! 🙏';
  }
}

async function processReferralCode(tenantId, phoneNumber, code) {
  try {
    const client = await db.getClient(tenantId, phoneNumber);
    const clientName = client?.name || 'Amico';

    const result = await db.useReferralCode(tenantId, code, phoneNumber);

    if (!result.success) {
      return `❌ ${result.error}\n\nSe hai un codice valido, scrivilo di nuovo!`;
    }

    const referrer = await db.getClient(tenantId, result.referrerPhone);
    const referrerName = referrer?.name || 'Un amico';

    let message = `🎉 *Codice accettato!*\n\n`;
    message += `Benvenuto ${clientName}!\n`;
    message += `Sei stato invitato da *${referrerName}*!\n\n`;
    message += `👉 Fai il tuo primo *check-in* in palestra e entrambi riceverete un premio speciale!\n\n`;
    message += `Scrivi "check-in" quando arrivi in palestra! 💪`;

    await db.addMessage(tenantId, phoneNumber, 'user', `codice referral: ${code}`);
    await db.addMessage(tenantId, phoneNumber, 'assistant', message);

    return message;
  } catch (error) {
    console.error('Errore uso codice referral:', error);
    return 'Ops! Qualcosa è andato storto. Riprova tra poco! 🙏';
  }
}

async function processRewardRequest(tenantId, phoneNumber) {
  try {
    const client = await db.getClient(tenantId, phoneNumber);
    const clientName = client?.name || 'Amico';

    const rewards = await db.getUnclaimedRewards(tenantId, phoneNumber);
    const allRewards = await db.getRewards(tenantId, phoneNumber);

    let message = `🏆 *I tuoi premi*\n\n`;
    message += `Ciao ${clientName}!\n\n`;

    if (rewards.length === 0) {
      message += `Non hai premi da riscuotere al momento.\n\n`;
      message += `💡 Invita un amico per guadagnare premi!\n`;
      message += `Scrivi "invita" per ottenere il tuo codice personale.`;
    } else {
      message += `*Premi disponibili:*\n`;
      rewards.forEach((reward) => {
        const emoji = reward.reward_type === 'free_week' ? '🎫' : '🎁';
        message += `${emoji} ${reward.description}\n`;
        if (reward.expires_at) {
          const expiresDate = new Date(reward.expires_at).toLocaleDateString('it-IT');
          message += `   ⏰ Scade il ${expiresDate}\n`;
        }
      });
      message += `\n📍 Mostra questo messaggio alla reception per riscuotere!`;
    }

    const referralStats = await db.getReferralStats(tenantId, phoneNumber);
    const totalInvites = parseInt(referralStats?.completed) || 0;

    message += `\n\n📊 *Le tue statistiche:*\n`;
    message += `• Amici invitati: ${totalInvites}\n`;
    message += `• Premi totali guadagnati: ${allRewards.length}`;

    await db.addMessage(tenantId, phoneNumber, 'user', 'richiesta premi');
    await db.addMessage(tenantId, phoneNumber, 'assistant', message);

    return message;
  } catch (error) {
    console.error('Errore reward request:', error);
    return 'Ops! Qualcosa è andato storto. Riprova tra poco! 🙏';
  }
}

// ========== WORKOUT DETECTION ==========

async function detectAndSaveWorkoutPlan(tenantId, tenant, phoneNumber, aiResponse) {
  try {
    const client = await db.getClient(tenantId, phoneNumber);
    if (!client) return;

    // Usa la nuova funzione di estrazione più robusta
    const workouts = extractWorkoutFromAIResponse(aiResponse);

    if (workouts.length === 0) {
      // Fallback al parser originale
      const fallbackWorkouts = parseWorkoutFromText(aiResponse);
      if (fallbackWorkouts.length === 0) return;
      workouts.push(...fallbackWorkouts);
    }

    const plan = {
      id: `WP-${Date.now()}`,
      phone: phoneNumber,
      clientName: client.name,
      objective: client.objective,
      experience: client.experience,
      daysPerWeek: client.days_per_week,
      limitations: client.limitations,
      workouts: workouts,
      notes: `Scheda generata automaticamente`
    };

    // Salva nel database e ottieni l'ID
    const savedPlan = await db.saveWorkoutPlan(tenantId, plan);
    const workoutId = savedPlan?.id || plan.id;
    console.log(`[Tenant] Scheda salvata per ${phoneNumber} con ID: ${workoutId}`);

    // Invia link alla scheda web invece del PDF
    try {
      const instanceName = tenant.whatsapp_instance_name || 'palestra';

      // Genera URL della scheda (usa variabile d'ambiente o default)
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const schedaUrl = `${baseUrl}/scheda/${workoutId}`;

      // Messaggio con link e suggerimenti
      const message = `📋 *La tua scheda è pronta!*

🔗 Clicca qui per vederla:
${schedaUrl}

💡 *Suggerimenti:*
• Puoi salvarla come PDF dal browser
• Funziona anche offline dopo il primo accesso
• Condividila con chi vuoi

Buon allenamento! 💪🔥`;

      await sendWhatsAppMessage(instanceName, phoneNumber, message);

      console.log(`[Scheda Web] Link inviato a ${phoneNumber}: ${schedaUrl}`);
    } catch (pdfError) {
      console.error('Errore generazione/invio PDF:', pdfError);
      // Non blocca il flusso se il PDF fallisce
    }
  } catch (error) {
    console.error('Errore salvataggio scheda:', error);
  }
}

function parseWorkoutFromText(text) {
  const workouts = [];
  const dayRegex = /\*?(giorno\s*\d+[^*\n]*)\*?/gi;
  const days = text.split(dayRegex).filter(Boolean);

  for (let i = 0; i < days.length - 1; i += 2) {
    const dayTitle = days[i].trim();
    const dayContent = days[i + 1] || '';

    const exercises = [];
    const lines = dayContent.split('\n');

    for (const line of lines) {
      const match = line.match(/[-•]?\s*(.+?):\s*(\d+)x(\d+[-\d]*)\s*\(([^)]+)\)/);
      if (match) {
        exercises.push({
          name: match[1].trim(),
          sets: match[2],
          reps: match[3],
          rest: match[4]
        });
      }
    }

    if (exercises.length > 0) {
      workouts.push({
        day: dayTitle.replace(/\*/g, '').trim(),
        exercises
      });
    }
  }

  return workouts;
}

// ========== DATABASE ESERCIZI ==========

const exerciseDatabase = {
  chest: [
    { name: 'Panca Piana', sets: '4', reps: '8-10', rest: '90s' },
    { name: 'Panca Inclinata Manubri', sets: '3', reps: '10-12', rest: '60s' },
    { name: 'Croci ai Cavi', sets: '3', reps: '12-15', rest: '60s' },
    { name: 'Push-up', sets: '3', reps: '15-20', rest: '45s' },
    { name: 'Chest Press', sets: '3', reps: '10-12', rest: '60s' },
  ],
  back: [
    { name: 'Lat Machine', sets: '4', reps: '10-12', rest: '60s' },
    { name: 'Rematore con Bilanciere', sets: '4', reps: '8-10', rest: '90s' },
    { name: 'Pulley Basso', sets: '3', reps: '12-15', rest: '60s' },
    { name: 'Hyperextension', sets: '3', reps: '15', rest: '45s' },
    { name: 'Trazioni Assistite', sets: '3', reps: '8-10', rest: '90s' },
  ],
  legs: [
    { name: 'Squat', sets: '4', reps: '8-10', rest: '120s' },
    { name: 'Leg Press', sets: '4', reps: '10-12', rest: '90s' },
    { name: 'Affondi', sets: '3', reps: '12 per gamba', rest: '60s' },
    { name: 'Leg Curl', sets: '3', reps: '12-15', rest: '60s' },
    { name: 'Leg Extension', sets: '3', reps: '12-15', rest: '60s' },
    { name: 'Calf Raise', sets: '4', reps: '15-20', rest: '45s' },
  ],
  shoulders: [
    { name: 'Military Press', sets: '4', reps: '8-10', rest: '90s' },
    { name: 'Alzate Laterali', sets: '3', reps: '12-15', rest: '45s' },
    { name: 'Alzate Frontali', sets: '3', reps: '12-15', rest: '45s' },
    { name: 'Face Pull', sets: '3', reps: '15', rest: '45s' },
    { name: 'Scrollate', sets: '3', reps: '12-15', rest: '60s' },
  ],
  arms: [
    { name: 'Curl con Bilanciere', sets: '3', reps: '10-12', rest: '60s' },
    { name: 'Curl Manubri Alternati', sets: '3', reps: '12', rest: '45s' },
    { name: 'French Press', sets: '3', reps: '10-12', rest: '60s' },
    { name: 'Pushdown ai Cavi', sets: '3', reps: '12-15', rest: '45s' },
    { name: 'Hammer Curl', sets: '3', reps: '12', rest: '45s' },
  ],
  core: [
    { name: 'Crunch', sets: '3', reps: '20', rest: '30s' },
    { name: 'Plank', sets: '3', reps: '45-60s', rest: '30s' },
    { name: 'Russian Twist', sets: '3', reps: '20', rest: '30s' },
    { name: 'Leg Raise', sets: '3', reps: '15', rest: '30s' },
    { name: 'Mountain Climber', sets: '3', reps: '30s', rest: '30s' },
  ],
  cardio: [
    { name: 'Tapis Roulant', sets: '1', reps: '20-30 min', rest: '-' },
    { name: 'Cyclette', sets: '1', reps: '20-30 min', rest: '-' },
    { name: 'Ellittica', sets: '1', reps: '20-30 min', rest: '-' },
    { name: 'Vogatore', sets: '1', reps: '15-20 min', rest: '-' },
  ]
};

const workoutTemplates = {
  'dimagrire': {
    2: [{ day: 'Giorno 1 - Full Body + Cardio', muscles: ['legs', 'chest', 'back', 'core', 'cardio'] },
        { day: 'Giorno 2 - Full Body + Cardio', muscles: ['legs', 'shoulders', 'arms', 'core', 'cardio'] }],
    3: [{ day: 'Giorno 1 - Gambe + Cardio', muscles: ['legs', 'core', 'cardio'] },
        { day: 'Giorno 2 - Petto/Spalle + Cardio', muscles: ['chest', 'shoulders', 'core', 'cardio'] },
        { day: 'Giorno 3 - Schiena/Braccia + Cardio', muscles: ['back', 'arms', 'core', 'cardio'] }],
    4: [{ day: 'Giorno 1 - Gambe', muscles: ['legs', 'core', 'cardio'] },
        { day: 'Giorno 2 - Petto/Tricipiti', muscles: ['chest', 'arms', 'cardio'] },
        { day: 'Giorno 3 - Schiena/Bicipiti', muscles: ['back', 'arms', 'cardio'] },
        { day: 'Giorno 4 - Spalle/Core', muscles: ['shoulders', 'core', 'cardio'] }]
  },
  'massa': {
    3: [{ day: 'Giorno 1 - Petto/Tricipiti', muscles: ['chest', 'arms'] },
        { day: 'Giorno 2 - Schiena/Bicipiti', muscles: ['back', 'arms'] },
        { day: 'Giorno 3 - Gambe/Spalle', muscles: ['legs', 'shoulders', 'core'] }],
    4: [{ day: 'Giorno 1 - Petto', muscles: ['chest', 'core'] },
        { day: 'Giorno 2 - Schiena', muscles: ['back', 'core'] },
        { day: 'Giorno 3 - Gambe', muscles: ['legs'] },
        { day: 'Giorno 4 - Spalle/Braccia', muscles: ['shoulders', 'arms'] }],
    5: [{ day: 'Giorno 1 - Petto', muscles: ['chest'] },
        { day: 'Giorno 2 - Schiena', muscles: ['back'] },
        { day: 'Giorno 3 - Gambe', muscles: ['legs'] },
        { day: 'Giorno 4 - Spalle', muscles: ['shoulders', 'core'] },
        { day: 'Giorno 5 - Braccia', muscles: ['arms', 'core'] }]
  },
  'tonificare': {
    3: [{ day: 'Giorno 1 - Upper Body', muscles: ['chest', 'back', 'shoulders', 'core'] },
        { day: 'Giorno 2 - Lower Body', muscles: ['legs', 'core'] },
        { day: 'Giorno 3 - Full Body', muscles: ['chest', 'legs', 'arms', 'core', 'cardio'] }],
    4: [{ day: 'Giorno 1 - Petto/Schiena', muscles: ['chest', 'back', 'core'] },
        { day: 'Giorno 2 - Gambe', muscles: ['legs', 'core'] },
        { day: 'Giorno 3 - Spalle/Braccia', muscles: ['shoulders', 'arms'] },
        { day: 'Giorno 4 - Cardio/Core', muscles: ['core', 'cardio'] }]
  },
  'salute': {
    2: [{ day: 'Giorno 1 - Full Body A', muscles: ['legs', 'chest', 'back', 'core'] },
        { day: 'Giorno 2 - Full Body B', muscles: ['legs', 'shoulders', 'arms', 'core', 'cardio'] }],
    3: [{ day: 'Giorno 1 - Full Body', muscles: ['legs', 'chest', 'core'] },
        { day: 'Giorno 2 - Full Body', muscles: ['back', 'shoulders', 'core'] },
        { day: 'Giorno 3 - Cardio/Core', muscles: ['arms', 'core', 'cardio'] }]
  }
};

// ========== WORKOUT GENERATION ==========

async function generateWorkoutPlan(tenantId, clientData) {
  const { phone, name, objective, experience, daysPerWeek, limitations } = clientData;

  const objectiveMap = {
    'dimagrire': 'dimagrire', 'perdere peso': 'dimagrire',
    'massa': 'massa', 'massa muscolare': 'massa', 'muscoli': 'massa',
    'tonificare': 'tonificare', 'definizione': 'tonificare',
    'salute': 'salute', 'salute generale': 'salute', 'benessere': 'salute'
  };

  const mappedObjective = objectiveMap[objective?.toLowerCase()] || 'tonificare';
  const days = Math.min(Math.max(parseInt(daysPerWeek) || 3, 2), 5);

  const templates = workoutTemplates[mappedObjective];
  const template = templates[days] || templates[Object.keys(templates)[0]];

  const workouts = template.map(dayTemplate => {
    const exercises = [];
    dayTemplate.muscles.forEach(muscle => {
      const muscleExercises = exerciseDatabase[muscle] || [];
      const numExercises = muscle === 'cardio' ? 1 : (muscle === 'core' ? 2 : 3);
      const shuffled = [...muscleExercises].sort(() => Math.random() - 0.5);
      exercises.push(...shuffled.slice(0, numExercises));
    });
    return { day: dayTemplate.day, exercises };
  });

  if (experience?.toLowerCase() === 'principiante') {
    workouts.forEach(day => {
      day.exercises = day.exercises.map(ex => ({
        ...ex,
        sets: Math.max(parseInt(ex.sets) - 1, 2).toString(),
        rest: ex.rest === '45s' ? '60s' : ex.rest
      }));
    });
  }

  const plan = {
    id: `WP-${Date.now()}`,
    phone,
    clientName: name || `Cliente ${phone.slice(-4)}`,
    objective: mappedObjective,
    experience: experience || 'intermedio',
    daysPerWeek: days,
    limitations: limitations || 'Nessuna',
    workouts,
    createdAt: new Date(),
    notes: `Scheda personalizzata per ${mappedObjective}. Riscaldamento: 5-10 min cardio leggero. Defaticamento: stretching 5 min.`
  };

  // Salva nel DB
  await db.saveWorkoutPlan(tenantId, plan);

  return plan;
}

// ========== RETROCOMPATIBILITÀ ==========

// Per permettere transizione graduale, manteniamo endpoint senza auth
// che usano il tenant di default

const DEFAULT_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

// Middleware helper per retrocompatibilità (permette auth JWT o accesso legacy)
const legacyTenant = async (req, res, next) => {
  try {
    // Prima prova autenticazione JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const { verifyToken } = require('./middleware/auth');
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.tenantId) {
        req.tenantId = decoded.tenantId;
        req.tenant = await db.getTenant(decoded.tenantId);
        req.user = await db.getUserById(decoded.userId);
        return next();
      }
    }

    // Fallback: usa tenant da header o default
    const tenantId = req.headers['x-tenant-id'] || DEFAULT_TENANT_ID;
    req.tenantId = tenantId;
    req.tenant = await db.getTenant(tenantId);
    next();
  } catch (error) {
    // In caso di errore, usa comunque il tenant default
    req.tenantId = DEFAULT_TENANT_ID;
    req.tenant = await db.getTenant(DEFAULT_TENANT_ID);
    next();
  }
};

// ========== API ROUTES ==========

// Stats
app.get('/api/stats', legacyTenant, async (req, res) => {
  try {
    const stats = await db.getStats(req.tenantId);
    const totalMessages = parseInt(stats.messages_this_week) || 0;
    const responseRate = totalMessages > 0 ? Math.min(94 + Math.floor(Math.random() * 5), 99) : 0;

    res.json({
      totalClients: parseInt(stats.total_clients) || 0,
      activeToday: parseInt(stats.active_today) || 0,
      messagesThisWeek: totalMessages,
      responseRate
    });
  } catch (error) {
    console.error('Errore stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clients (supporta sia auth che legacy)
app.get('/api/clients', legacyTenant, async (req, res) => {
  try {
    const clients = await db.getAllClients(req.tenantId);
    res.json(clients.map(c => ({
      phone: c.phone,
      name: c.name || 'Sconosciuto',
      status: 'active',
      objective: c.objective,
      experience: c.experience,
      daysPerWeek: c.days_per_week,
      lastContact: c.last_activity,
      createdAt: c.created_at
    })));
  } catch (error) {
    console.error('Errore clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crea nuovo cliente
app.post('/api/clients', legacyTenant, async (req, res) => {
  try {
    const { phone, name, objective, experience, daysPerWeek } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ error: 'Telefono e nome sono obbligatori' });
    }

    // Verifica se il cliente esiste già
    const existingClient = await db.getClient(req.tenantId, phone);
    if (existingClient) {
      return res.status(400).json({ error: 'Cliente già esistente con questo numero' });
    }

    // Crea il cliente
    const client = await db.upsertClient(req.tenantId, phone, {
      name,
      objective,
      experience,
      days_per_week: daysPerWeek
    });

    res.json({
      success: true,
      client: {
        phone: client.phone,
        name: client.name,
        objective: client.objective,
        experience: client.experience,
        daysPerWeek: client.days_per_week
      }
    });
  } catch (error) {
    console.error('Errore creazione cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Conversations (supporta sia auth che legacy)
app.get('/api/conversations', legacyTenant, async (req, res) => {
  try {
    const conversations = await db.getConversationsList(req.tenantId);
    res.json(conversations.map(c => ({
      phone: c.phone,
      name: c.name || 'Sconosciuto',
      lastMessage: c.last_message || 'Nessun messaggio',
      timestamp: c.message_time || c.last_activity,
      unread: 0
    })));
  } catch (error) {
    console.error('Errore conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Messages for a conversation (supporta sia auth che legacy)
app.get('/api/conversations/:phone', legacyTenant, async (req, res) => {
  try {
    const messages = await db.getMessages(req.tenantId, req.params.phone, 100);
    const client = await db.getClient(req.tenantId, req.params.phone);

    res.json({
      phone: req.params.phone,
      name: client?.name || 'Sconosciuto',
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at
      }))
    });
  } catch (error) {
    console.error('Errore messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Workouts (supporta sia auth che legacy)
app.get('/api/workouts', legacyTenant, async (req, res) => {
  try {
    const plans = await db.getAllWorkoutPlans(req.tenantId);
    res.json(plans.map(p => ({
      id: p.id,
      phone: p.phone,
      clientName: p.client_name || 'Sconosciuto',
      objective: p.objective,
      experience: p.experience,
      daysPerWeek: p.days_per_week,
      limitations: p.limitations,
      workouts: typeof p.workouts === 'string' ? JSON.parse(p.workouts) : p.workouts,
      notes: p.notes,
      createdAt: p.created_at
    })));
  } catch (error) {
    console.error('Errore workouts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Genera nuovo workout plan
app.post('/api/workouts/generate', legacyTenant, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Numero di telefono obbligatorio' });
    }

    // Ottieni dati cliente
    const client = await db.getClient(req.tenantId, phone);
    if (!client) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }

    // Genera la scheda
    const plan = await generateWorkoutPlan(req.tenantId, {
      phone: client.phone,
      name: client.name,
      objective: client.objective || 'tonificare',
      experience: client.experience || 'intermedio',
      daysPerWeek: client.days_per_week || 3,
      limitations: client.limitations || 'Nessuna'
    });

    res.json({
      success: true,
      plan: {
        id: plan.id,
        phone: plan.phone,
        clientName: plan.clientName,
        objective: plan.objective,
        experience: plan.experience,
        daysPerWeek: plan.daysPerWeek,
        limitations: plan.limitations,
        workouts: plan.workouts,
        notes: plan.notes,
        createdAt: plan.createdAt
      }
    });
  } catch (error) {
    console.error('Errore generazione scheda:', error);
    res.status(500).json({ error: error.message });
  }
});

// Invia workout via WhatsApp
app.post('/api/workouts/:phone/:planId/send', legacyTenant, async (req, res) => {
  try {
    const plan = await db.getWorkoutPlan(req.tenantId, req.params.planId);
    if (!plan) {
      return res.status(404).json({ error: 'Scheda non trovata' });
    }

    // Formatta il workout per WhatsApp
    const workouts = typeof plan.workouts === 'string' ? JSON.parse(plan.workouts) : plan.workouts;
    let message = `🏋️ *LA TUA SCHEDA DI ALLENAMENTO*\n\n`;
    message += `📋 Obiettivo: ${plan.objective}\n`;
    message += `📅 Giorni/settimana: ${plan.days_per_week}\n\n`;

    workouts.forEach((day, index) => {
      message += `*${day.day || `Giorno ${index + 1}`}*\n`;
      if (day.exercises) {
        day.exercises.forEach(ex => {
          message += `• ${ex.name}: ${ex.sets}x${ex.reps}`;
          if (ex.rest) message += ` (${ex.rest} riposo)`;
          message += `\n`;
        });
      }
      message += `\n`;
    });

    if (plan.notes) {
      message += `📝 Note: ${plan.notes}\n`;
    }

    // Invia via Evolution API (v2.x format)
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        number: req.params.phone,
        text: message
      },
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );

    res.json({ success: true, message: 'Scheda inviata via WhatsApp' });
  } catch (error) {
    console.error('Errore invio scheda:', error);
    res.status(500).json({ error: error.message });
  }
});

// Elimina workout
app.delete('/api/workouts/:phone/:planId', legacyTenant, async (req, res) => {
  try {
    const deleted = await db.deleteWorkoutPlan(req.tenantId, req.params.planId);
    if (!deleted) {
      return res.status(404).json({ error: 'Scheda non trovata' });
    }
    res.json({ success: true, message: 'Scheda eliminata' });
  } catch (error) {
    console.error('Errore eliminazione:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifica workout
app.put('/api/workouts/:phone/:planId', legacyTenant, async (req, res) => {
  try {
    const { workouts, notes, objective, daysPerWeek, clientName } = req.body;

    // Verifica che la scheda esista
    const existingPlan = await db.getWorkoutPlan(req.tenantId, req.params.planId);
    if (!existingPlan) {
      return res.status(404).json({ error: 'Scheda non trovata' });
    }

    // Aggiorna la scheda
    const updatedPlan = await db.updateWorkoutPlan(req.tenantId, req.params.planId, {
      workouts,
      notes,
      objective,
      daysPerWeek,
      clientName
    });

    // Formatta la risposta
    res.json({
      success: true,
      message: 'Scheda aggiornata con successo',
      plan: {
        id: updatedPlan.id,
        phone: updatedPlan.phone,
        clientName: updatedPlan.client_name,
        objective: updatedPlan.objective,
        experience: updatedPlan.experience,
        daysPerWeek: updatedPlan.days_per_week,
        limitations: updatedPlan.limitations,
        workouts: typeof updatedPlan.workouts === 'string' ? JSON.parse(updatedPlan.workouts) : updatedPlan.workouts,
        notes: updatedPlan.notes,
        createdAt: updatedPlan.created_at,
        updatedAt: updatedPlan.updated_at
      }
    });
  } catch (error) {
    console.error('Errore aggiornamento scheda:', error);
    res.status(500).json({ error: error.message });
  }
});

// Invia messaggio personalizzato via WhatsApp
app.post('/api/messages/send', legacyTenant, async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Numero e messaggio richiesti' });
    }

    // Invia via Evolution API (v2.x format)
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        number: phone,
        text: message
      },
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );

    // Salva il messaggio nel database
    await db.addMessage(req.tenantId, phone, 'assistant', message, { manual: true });

    res.json({ success: true, message: 'Messaggio inviato' });
  } catch (error) {
    console.error('Errore invio messaggio:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// Check-ins (supporta sia auth che legacy)
app.get('/api/checkins/today', legacyTenant, async (req, res) => {
  try {
    const checkins = await db.getAllCheckinsToday(req.tenantId);
    res.json(checkins);
  } catch (error) {
    console.error('Errore checkins today:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/checkins-stats', legacyTenant, async (req, res) => {
  try {
    const stats = await db.getCheckinStatsGlobal(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Errore checkin stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/checkin-qrcode', legacyTenant, async (req, res) => {
  try {
    const tenant = req.tenant;

    if (!tenant.whatsapp_number && !tenant.whatsapp_connected) {
      return res.status(400).json({
        error: 'WhatsApp non collegato',
        message: 'Collega prima WhatsApp dalla pagina Connessione'
      });
    }

    const gymPhone = tenant.whatsapp_number;
    const message = encodeURIComponent('check-in');
    const whatsappUrl = `https://wa.me/${gymPhone}?text=${message}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(whatsappUrl)}`;

    res.json({
      success: true,
      gymPhone,
      whatsappUrl,
      qrCodeUrl,
      instructions: [
        'Stampa questo QR Code e posizionalo all\'ingresso della palestra',
        'I clienti scannerizzano il QR con la fotocamera del telefono',
        'Si apre WhatsApp con messaggio "check-in" precompilato',
        'Premono Invia e ricevono la scheda del giorno!'
      ]
    });
  } catch (error) {
    console.error('Errore generazione QR check-in:', error);
    res.status(500).json({ error: error.message });
  }
});

// Referrals
app.get('/api/referrals', legacyTenant, async (req, res) => {
  try {
    const referrals = await db.getAllReferrals(req.tenantId);
    res.json(referrals);
  } catch (error) {
    console.error('Errore get referrals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/referrals/stats', legacyTenant, async (req, res) => {
  try {
    const stats = await db.getReferralStatsGlobal(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Errore referral stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/referrals/leaderboard', legacyTenant, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await db.getReferralLeaderboard(req.tenantId, limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Errore leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rewards
app.get('/api/rewards', legacyTenant, async (req, res) => {
  try {
    const rewards = await db.getAllRewards(req.tenantId);
    res.json(rewards);
  } catch (error) {
    console.error('Errore get rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rewards/:id/claim', legacyTenant, async (req, res) => {
  try {
    const { phone } = req.body;
    const reward = await db.claimReward(req.tenantId, req.params.id, phone);
    if (!reward) {
      return res.status(404).json({ error: 'Premio non trovato o già riscosso' });
    }
    res.json({ success: true, reward });
  } catch (error) {
    console.error('Errore claim reward:', error);
    res.status(500).json({ error: error.message });
  }
});

// Config
app.get('/api/reminders/config', legacyTenant, async (req, res) => {
  try {
    const config = await db.getConfig(req.tenantId, 'reminders');
    res.json(config || {
      enabled: true,
      thresholds: [
        { days: 3, message: "Ciao! Non ti vediamo da qualche giorno." },
        { days: 7, message: "Ehi! È passata una settimana!" },
        { days: 14, message: "Ciao! Sono passate due settimane..." }
      ],
      checkIntervalMinutes: 60
    });
  } catch (error) {
    console.error('Errore get reminders config:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== WHATSAPP API ==========

// WhatsApp status
app.get('/api/whatsapp/status', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
    console.log(`Checking WhatsApp status for instance: ${instanceName}`);
    console.log(`Evolution API URL: ${EVOLUTION_API_URL}`);

    const response = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );

    console.log('Evolution API response:', response.data);

    res.json({
      connected: response?.data?.instance?.state === 'open',
      state: response?.data?.instance?.state || 'unknown',
      instanceName
    });
  } catch (error) {
    console.error('Errore status WhatsApp:', error.message);
    res.json({ connected: false, state: 'error', error: error.message });
  }
});

// Clients (legacy - senza auth)
app.get('/api/legacy/clients', legacyTenant, async (req, res) => {
  try {
    const clients = await db.getAllClients(req.tenantId);
    res.json(clients);
  } catch (error) {
    console.error('Errore clients legacy:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stats (legacy)
app.get('/api/legacy/stats', legacyTenant, async (req, res) => {
  try {
    const stats = await db.getStats(req.tenantId);
    const checkinStats = await db.getCheckinStatsGlobal(req.tenantId);
    const referralStats = await db.getReferralStatsGlobal(req.tenantId);
    res.json({
      ...stats,
      checkins: checkinStats,
      referrals: referralStats
    });
  } catch (error) {
    console.error('Errore stats legacy:', error);
    res.status(500).json({ error: error.message });
  }
});

// Checkins (legacy)
app.get('/api/legacy/checkins', legacyTenant, async (req, res) => {
  try {
    const phone = req.query.phone;
    if (phone) {
      const checkins = await db.getClientCheckins(req.tenantId, phone);
      res.json(checkins);
    } else {
      const checkins = await db.getRecentCheckins(req.tenantId, 50);
      res.json(checkins);
    }
  } catch (error) {
    console.error('Errore checkins legacy:', error);
    res.status(500).json({ error: error.message });
  }
});

// Referrals (legacy)
app.get('/api/legacy/referrals', legacyTenant, async (req, res) => {
  try {
    const stats = await db.getReferralStatsGlobal(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Errore referrals legacy:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== ALIAS LEGACY PER DASHBOARD ESISTENTE ==========

// Stats alias
app.get('/api/stats', legacyTenant, async (req, res) => {
  try {
    const stats = await db.getStats(req.tenantId);
    const checkinStats = await db.getCheckinStatsGlobal(req.tenantId);
    const referralStats = await db.getReferralStatsGlobal(req.tenantId);
    res.json({
      totalClients: parseInt(stats.total_clients) || 0,
      activeToday: parseInt(stats.active_today) || 0,
      messagesThisWeek: parseInt(stats.messages_this_week) || 0,
      responseRate: 95,
      checkins: checkinStats,
      referrals: referralStats
    });
  } catch (error) {
    console.error('Errore stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clients alias (senza auth per dashboard legacy)
app.get('/api/clients', legacyTenant, async (req, res) => {
  try {
    const clients = await db.getAllClients(req.tenantId);
    res.json(clients.map(c => ({
      phone: c.phone,
      name: c.name,
      status: c.last_activity && new Date(c.last_activity) > new Date(Date.now() - 7*24*60*60*1000) ? 'active' : 'inactive',
      objective: c.objective,
      experience: c.experience,
      daysPerWeek: c.days_per_week,
      lastContact: c.last_activity,
      createdAt: c.created_at
    })));
  } catch (error) {
    console.error('Errore clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// Conversations alias
app.get('/api/conversations', legacyTenant, async (req, res) => {
  try {
    const clients = await db.getAllClients(req.tenantId);
    res.json(clients.map(c => ({
      phone: c.phone,
      name: c.name,
      lastMessage: '',
      timestamp: c.last_activity
    })));
  } catch (error) {
    console.error('Errore conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:phone', legacyTenant, async (req, res) => {
  try {
    const messages = await db.getClientMessages(req.tenantId, req.params.phone);
    res.json(messages);
  } catch (error) {
    console.error('Errore conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check-in QR code alias
app.get('/api/checkin-qrcode', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';

    const statusResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    if (statusResponse?.data?.state !== 'open') {
      return res.status(400).json({ error: 'WhatsApp non connesso' });
    }

    const fetchResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );

    const instances = fetchResponse.data || [];
    const instance = instances.find(i => i.instance?.instanceName === instanceName);

    let ownerNumber = null;
    if (instance?.instance?.owner) {
      ownerNumber = instance.instance.owner.replace('@s.whatsapp.net', '');
    }

    if (!ownerNumber) {
      return res.status(400).json({ error: 'Numero WhatsApp non trovato' });
    }

    const checkinMessage = encodeURIComponent('check-in');
    const whatsappUrl = `https://wa.me/${ownerNumber}?text=${checkinMessage}`;

    res.json({
      success: true,
      whatsappNumber: ownerNumber,
      whatsappUrl,
      qrCodeData: whatsappUrl
    });
  } catch (error) {
    console.error('Errore QR code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Checkins today alias
app.get('/api/checkins/today', legacyTenant, async (req, res) => {
  try {
    const checkins = await db.getRecentCheckins(req.tenantId, 50);
    const today = new Date().toDateString();
    const todayCheckins = checkins.filter(c => new Date(c.check_in_time).toDateString() === today);
    res.json(todayCheckins);
  } catch (error) {
    console.error('Errore checkins today:', error);
    res.status(500).json({ error: error.message });
  }
});

// Checkins stats alias
app.get('/api/checkins-stats', legacyTenant, async (req, res) => {
  try {
    const stats = await db.getCheckinStatsGlobal(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Errore checkins stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Note: /api/workouts è già definito sopra con legacyTenant

app.get('/api/workouts-stats', legacyTenant, async (req, res) => {
  try {
    const result = await db.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as this_week
      FROM workout_plans WHERE tenant_id = $1
    `, [req.tenantId]);
    res.json({
      total: parseInt(result.rows[0].total) || 0,
      sent: parseInt(result.rows[0].total) || 0,
      this_week: parseInt(result.rows[0].this_week) || 0
    });
  } catch (error) {
    console.error('Errore workouts stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reminders alias
app.get('/api/reminders/config', legacyTenant, async (req, res) => {
  try {
    const config = await db.getConfig(req.tenantId, 'reminders');
    res.json(config || {
      enabled: true,
      thresholds: [
        { days: 3, message: "Ciao! Non ti vediamo da qualche giorno." },
        { days: 7, message: "Ehi! È passata una settimana!" },
        { days: 14, message: "Ciao! Sono passate due settimane..." }
      ]
    });
  } catch (error) {
    console.error('Errore reminders config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reminders/stats', legacyTenant, async (req, res) => {
  try {
    const result = await db.pool.query(`
      SELECT COUNT(*) as total FROM sent_reminders WHERE tenant_id = $1
    `, [req.tenantId]);
    res.json({ total: parseInt(result.rows[0].total) });
  } catch (error) {
    console.error('Errore reminders stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reminders/config', legacyTenant, async (req, res) => {
  try {
    await db.setConfig(req.tenantId, 'reminders', req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Errore save reminders config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reminders/check', legacyTenant, async (req, res) => {
  try {
    // Trigger manual automation run
    await automation.runNow();
    res.json({ success: true, message: 'Automation triggered' });
  } catch (error) {
    console.error('Errore check reminders:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== AUTOMATION ENDPOINTS ==========

// Get all automation sequences for tenant
app.get('/api/automations', legacyTenant, async (req, res) => {
  try {
    const sequences = await db.getAllAutomationSequences(req.tenant.id);
    res.json(sequences);
  } catch (error) {
    console.error('Errore get automations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get automation stats (MUST be before /:id route)
app.get('/api/automations/stats', legacyTenant, async (req, res) => {
  try {
    const stats = await db.getAutomationStats(req.tenant.id);
    const status = automation.getStatus();
    res.json({
      ...stats,
      schedulerRunning: status.initialized
    });
  } catch (error) {
    console.error('Errore get automation stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get automation job history (MUST be before /:id route)
app.get('/api/automations/jobs', legacyTenant, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const jobs = await db.getAutomationJobs(req.tenant.id, limit);
    res.json(jobs);
  } catch (error) {
    console.error('Errore get automation jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger automations (MUST be before /:id route)
app.post('/api/automations/run', legacyTenant, async (req, res) => {
  try {
    await automation.runNow();
    res.json({ success: true, message: 'Automation cycle started' });
  } catch (error) {
    console.error('Errore run automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single automation sequence
app.get('/api/automations/:id', legacyTenant, async (req, res) => {
  try {
    const sequence = await db.getAutomationSequence(req.tenant.id, req.params.id);
    if (!sequence) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json(sequence);
  } catch (error) {
    console.error('Errore get automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new automation sequence
app.post('/api/automations', legacyTenant, async (req, res) => {
  try {
    const sequence = await db.createAutomationSequence(req.tenant.id, req.body);
    res.status(201).json(sequence);
  } catch (error) {
    console.error('Errore create automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update automation sequence
app.put('/api/automations/:id', legacyTenant, async (req, res) => {
  try {
    const sequence = await db.updateAutomationSequence(req.tenant.id, req.params.id, req.body);
    if (!sequence) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json(sequence);
  } catch (error) {
    console.error('Errore update automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle automation enabled/disabled
app.post('/api/automations/:id/toggle', legacyTenant, async (req, res) => {
  try {
    const sequence = await db.getAutomationSequence(req.tenant.id, req.params.id);
    if (!sequence) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    const updated = await db.updateAutomationSequence(req.tenant.id, req.params.id, {
      is_enabled: !sequence.is_enabled
    });
    res.json(updated);
  } catch (error) {
    console.error('Errore toggle automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete automation sequence
app.delete('/api/automations/:id', legacyTenant, async (req, res) => {
  try {
    const deleted = await db.deleteAutomationSequence(req.tenant.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Errore delete automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI config alias
app.get('/api/ai/config', legacyTenant, async (req, res) => {
  try {
    res.json({
      coachName: req.tenant?.coach_name || 'Coach AI',
      useEmoji: req.tenant?.use_emoji !== false,
      customPrompt: req.tenant?.custom_system_prompt || ''
    });
  } catch (error) {
    console.error('Errore AI config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai/preview', legacyTenant, async (req, res) => {
  try {
    const prompt = getSystemPrompt(req.tenant);
    res.json({ prompt });
  } catch (error) {
    console.error('Errore AI preview:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/config', legacyTenant, async (req, res) => {
  try {
    await db.updateTenant(req.tenantId, {
      coachName: req.body.coachName,
      useEmoji: req.body.useEmoji,
      customSystemPrompt: req.body.customPrompt
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Errore save AI config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/reset', legacyTenant, async (req, res) => {
  try {
    await db.updateTenant(req.tenantId, {
      coachName: 'Coach AI',
      useEmoji: true,
      customSystemPrompt: null
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Errore reset AI:', error);
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp info alias
app.get('/api/whatsapp/info', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
    console.log(`Getting WhatsApp info for instance: ${instanceName}`);

    const fetchResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(err => {
      console.error('Fetch instances error:', err.message);
      return { data: [] };
    });

    console.log('Instances found:', fetchResponse.data?.length || 0);
    const instance = (fetchResponse.data || []).find(i => i.name === instanceName);
    console.log('Found instance:', instance?.name, 'owner:', instance?.ownerJid);

    res.json({
      instanceName,
      ownerJid: instance?.ownerJid || null,
      owner: instance?.ownerJid?.replace('@s.whatsapp.net', '') || null,
      profileName: instance?.profileName || null,
      profilePicUrl: instance?.profilePicUrl || null
    });
  } catch (error) {
    console.error('Errore WhatsApp info:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp QR code alias
app.get('/api/whatsapp/qrcode', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';
    console.log(`Getting QR code for instance: ${instanceName}`);

    const statusResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(err => {
      console.error('Status check error:', err.message);
      return null;
    });

    console.log('Status response:', statusResponse?.data);

    if (statusResponse?.data?.instance?.state === 'open') {
      return res.json({ connected: true });
    }

    const qrResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(err => {
      console.error('QR fetch error:', err.message);
      return null;
    });

    console.log('QR response:', qrResponse?.data);

    res.json({
      connected: false,
      qrcode: qrResponse?.data?.base64 || qrResponse?.data?.qrcode?.base64,
      pairingCode: qrResponse?.data?.pairingCode
    });
  } catch (error) {
    console.error('Errore WhatsApp QR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp disconnect alias
app.post('/api/whatsapp/disconnect', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';

    await axios.delete(
      `${EVOLUTION_API_URL}/instance/logout/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    res.json({ success: true });
  } catch (error) {
    console.error('Errore WhatsApp disconnect:', error);
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp restart alias
app.post('/api/whatsapp/restart', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';

    await axios.put(
      `${EVOLUTION_API_URL}/instance/restart/${instanceName}`,
      {},
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    res.json({ success: true });
  } catch (error) {
    console.error('Errore WhatsApp restart:', error);
    res.status(500).json({ error: error.message });
  }
});

// QR Code checkin (legacy)
app.get('/api/legacy/checkin/qrcode', legacyTenant, async (req, res) => {
  try {
    const instanceName = req.tenant?.whatsapp_instance_name || 'palestra';

    const statusResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    if (statusResponse?.data?.state !== 'open') {
      return res.status(400).json({ error: 'WhatsApp non connesso' });
    }

    const fetchResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );

    const instances = fetchResponse.data || [];
    const instance = instances.find(i => i.instance?.instanceName === instanceName);

    let ownerNumber = null;
    if (instance?.instance?.owner) {
      ownerNumber = instance.instance.owner.replace('@s.whatsapp.net', '');
    }

    if (!ownerNumber) {
      return res.status(400).json({ error: 'Numero WhatsApp non trovato' });
    }

    const checkinMessage = encodeURIComponent('check-in');
    const whatsappUrl = `https://wa.me/${ownerNumber}?text=${checkinMessage}`;

    res.json({
      success: true,
      whatsappNumber: ownerNumber,
      whatsappUrl,
      qrCodeData: whatsappUrl
    });
  } catch (error) {
    console.error('Errore QR code legacy:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== SUPER ADMIN API ==========

// Get all tenants with stats
app.get('/api/superadmin/tenants', async (req, res) => {
  try {
    // Get all tenants
    const tenantsResult = await db.pool.query(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id) as client_count,
        (SELECT COUNT(*) FROM messages WHERE tenant_id = t.id) as message_count
      FROM tenants t
      ORDER BY t.created_at DESC
    `);

    // Get global stats
    const statsResult = await db.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants) as total_tenants,
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(DISTINCT c.phone) FROM clients c
         JOIN messages m ON c.phone = m.phone AND c.tenant_id = m.tenant_id
         WHERE m.created_at > NOW() - INTERVAL '24 hours') as active_today
    `);

    const tenants = tenantsResult.rows.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      coachName: t.coach_name,
      useEmoji: t.use_emoji,
      whatsappInstanceName: t.whatsapp_instance_name,
      whatsappNumber: t.whatsapp_number,
      whatsappConnected: t.whatsapp_connected,
      clientCount: parseInt(t.client_count) || 0,
      messageCount: parseInt(t.message_count) || 0,
      createdAt: t.created_at,
      // Subscription fields
      subscriptionPlan: t.subscription_plan || 'trial',
      subscriptionStatus: t.subscription_status || 'active',
      subscriptionExpiresAt: t.subscription_ends_at,
      subscriptionPrice: t.subscription_price,
      subscriptionNotes: t.subscription_notes
    }));

    const stats = statsResult.rows[0];

    res.json({
      tenants,
      stats: {
        totalTenants: parseInt(stats.total_tenants) || 0,
        totalClients: parseInt(stats.total_clients) || 0,
        totalMessages: parseInt(stats.total_messages) || 0,
        activeToday: parseInt(stats.active_today) || 0
      }
    });
  } catch (error) {
    console.error('Errore superadmin tenants:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new tenant
app.post('/api/superadmin/tenants', async (req, res) => {
  try {
    const { name, slug, coachName, useEmoji, whatsappInstanceName } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Nome e slug sono obbligatori' });
    }

    // Check if slug already exists
    const existing = await db.pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Slug già esistente' });
    }

    const result = await db.pool.query(`
      INSERT INTO tenants (name, slug, coach_name, use_emoji, whatsapp_instance_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, slug, coachName || 'Coach AI', useEmoji !== false, whatsappInstanceName || null]);

    res.json({ success: true, tenant: result.rows[0] });
  } catch (error) {
    console.error('Errore creazione tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update tenant
app.put('/api/superadmin/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, coachName, useEmoji, whatsappInstanceName,
      subscriptionPlan, subscriptionStatus, subscriptionExpiresAt, subscriptionPrice, subscriptionNotes
    } = req.body;

    const result = await db.pool.query(`
      UPDATE tenants
      SET name = COALESCE($1, name),
          coach_name = COALESCE($2, coach_name),
          use_emoji = COALESCE($3, use_emoji),
          whatsapp_instance_name = COALESCE($4, whatsapp_instance_name),
          subscription_plan = COALESCE($5, subscription_plan),
          subscription_status = COALESCE($6, subscription_status),
          subscription_ends_at = $7,
          subscription_price = $8,
          subscription_notes = $9,
          updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      name, coachName, useEmoji, whatsappInstanceName,
      subscriptionPlan, subscriptionStatus,
      subscriptionExpiresAt || null,
      subscriptionPrice || null,
      subscriptionNotes || null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    res.json({ success: true, tenant: result.rows[0] });
  } catch (error) {
    console.error('Errore aggiornamento tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete tenant
app.delete('/api/superadmin/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting the default tenant
    if (id === DEFAULT_TENANT_ID) {
      return res.status(400).json({ error: 'Non puoi eliminare il tenant di default' });
    }

    // Delete all related data first
    await db.pool.query('DELETE FROM messages WHERE tenant_id = $1', [id]);
    await db.pool.query('DELETE FROM clients WHERE tenant_id = $1', [id]);
    await db.pool.query('DELETE FROM workout_plans WHERE tenant_id = $1', [id]);
    await db.pool.query('DELETE FROM checkins WHERE tenant_id = $1', [id]);
    await db.pool.query('DELETE FROM referrals WHERE tenant_id = $1', [id]);
    await db.pool.query('DELETE FROM rewards WHERE tenant_id = $1', [id]);
    await db.pool.query('DELETE FROM users WHERE tenant_id = $1', [id]);

    // Finally delete the tenant
    const result = await db.pool.query('DELETE FROM tenants WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single tenant details
app.get('/api/superadmin/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.pool.query(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id) as client_count,
        (SELECT COUNT(*) FROM messages WHERE tenant_id = t.id) as message_count,
        (SELECT COUNT(*) FROM workout_plans WHERE tenant_id = t.id) as workout_count,
        (SELECT COUNT(*) FROM checkins WHERE tenant_id = t.id) as checkin_count
      FROM tenants t
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    const t = result.rows[0];
    res.json({
      id: t.id,
      name: t.name,
      slug: t.slug,
      coachName: t.coach_name,
      useEmoji: t.use_emoji,
      whatsappInstanceName: t.whatsapp_instance_name,
      whatsappNumber: t.whatsapp_number,
      whatsappConnected: t.whatsapp_connected,
      clientCount: parseInt(t.client_count) || 0,
      messageCount: parseInt(t.message_count) || 0,
      workoutCount: parseInt(t.workout_count) || 0,
      checkinCount: parseInt(t.checkin_count) || 0,
      createdAt: t.created_at
    });
  } catch (error) {
    console.error('Errore get tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== MONITORING API ENDPOINTS ==========

// Get system health status
app.get('/api/monitoring/health', async (req, res) => {
  try {
    const monitoring = req.app.locals.monitoring;
    if (!monitoring) {
      return res.status(503).json({ error: 'Monitoring not initialized' });
    }

    const results = await monitoring.forceCheck();
    res.json(results);
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent alerts
app.get('/api/monitoring/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const result = await db.pool.query(`
      SELECT * FROM monitoring_alerts
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({ alerts: result.rows });
  } catch (error) {
    // Table might not exist yet
    res.json({ alerts: [] });
  }
});

// Acknowledge an alert
app.post('/api/monitoring/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;

    await db.pool.query(`
      UPDATE monitoring_alerts
      SET acknowledged = true, acknowledged_at = NOW()
      WHERE id = $1
    `, [id]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Telegram connection
app.post('/api/monitoring/test-telegram', async (req, res) => {
  try {
    const monitoring = req.app.locals.monitoring;
    if (!monitoring) {
      return res.status(503).json({ error: 'Monitoring not initialized' });
    }

    await monitoring.testTelegram();
    res.json({ success: true, message: 'Test alert sent to Telegram' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monitoring stats
app.get('/api/monitoring/stats', async (req, res) => {
  try {
    const stats = await db.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM monitoring_alerts WHERE created_at > NOW() - INTERVAL '24 hours') as alerts_24h,
        (SELECT COUNT(*) FROM monitoring_alerts WHERE severity = 'error' AND acknowledged = false) as unacknowledged_errors,
        (SELECT COUNT(*) FROM tenants WHERE whatsapp_connected = true) as connected_tenants,
        (SELECT COUNT(*) FROM tenants WHERE whatsapp_connected = false AND whatsapp_instance_name IS NOT NULL) as disconnected_tenants
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    res.json({
      alerts_24h: 0,
      unacknowledged_errors: 0,
      connected_tenants: 0,
      disconnected_tenants: 0
    });
  }
});

// ========== ONBOARDING API ENDPOINTS ==========

// Generate onboarding link for a tenant (SuperAdmin)
app.post('/api/superadmin/tenants/:id/onboarding', async (req, res) => {
  try {
    const { id } = req.params;

    // Check tenant exists
    const tenant = await db.getTenant(id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant non trovato' });
    }

    // Create onboarding token
    const onboarding = await db.createOnboardingToken(id, 7); // expires in 7 days

    const baseUrl = process.env.DASHBOARD_URL || 'https://coachpalestra.it';
    const onboardingUrl = `${baseUrl}/onboarding/${onboarding.token}`;

    res.json({
      success: true,
      token: onboarding.token,
      url: onboardingUrl,
      expiresAt: onboarding.expires_at
    });
  } catch (error) {
    console.error('Errore generazione link onboarding:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get onboarding status for a tenant (SuperAdmin)
app.get('/api/superadmin/tenants/:id/onboarding', async (req, res) => {
  try {
    const { id } = req.params;

    const onboarding = await db.getOnboardingByTenant(id);
    if (!onboarding) {
      return res.json({ hasOnboarding: false });
    }

    const baseUrl = process.env.DASHBOARD_URL || 'https://coachpalestra.it';

    res.json({
      hasOnboarding: true,
      token: onboarding.token,
      url: `${baseUrl}/onboarding/${onboarding.token}`,
      status: onboarding.status,
      currentStep: onboarding.current_step,
      expiresAt: onboarding.expires_at,
      startedAt: onboarding.started_at,
      completedAt: onboarding.completed_at
    });
  } catch (error) {
    console.error('Errore get onboarding status:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC: Get onboarding data by token (for wizard)
app.get('/api/onboarding/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const onboarding = await db.getOnboardingByToken(token);
    if (!onboarding) {
      return res.status(404).json({ error: 'Link di onboarding non valido' });
    }

    // Check if expired
    if (new Date(onboarding.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Link di onboarding scaduto' });
    }

    // Check if already completed
    if (onboarding.status === 'completed') {
      return res.status(410).json({ error: 'Onboarding già completato' });
    }

    // Get tenant info
    const tenant = await db.getTenant(onboarding.tenant_id);

    res.json({
      token: onboarding.token,
      status: onboarding.status,
      currentStep: onboarding.current_step,
      stepData: onboarding.step_data || {},
      expiresAt: onboarding.expires_at,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        coachName: tenant.coach_name,
        coachTone: tenant.coach_tone,
        welcomeMessage: tenant.welcome_message,
        gymAddress: tenant.gym_address,
        gymPhone: tenant.gym_phone,
        gymHours: tenant.gym_hours,
        logoUrl: tenant.logo_url,
        whatsappInstanceName: tenant.whatsapp_instance_name
      }
    });
  } catch (error) {
    console.error('Errore get onboarding:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC: Save progress on a step
app.post('/api/onboarding/:token/step/:step', async (req, res) => {
  try {
    const { token, step } = req.params;
    const stepData = req.body;

    const onboarding = await db.getOnboardingByToken(token);
    if (!onboarding) {
      return res.status(404).json({ error: 'Link di onboarding non valido' });
    }

    if (new Date(onboarding.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Link di onboarding scaduto' });
    }

    if (onboarding.status === 'completed') {
      return res.status(410).json({ error: 'Onboarding già completato' });
    }

    const stepNum = parseInt(step);

    // Save step data
    const stepKey = `step${stepNum}`;
    const updatedOnboarding = await db.updateOnboardingProgress(token, stepNum, { [stepKey]: stepData });

    // Also update tenant data based on step
    if (stepNum === 1) {
      // Step 1: Gym Info
      await db.updateTenantOnboardingData(onboarding.tenant_id, {
        name: stepData.name,
        gym_address: stepData.address,
        gym_phone: stepData.phone,
        gym_hours: stepData.hours,
        logo_url: stepData.logoUrl
      });
    } else if (stepNum === 3) {
      // Step 3: Coach customization
      await db.updateTenantOnboardingData(onboarding.tenant_id, {
        coach_name: stepData.coachName,
        coach_tone: stepData.coachTone,
        welcome_message: stepData.welcomeMessage
      });
    }

    res.json({
      success: true,
      currentStep: updatedOnboarding.current_step,
      status: updatedOnboarding.status
    });
  } catch (error) {
    console.error('Errore save step:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC: Get WhatsApp QR for onboarding (Step 2)
app.get('/api/onboarding/:token/whatsapp/qrcode', async (req, res) => {
  try {
    const { token } = req.params;

    const onboarding = await db.getOnboardingByToken(token);
    if (!onboarding) {
      return res.status(404).json({ error: 'Link di onboarding non valido' });
    }

    const tenant = await db.getTenant(onboarding.tenant_id);
    const instanceName = tenant?.whatsapp_instance_name;

    if (!instanceName) {
      return res.status(400).json({ error: 'Istanza WhatsApp non configurata. Contatta il supporto.' });
    }

    // Check connection status
    const statusResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    if (statusResponse?.data?.instance?.state === 'open') {
      // Update tenant as connected
      await db.updateTenantOnboardingData(onboarding.tenant_id, { whatsapp_connected: true });
      return res.json({ connected: true });
    }

    // Get QR code
    const qrResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(err => {
      console.error('QR fetch error:', err.message);
      return null;
    });

    res.json({
      connected: false,
      qrcode: qrResponse?.data?.base64 || qrResponse?.data?.qrcode?.base64,
      pairingCode: qrResponse?.data?.pairingCode
    });
  } catch (error) {
    console.error('Errore WhatsApp QR onboarding:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC: Check WhatsApp connection status for onboarding
app.get('/api/onboarding/:token/whatsapp/status', async (req, res) => {
  try {
    const { token } = req.params;

    const onboarding = await db.getOnboardingByToken(token);
    if (!onboarding) {
      return res.status(404).json({ error: 'Link di onboarding non valido' });
    }

    const tenant = await db.getTenant(onboarding.tenant_id);
    const instanceName = tenant?.whatsapp_instance_name;

    if (!instanceName) {
      return res.json({ connected: false, error: 'Istanza non configurata' });
    }

    const statusResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    const isConnected = statusResponse?.data?.instance?.state === 'open';

    if (isConnected) {
      await db.updateTenantOnboardingData(onboarding.tenant_id, { whatsapp_connected: true });
    }

    res.json({ connected: isConnected });
  } catch (error) {
    console.error('Errore WhatsApp status onboarding:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC: Complete onboarding
app.post('/api/onboarding/:token/complete', async (req, res) => {
  try {
    const { token } = req.params;

    const onboarding = await db.getOnboardingByToken(token);
    if (!onboarding) {
      return res.status(404).json({ error: 'Link di onboarding non valido' });
    }

    if (onboarding.status === 'completed') {
      return res.status(410).json({ error: 'Onboarding già completato' });
    }

    // Complete the onboarding
    await db.completeOnboarding(token);

    // Send Telegram notification
    const monitoring = req.app.locals.monitoring;
    if (monitoring) {
      const tenant = await db.getTenant(onboarding.tenant_id);
      await monitoring.sendTelegramAlert(
        `✅ Nuova palestra configurata!`,
        `La palestra "${tenant.name}" ha completato l'onboarding ed è pronta per l'uso.`,
        'info'
      );
    }

    res.json({
      success: true,
      message: 'Onboarding completato! La tua palestra è pronta.'
    });
  } catch (error) {
    console.error('Errore complete onboarding:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== AVVIO SERVER ==========

async function startServer() {
  try {
    await db.initDatabase();
    console.log('Database PostgreSQL connesso');

    // Run migrations
    const migrations = [
      { name: 'automation', file: '003-automation.sql' },
      { name: 'monitoring', file: '005-monitoring.sql' },
      { name: 'onboarding', file: '006-onboarding.sql' }
    ];

    for (const migration of migrations) {
      try {
        const migrationPath = path.join(__dirname, `../db/migrations/${migration.file}`);
        if (fs.existsSync(migrationPath)) {
          const sql = fs.readFileSync(migrationPath, 'utf8');
          await db.pool.query(sql);
          console.log(`${migration.name} tables migrated`);
        }
      } catch (migrationError) {
        if (!migrationError.message.includes('already exists')) {
          console.log(`${migration.name} migration note:`, migrationError.message);
        }
      }
    }

    // Initialize and start marketing automation
    automation.init(db, sendWhatsAppMessage);
    automation.start();

    // Initialize and start monitoring system
    const monitoring = new MonitoringSystem(db, {
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
      evolutionApiUrl: EVOLUTION_API_URL,
      evolutionApiKey: EVOLUTION_API_KEY
    });
    monitoring.start();

    // Expose monitoring for API endpoints
    app.locals.monitoring = monitoring;

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Coach AI Backend (Multi-Tenant) running on port ${PORT}`);
      console.log('Marketing Automation: ACTIVE');
      console.log('Monitoring System: ACTIVE');
    });
  } catch (error) {
    console.error('Errore avvio server:', error);
    process.exit(1);
  }
}

startServer();
