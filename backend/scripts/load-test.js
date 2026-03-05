const autocannon = require('autocannon');
const logger = require('../src/utils/logger'); // Utilizziamo il nuovo logger strutturato
require('dotenv').config();

const URL = process.env.API_URL || 'http://localhost:3001';
const TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'demo-fitness';
const DURATION = 30; // 30 secondi di test
const CONNECTIONS = 100; // 100 connessioni simultanee

logger.info(`Starting load test on ${URL} per il tenant ${TENANT_SLUG}...`);

// Simulatore di webhook di WhatsApp per testare il rate limiter e il DB sotto carico
const testWebhook = () => {
    return new Promise((resolve, reject) => {
        const instance = autocannon({
            url: `${URL}/webhook/chatwoot/${TENANT_SLUG}`,
            connections: CONNECTIONS,
            duration: DURATION,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: 'message_created',
                message_type: 'incoming',
                content: 'Ciao, vorrei info sulla palestra!',
                conversation: {
                    meta: {
                        sender: {
                            phone_number: '+393331234567',
                            name: 'Test User'
                        }
                    }
                }
            })
        });

        autocannon.track(instance, { renderProgressBar: true });

        instance.on('done', (result) => {
            logger.info(result, 'Load Test Completed');
            resolve(result);
        });

        instance.on('error', (err) => {
            logger.error('Error in load test:', err);
            reject(err);
        });
    });
};

testWebhook().catch(console.error);
