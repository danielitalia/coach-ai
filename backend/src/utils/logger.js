const pino = require('pino');

// Configurazione standard Pino
// Se in dev, usiamo pino-pretty per avere i log leggibili
// Se in prod, pino stampa veloce in formato JSON grezzo
const isDev = process.env.NODE_ENV !== 'production';

const transport = isDev
    ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    }
    : undefined;

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport,
});

module.exports = logger;
