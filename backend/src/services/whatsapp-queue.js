const { Queue, Worker } = require('bullmq');
const axios = require('axios');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
if (!EVOLUTION_API_KEY) {
  console.warn('[WhatsApp Queue] EVOLUTION_API_KEY not set - message sending will fail');
}

// Setup la connettività Redis per BullMQ
const redisOptions = {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    // Se si esegue in locale, usare localhost
    ...(process.env.NODE_ENV !== 'production' && { host: '127.0.0.1' }),
    maxRetriesPerRequest: null // Richiesto da BullMQ
};

console.log(`[Queue] Inizializzazione BullMQ su Redis ${redisOptions.host}:${redisOptions.port}`);

// 1. Creiamo la Coda (Queue)
const whatsappQueue = new Queue('whatsapp-broadcasts', {
    connection: redisOptions,
    defaultJobOptions: {
        attempts: 3, // Riprova 3 volte
        backoff: {
            type: 'exponential',
            delay: 5000 // Aspetta 5s, poi 25s, ecc... se fallisce
        },
        removeOnComplete: true, // Non intasare Redis con i lavori vecchi
        removeOnFail: false // Tieni traccia di quelli falliti
    }
});

// 2. Creiamo il Lavoratore (Worker)
// Il worker processa un messaggio alla volta (concurrency: 1)
const worker = new Worker('whatsapp-broadcasts', async job => {
    const { tenantId, phone, message, instanceName } = job.data;

    if (!phone || !message) {
        throw new Error('Telefono o messaggio mancanti nel job');
    }

    const targetInstance = instanceName || 'palestra';

    try {
        // Esegue la chiamata HTTP reale a Evolution API
        await axios.post(
            `${EVOLUTION_API_URL}/message/sendText/${targetInstance}`,
            {
                number: phone,
                text: message
            },
            { headers: { 'apikey': EVOLUTION_API_KEY }, timeout: 15000 }
        );

        // RITARDO FORZATO ANTI-BAN (RATE LIMITING)
        // 2000 millisecondi (2 secondi) tra un messaggio e l'altro
        // Garantisce massimo ~30 messaggi al minuto.
        await new Promise(resolve => setTimeout(resolve, 2000));

        return { success: true, phone };
    } catch (error) {
        // Se fallisce, logghiamo e passiamo l'errore a BullMQ per il retry automatico
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[Queue] Fallito invio a ${phone} su istanza ${targetInstance}: ${errorDetails}`);
        throw error;
    }
}, {
    connection: redisOptions,
    concurrency: 1, // ELABORAZIONE SEQUENZIALE: Un messaggio alla volta assoluto
});

// Gestione eventi del Worker per monitoring e log
worker.on('completed', job => {
    console.log(`[Queue] ✅ Messaggio Broadcast recapitato a ${job.data.phone}`);
});

worker.on('failed', (job, err) => {
    console.error(`[Queue] ❌ Job ${job.id} fallito (tentativo ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
});

/**
 * Funzione pubblica per aggiungere un messaggio alla coda di invio.
 * Sostituisce la chiamata diretta ad `axios.post` per gli invii massivi.
 */
async function enqueueWhatsAppMessage(tenantId, instanceName, phone, message) {
    try {
        const job = await whatsappQueue.add('send-message', {
            tenantId,
            instanceName,
            phone,
            message
        });
        return { success: true, jobId: job.id };
    } catch (error) {
        console.error(`[Queue] Errore critico durante l'inserimento in coda per ${phone}:`, error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    enqueueWhatsAppMessage,
    whatsappQueue
};
