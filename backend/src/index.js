const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database PostgreSQL
const db = require('../db/database');

// Directory per salvare i PDF delle schede
const WORKOUTS_DIR = path.join(__dirname, '../workouts');
if (!fs.existsSync(WORKOUTS_DIR)) {
  fs.mkdirSync(WORKOUTS_DIR, { recursive: true });
}

const app = express();
app.use(express.json());

// CORS per dashboard (deve essere prima delle routes)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// AI Client - supporta Ollama (locale) o OpenAI (produzione)
const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'http://host.docker.internal:11434/v1';
const AI_API_KEY = process.env.OPENAI_API_KEY || 'ollama';
const AI_MODEL = process.env.OPENAI_MODEL || 'llama3.2:3b';

const openai = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY,
  timeout: 60000,
});

console.log(`AI Provider: ${AI_BASE_URL.includes('ollama') || AI_BASE_URL.includes('11434') ? 'Ollama (local)' : 'OpenAI API'}`);

// Evolution API config
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'coach-ai';

// Reminder configuration (caricata da DB all'avvio)
let reminderConfig = {
  enabled: true,
  checkIntervalMinutes: 60,
  inactivityThresholds: [
    { days: 3, message: "Ciao! Non ti vediamo da qualche giorno. Tutto bene? Ricorda che la costanza è la chiave del successo!" },
    { days: 7, message: "Ehi! È passata una settimana dal tuo ultimo allenamento. Ti aspettiamo in palestra! Hai bisogno di una nuova scheda?" },
    { days: 14, message: "Ciao! Sono passate due settimane... Mi manchi! Se hai avuto impegni, capisco perfettamente. Quando vuoi tornare, sono qui per aiutarti a riprendere gradualmente." }
  ]
};

// AI Config (caricata da DB all'avvio)
let aiConfig = {
  gymName: 'Centro Fitness Amati',
  coachName: 'Coach AI',
  personality: 'amichevole e motivante',
  useEmoji: true,
  systemPrompt: `Sei un personal trainer virtuale amichevole e motivante.
Il tuo nome è Coach AI e lavori per una palestra.

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

Dopo aver raccolto le info, genera una scheda di allenamento personalizzata.`
};

// Funzione per generare il prompt dinamico
function getSystemPrompt() {
  return aiConfig.systemPrompt
    .replace(/Coach AI/g, aiConfig.coachName)
    .replace(/una palestra/g, aiConfig.gymName)
    + (aiConfig.useEmoji ? '' : '\n\nIMPORTANTE: Non usare emoji nelle risposte.');
}

// ========== WEBHOOK ==========

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('Webhook ricevuto:', JSON.stringify(body, null, 2));

    const event = body.event;

    if (event === 'messages.upsert') {
      const data = body.data;
      const messages = Array.isArray(data) ? data : [data];

      for (const msgData of messages) {
        const key = msgData.key || {};
        const messageContent = msgData.message || {};

        if (key.fromMe) continue;

        const remoteJid = key.remoteJid || '';
        const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');

        const text = messageContent.conversation ||
                     messageContent.extendedTextMessage?.text ||
                     msgData.body || '';

        if (!text || !phoneNumber) continue;

        console.log(`Messaggio da ${phoneNumber}: ${text}`);

        // Aggiorna attività cliente nel DB
        await db.updateClientActivity(phoneNumber);

        // Processa con AI e rispondi
        const response = await processMessage(phoneNumber, text);
        await sendWhatsAppMessage(phoneNumber, response);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Errore webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PROCESS MESSAGE ==========

async function processMessage(phoneNumber, text) {
  try {
    // Salva messaggio utente nel DB
    await db.addMessage(phoneNumber, 'user', text);

    // Recupera storia conversazione dal DB (ultimi 20 messaggi)
    const history = await db.getRecentMessages(phoneNumber, 20);

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: getSystemPrompt() },
        ...history
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;

    // Salva risposta nel DB
    await db.addMessage(phoneNumber, 'assistant', response);

    return response;
  } catch (error) {
    console.error('Errore AI:', error);
    return 'Scusa, ho avuto un problema tecnico. Riprova tra un attimo!';
  }
}

// ========== REMINDERS ==========

async function checkInactiveClients() {
  if (!reminderConfig.enabled) return;

  console.log('Controllo clienti inattivi...');

  for (const threshold of reminderConfig.inactivityThresholds) {
    const inactiveClients = await db.getInactiveClients(threshold.days);

    for (const client of inactiveClients) {
      const sentReminders = await db.getSentReminders(client.phone);

      if (!sentReminders.includes(threshold.days)) {
        console.log(`Invio promemoria a ${client.phone} (inattivo da ${threshold.days}+ giorni)`);

        await sendWhatsAppMessage(client.phone, threshold.message);
        await db.addMessage(client.phone, 'assistant', threshold.message, { isReminder: true });
        await db.addSentReminder(client.phone, threshold.days);
      }
    }
  }
}

function startReminderScheduler() {
  const intervalMs = reminderConfig.checkIntervalMinutes * 60 * 1000;
  console.log(`Scheduler promemoria avviato (controllo ogni ${reminderConfig.checkIntervalMinutes} minuti)`);

  setTimeout(() => {
    checkInactiveClients();
    setInterval(checkInactiveClients, intervalMs);
  }, 5 * 60 * 1000);
}

// ========== SEND WHATSAPP MESSAGE ==========

async function sendWhatsAppMessage(phoneNumber, text) {
  try {
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
      { number: phoneNumber, text: text },
      { headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY } }
    );
    console.log(`Messaggio inviato a ${phoneNumber}`);
  } catch (error) {
    console.error('Errore invio messaggio:', error.response?.data || error.message);
  }
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

async function generateWorkoutPlan(clientData) {
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
  await db.saveWorkoutPlan(plan);

  return plan;
}

// ========== PDF GENERATION ==========

async function generateWorkoutPDF(plan) {
  return new Promise((resolve, reject) => {
    const filename = `scheda_${plan.clientName || plan.client_name}`.replace(/\s+/g, '_') + `_${plan.id}.pdf`;
    const filepath = path.join(WORKOUTS_DIR, filename);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(24).font('Helvetica-Bold').text('SCHEDA ALLENAMENTO', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text('Centro Fitness Amati', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(12).font('Helvetica-Bold').text('DATI CLIENTE');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nome: ${plan.clientName || plan.client_name}`);
    doc.text(`Obiettivo: ${(plan.objective || '').charAt(0).toUpperCase() + (plan.objective || '').slice(1)}`);
    doc.text(`Livello: ${(plan.experience || '').charAt(0).toUpperCase() + (plan.experience || '').slice(1)}`);
    doc.text(`Giorni/Settimana: ${plan.daysPerWeek || plan.days_per_week}`);
    doc.text(`Limitazioni: ${plan.limitations}`);
    doc.text(`Data creazione: ${new Date(plan.createdAt || plan.created_at).toLocaleDateString('it-IT')}`);
    doc.moveDown(1.5);

    const workouts = typeof plan.workouts === 'string' ? JSON.parse(plan.workouts) : plan.workouts;

    workouts.forEach((workout) => {
      if (doc.y > 650) doc.addPage();

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text(workout.day);
      doc.fillColor('black');
      doc.moveDown(0.5);

      const startX = 50;
      const colWidths = [200, 50, 80, 50];

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Esercizio', startX, doc.y, { width: colWidths[0] });
      doc.text('Serie', startX + colWidths[0], doc.y - 11, { width: colWidths[1] });
      doc.text('Ripetizioni', startX + colWidths[0] + colWidths[1], doc.y - 11, { width: colWidths[2] });
      doc.text('Pausa', startX + colWidths[0] + colWidths[1] + colWidths[2], doc.y - 11, { width: colWidths[3] });
      doc.moveDown(0.3);

      doc.moveTo(startX, doc.y).lineTo(startX + 380, doc.y).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(9);
      workout.exercises.forEach(ex => {
        const y = doc.y;
        doc.text(ex.name, startX, y, { width: colWidths[0] });
        doc.text(ex.sets, startX + colWidths[0], y, { width: colWidths[1] });
        doc.text(ex.reps, startX + colWidths[0] + colWidths[1], y, { width: colWidths[2] });
        doc.text(ex.rest, startX + colWidths[0] + colWidths[1] + colWidths[2], y, { width: colWidths[3] });
        doc.moveDown(0.5);
      });
      doc.moveDown(1);
    });

    if (doc.y > 650) doc.addPage();
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold').text('NOTE:');
    doc.fontSize(9).font('Helvetica').text(plan.notes);
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('gray').text('Scheda generata da Coach AI - Centro Fitness Amati');

    doc.end();
    stream.on('finish', () => resolve({ filepath, filename }));
    stream.on('error', reject);
  });
}

function formatWorkoutForWhatsApp(plan) {
  const workouts = typeof plan.workouts === 'string' ? JSON.parse(plan.workouts) : plan.workouts;

  let message = `*SCHEDA ALLENAMENTO*\n`;
  message += `------------------\n`;
  message += `${plan.clientName || plan.client_name}\n`;
  message += `Obiettivo: ${plan.objective}\n`;
  message += `${plan.daysPerWeek || plan.days_per_week} giorni/settimana\n\n`;

  workouts.forEach((workout) => {
    message += `*${workout.day}*\n`;
    workout.exercises.forEach(ex => {
      message += `- ${ex.name}: ${ex.sets}x${ex.reps} (${ex.rest})\n`;
    });
    message += `\n`;
  });

  message += `*Note:* ${plan.notes}\n\nBuon allenamento!`;
  return message;
}

// ========== API ROUTES ==========

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'coach-ai-backend', database: 'postgresql' });
});

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({
      totalClients: parseInt(stats.total_clients) || 0,
      activeToday: parseInt(stats.active_today) || 0,
      messagesThisWeek: parseInt(stats.messages_this_week) || 0,
      responseRate: 94
    });
  } catch (error) {
    console.error('Errore stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await db.getAllClients();
    res.json(clients.map(c => ({
      phone: c.phone,
      name: c.name || `Cliente ${c.phone.slice(-4)}`,
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

// Conversations list
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await db.getConversationsList();
    res.json(conversations.map(c => ({
      phone: c.phone,
      name: c.name || `Cliente ${c.phone.slice(-4)}`,
      lastMessage: c.last_message || '',
      timestamp: c.message_time || c.last_activity,
      unread: 0
    })));
  } catch (error) {
    console.error('Errore conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Single conversation
app.get('/api/conversations/:phone', async (req, res) => {
  try {
    const messages = await db.getMessages(req.params.phone);
    res.json(messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      isReminder: m.is_reminder,
      isWorkoutPlan: m.is_workout_plan
    })));
  } catch (error) {
    console.error('Errore conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reminders config
app.get('/api/reminders/config', async (req, res) => {
  try {
    const config = await db.getConfig('reminders');
    res.json(config || reminderConfig);
  } catch (error) {
    res.json(reminderConfig);
  }
});

app.post('/api/reminders/config', async (req, res) => {
  try {
    const { enabled, checkIntervalMinutes, thresholds } = req.body;

    if (typeof enabled === 'boolean') reminderConfig.enabled = enabled;
    if (checkIntervalMinutes > 0) reminderConfig.checkIntervalMinutes = checkIntervalMinutes;
    if (Array.isArray(thresholds)) reminderConfig.inactivityThresholds = thresholds;

    await db.setConfig('reminders', reminderConfig);

    res.json({ success: true, config: reminderConfig });
  } catch (error) {
    console.error('Errore save config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reminders/check', async (req, res) => {
  await checkInactiveClients();
  res.json({ success: true, message: 'Controllo promemoria eseguito' });
});

app.get('/api/reminders/stats', async (req, res) => {
  try {
    const clients = await db.getAllClients();
    const sentReminders = await db.getAllSentReminders();
    res.json({
      totalClientTracked: clients.length,
      remindersEnabled: reminderConfig.enabled,
      remindersSent: sentReminders.map(r => ({
        phone: r.phone,
        reminderDays: r.reminder_days
      }))
    });
  } catch (error) {
    console.error('Errore reminder stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== AI CONFIG ==========

app.get('/api/ai/config', async (req, res) => {
  try {
    const savedConfig = await db.getConfig('ai');
    res.json(savedConfig || aiConfig);
  } catch (error) {
    res.json(aiConfig);
  }
});

app.post('/api/ai/config', async (req, res) => {
  try {
    const { gymName, coachName, personality, useEmoji, systemPrompt } = req.body;

    if (gymName) aiConfig.gymName = gymName;
    if (coachName) aiConfig.coachName = coachName;
    if (personality) aiConfig.personality = personality;
    if (typeof useEmoji === 'boolean') aiConfig.useEmoji = useEmoji;
    if (systemPrompt) aiConfig.systemPrompt = systemPrompt;

    await db.setConfig('ai', aiConfig);

    console.log('Configurazione AI aggiornata:', { gymName: aiConfig.gymName, coachName: aiConfig.coachName });

    res.json({ success: true, config: aiConfig });
  } catch (error) {
    console.error('Errore save AI config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/reset', async (req, res) => {
  try {
    // Reset al prompt di default
    aiConfig = {
      gymName: 'Centro Fitness Amati',
      coachName: 'Coach AI',
      personality: 'amichevole e motivante',
      useEmoji: true,
      systemPrompt: `Sei un personal trainer virtuale amichevole e motivante.
Il tuo nome è Coach AI e lavori per una palestra.

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

Dopo aver raccolto le info, genera una scheda di allenamento personalizzata.`
    };

    await db.setConfig('ai', aiConfig);

    res.json({ success: true, config: aiConfig });
  } catch (error) {
    console.error('Errore reset AI config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai/preview', (req, res) => {
  res.json({
    prompt: getSystemPrompt(),
    config: {
      gymName: aiConfig.gymName,
      coachName: aiConfig.coachName,
      useEmoji: aiConfig.useEmoji
    }
  });
});

// Workouts
app.get('/api/workouts', async (req, res) => {
  try {
    const plans = await db.getAllWorkoutPlans();
    res.json(plans.map(p => ({
      id: p.id,
      phone: p.phone,
      clientName: p.client_name,
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

app.get('/api/workouts/:phone', async (req, res) => {
  try {
    const plans = await db.getWorkoutPlansByPhone(req.params.phone);
    res.json(plans.map(p => ({
      id: p.id,
      phone: p.phone,
      clientName: p.client_name,
      objective: p.objective,
      experience: p.experience,
      daysPerWeek: p.days_per_week,
      limitations: p.limitations,
      workouts: typeof p.workouts === 'string' ? JSON.parse(p.workouts) : p.workouts,
      notes: p.notes,
      createdAt: p.created_at
    })));
  } catch (error) {
    console.error('Errore workouts phone:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workouts/generate', async (req, res) => {
  try {
    const { phone, name, objective, experience, daysPerWeek, limitations } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Numero telefono richiesto' });
    }

    // Assicurati che il cliente esista
    await db.upsertClient(phone, { name, objective, experience, daysPerWeek, limitations });

    const plan = await generateWorkoutPlan({
      phone,
      name: name || `Cliente ${phone.slice(-4)}`,
      objective: objective || 'tonificare',
      experience: experience || 'intermedio',
      daysPerWeek: daysPerWeek || 3,
      limitations: limitations || 'Nessuna'
    });

    res.json({ success: true, plan });
  } catch (error) {
    console.error('Errore generazione scheda:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workouts/:phone/:planId/pdf', async (req, res) => {
  try {
    const plan = await db.getWorkoutPlan(req.params.planId);
    if (!plan) {
      return res.status(404).json({ error: 'Scheda non trovata' });
    }

    const { filepath, filename } = await generateWorkoutPDF(plan);
    res.download(filepath, filename);
  } catch (error) {
    console.error('Errore PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workouts/:phone/:planId/send', async (req, res) => {
  try {
    const plan = await db.getWorkoutPlan(req.params.planId);
    if (!plan) {
      return res.status(404).json({ error: 'Scheda non trovata' });
    }

    const message = formatWorkoutForWhatsApp(plan);
    await sendWhatsAppMessage(req.params.phone, message);
    await db.addMessage(req.params.phone, 'assistant', message, { isWorkoutPlan: true });

    res.json({ success: true, message: 'Scheda inviata via WhatsApp' });
  } catch (error) {
    console.error('Errore invio scheda:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/workouts/:phone/:planId', async (req, res) => {
  try {
    const deleted = await db.deleteWorkoutPlan(req.params.planId);
    if (!deleted) {
      return res.status(404).json({ error: 'Scheda non trovata' });
    }
    res.json({ success: true, message: 'Scheda eliminata' });
  } catch (error) {
    console.error('Errore eliminazione:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workouts-stats', async (req, res) => {
  try {
    const stats = await db.getWorkoutStats();
    res.json({
      totalPlans: parseInt(stats.total_plans) || 0,
      clientsWithPlans: parseInt(stats.clients_with_plans) || 0,
      byObjective: {
        dimagrire: parseInt(stats.dimagrire) || 0,
        massa: parseInt(stats.massa) || 0,
        tonificare: parseInt(stats.tonificare) || 0,
        salute: parseInt(stats.salute) || 0
      }
    });
  } catch (error) {
    console.error('Errore workout stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== WHATSAPP MANAGEMENT ==========

// Get WhatsApp connection status
app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const response = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );
    res.json({
      connected: response.data.instance?.state === 'open',
      state: response.data.instance?.state || 'unknown',
      instanceName: INSTANCE_NAME
    });
  } catch (error) {
    console.error('Errore status WhatsApp:', error.response?.data || error.message);
    res.json({ connected: false, state: 'error', error: error.message });
  }
});

// Get QR Code for WhatsApp connection
app.get('/api/whatsapp/qrcode', async (req, res) => {
  try {
    // First check if instance exists and get its status
    let instanceExists = false;
    let instanceState = 'unknown';

    try {
      const fetchResponse = await axios.get(
        `${EVOLUTION_API_URL}/instance/fetchInstances`,
        { headers: { 'apikey': EVOLUTION_API_KEY } }
      );
      const instance = fetchResponse.data?.find(i => i.name === INSTANCE_NAME || i.instance?.instanceName === INSTANCE_NAME);
      if (instance) {
        instanceExists = true;
        instanceState = instance.connectionStatus || instance.instance?.state || 'unknown';
        console.log(`Instance ${INSTANCE_NAME} found, state: ${instanceState}`);
      }
    } catch (e) {
      console.log('Error checking instances:', e.message);
    }

    // If connected, no QR needed
    if (instanceState === 'open') {
      return res.json({ connected: true, qrcode: null });
    }

    // If instance exists, try to connect (get QR)
    if (instanceExists) {
      try {
        const connectResponse = await axios.get(
          `${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`,
          { headers: { 'apikey': EVOLUTION_API_KEY } }
        );

        if (connectResponse.data.qrcode?.base64) {
          return res.json({
            connected: false,
            qrcode: connectResponse.data.qrcode.base64,
            pairingCode: connectResponse.data.pairingCode
          });
        } else if (connectResponse.data.base64) {
          return res.json({
            connected: false,
            qrcode: connectResponse.data.base64,
            pairingCode: connectResponse.data.pairingCode
          });
        } else if (connectResponse.data.instance?.state === 'open') {
          return res.json({ connected: true, qrcode: null });
        }

        // No QR in response, return current state
        return res.json({
          connected: false,
          qrcode: null,
          state: instanceState,
          message: 'Instance exists but no QR available. Try refreshing.'
        });
      } catch (connectError) {
        console.log('Connect error:', connectError.response?.data || connectError.message);
        // Continue to try creating if connect fails
      }
    }

    // Instance doesn't exist, create it
    console.log(`Creating new instance: ${INSTANCE_NAME}`);
    const createResponse = await axios.post(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        instanceName: INSTANCE_NAME,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: `http://backend:3000/webhook`,
        webhookByEvents: true,
        webhookEvents: ['messages.upsert']
      },
      { headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY } }
    );

    res.json({
      connected: false,
      qrcode: createResponse.data.qrcode?.base64 || createResponse.data.base64 || null,
      pairingCode: createResponse.data.pairingCode
    });
  } catch (error) {
    console.error('Errore QR WhatsApp:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// Disconnect WhatsApp
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    await axios.delete(
      `${EVOLUTION_API_URL}/instance/logout/${INSTANCE_NAME}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );
    res.json({ success: true, message: 'WhatsApp disconnesso' });
  } catch (error) {
    console.error('Errore disconnect WhatsApp:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// Restart WhatsApp instance (for new QR)
app.post('/api/whatsapp/restart', async (req, res) => {
  try {
    // Try restart first
    try {
      const restartResponse = await axios.post(
        `${EVOLUTION_API_URL}/instance/restart/${INSTANCE_NAME}`,
        {},
        { headers: { 'apikey': EVOLUTION_API_KEY } }
      );
      if (restartResponse.data) {
        // After restart, try to get new QR
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
        const connectResponse = await axios.get(
          `${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`,
          { headers: { 'apikey': EVOLUTION_API_KEY } }
        );
        return res.json({
          success: true,
          qrcode: connectResponse.data.qrcode?.base64 || connectResponse.data.base64 || null,
          pairingCode: connectResponse.data.pairingCode
        });
      }
    } catch (restartError) {
      console.log('Restart failed, trying connect directly:', restartError.response?.data || restartError.message);
    }

    // If restart fails, just try to connect
    const connectResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );

    res.json({
      success: true,
      qrcode: connectResponse.data.qrcode?.base64 || connectResponse.data.base64 || null,
      pairingCode: connectResponse.data.pairingCode
    });
  } catch (error) {
    console.error('Errore restart WhatsApp:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// Get WhatsApp instance info
app.get('/api/whatsapp/info', async (req, res) => {
  try {
    const response = await axios.get(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    );
    const instance = response.data.find(i => i.name === INSTANCE_NAME);
    if (instance) {
      res.json({
        instanceName: instance.name,
        status: instance.connectionStatus,
        ownerJid: instance.ownerJid,
        profileName: instance.profileName,
        profilePicUrl: instance.profilePicUrl
      });
    } else {
      res.json({ instanceName: INSTANCE_NAME, status: 'not_found' });
    }
  } catch (error) {
    console.error('Errore info WhatsApp:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========== STARTUP ==========

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Inizializza database
    await db.initDatabase();
    console.log('Database PostgreSQL connesso');

    // Carica configurazione promemoria dal DB
    const savedConfig = await db.getConfig('reminders');
    if (savedConfig) {
      reminderConfig = { ...reminderConfig, ...savedConfig };
    }

    // Carica configurazione AI dal DB
    const savedAiConfig = await db.getConfig('ai');
    if (savedAiConfig) {
      aiConfig = { ...aiConfig, ...savedAiConfig };
      console.log('Configurazione AI caricata:', { gymName: aiConfig.gymName, coachName: aiConfig.coachName });
    }

    app.listen(PORT, () => {
      console.log(`Coach AI Backend running on port ${PORT}`);
      startReminderScheduler();
    });
  } catch (error) {
    console.error('Errore avvio server:', error);
    process.exit(1);
  }
}

startServer();
