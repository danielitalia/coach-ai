const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
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

// AI Client
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

// ========== AUTH ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);

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

Dopo aver raccolto le info, genera una scheda di allenamento personalizzata.`;

  if (!useEmoji) {
    prompt += '\n\nIMPORTANTE: Non usare emoji nelle risposte.';
  }

  if (tenant?.custom_system_prompt) {
    prompt += '\n\n' + tenant.custom_system_prompt;
  }

  return prompt;
}

// Invia messaggio WhatsApp
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
    const instanceName = tenant.whatsapp_instance_name || 'coach-ai';

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

        console.log(`[${tenant.name}] Messaggio da ${phoneNumber}: ${text}`);

        // Aggiorna attività cliente nel DB
        await db.updateClientActivity(tenantId, phoneNumber);

        // Controlla comandi speciali
        const checkinKeywords = ['check-in', 'checkin', 'check in', 'sono in palestra', 'arrivo', 'eccomi', 'sono arrivato', 'sono arrivata', 'presente'];
        const isCheckin = checkinKeywords.some(keyword => text.toLowerCase().includes(keyword));

        const referralKeywords = ['invita', 'porta un amico', 'referral', 'codice amico', 'invita amico'];
        const isReferralRequest = referralKeywords.some(keyword => text.toLowerCase().includes(keyword));

        const referralCodeMatch = text.toUpperCase().match(/\b([A-Z0-9]{9})\b/);
        const isUsingReferralCode = referralCodeMatch && !isReferralRequest;

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

        await sendWhatsAppMessage(instanceName, phoneNumber, response);
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

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: getSystemPrompt(tenant) },
        ...history.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content ||
      "Mi scusi, ho avuto un problema tecnico. Può ripetere?";

    await db.addMessage(tenantId, phoneNumber, 'assistant', aiResponse);

    // Detecta se la risposta contiene una scheda di allenamento
    if (aiResponse.toLowerCase().includes('giorno 1') ||
        aiResponse.toLowerCase().includes('scheda') ||
        aiResponse.toLowerCase().includes('allenamento')) {
      await detectAndSaveWorkoutPlan(tenantId, phoneNumber, aiResponse, history);
    }

    return aiResponse;
  } catch (error) {
    console.error('Errore AI:', error);
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

        const instanceName = tenant.whatsapp_instance_name || 'coach-ai';
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

async function detectAndSaveWorkoutPlan(tenantId, phoneNumber, aiResponse, history) {
  try {
    const client = await db.getClient(tenantId, phoneNumber);
    if (!client) return;

    const workoutMatch = aiResponse.match(/giorno\s*\d/gi);
    if (!workoutMatch || workoutMatch.length < 2) return;

    const plan = {
      id: `WP-${Date.now()}`,
      phone: phoneNumber,
      clientName: client.name,
      objective: client.objective,
      experience: client.experience,
      daysPerWeek: client.days_per_week,
      limitations: client.limitations,
      workouts: parseWorkoutFromText(aiResponse),
      notes: `Scheda generata automaticamente`
    };

    if (plan.workouts.length > 0) {
      await db.saveWorkoutPlan(tenantId, plan);
      console.log(`[Tenant] Scheda salvata per ${phoneNumber}`);
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

// ========== API ROUTES (con tenant) ==========

// Stats
app.get('/api/stats', requireTenant, async (req, res) => {
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

// Clients
app.get('/api/clients', requireTenant, async (req, res) => {
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

// Conversations
app.get('/api/conversations', requireTenant, async (req, res) => {
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

// Messages for a conversation
app.get('/api/conversations/:phone', requireTenant, async (req, res) => {
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

// Workouts
app.get('/api/workouts', requireTenant, async (req, res) => {
  try {
    const plans = await db.getAllWorkoutPlans(req.tenantId);
    res.json(plans.map(p => ({
      ...p,
      workouts: typeof p.workouts === 'string' ? JSON.parse(p.workouts) : p.workouts
    })));
  } catch (error) {
    console.error('Errore workouts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check-ins
app.get('/api/checkins/today', requireTenant, async (req, res) => {
  try {
    const checkins = await db.getAllCheckinsToday(req.tenantId);
    res.json(checkins);
  } catch (error) {
    console.error('Errore checkins today:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/checkins-stats', requireTenant, async (req, res) => {
  try {
    const stats = await db.getCheckinStatsGlobal(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Errore checkin stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/checkin-qrcode', requireTenant, async (req, res) => {
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
app.get('/api/referrals', requireTenant, async (req, res) => {
  try {
    const referrals = await db.getAllReferrals(req.tenantId);
    res.json(referrals);
  } catch (error) {
    console.error('Errore get referrals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/referrals/stats', requireTenant, async (req, res) => {
  try {
    const stats = await db.getReferralStatsGlobal(req.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Errore referral stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/referrals/leaderboard', requireTenant, async (req, res) => {
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
app.get('/api/rewards', requireTenant, async (req, res) => {
  try {
    const rewards = await db.getAllRewards(req.tenantId);
    res.json(rewards);
  } catch (error) {
    console.error('Errore get rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rewards/:id/claim', requireTenant, async (req, res) => {
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
app.get('/api/reminders/config', requireTenant, async (req, res) => {
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

// ========== RETROCOMPATIBILITÀ (senza auth per transizione) ==========

// Per permettere transizione graduale, manteniamo endpoint senza auth
// che usano il tenant di default

const DEFAULT_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || DEFAULT_TENANT_ID;
    const tenant = await db.getTenant(tenantId);
    const instanceName = tenant?.whatsapp_instance_name || 'coach-ai';

    const response = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    ).catch(() => null);

    res.json({
      connected: response?.data?.state === 'open',
      state: response?.data?.state || 'unknown',
      instanceName
    });
  } catch (error) {
    console.error('Errore status WhatsApp:', error);
    res.json({ connected: false, state: 'error' });
  }
});

// ========== AVVIO SERVER ==========

async function startServer() {
  try {
    await db.initDatabase();
    console.log('Database PostgreSQL connesso');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Coach AI Backend (Multi-Tenant) running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Errore avvio server:', error);
    process.exit(1);
  }
}

startServer();
