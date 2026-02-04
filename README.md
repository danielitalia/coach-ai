# Coach AI - Personal Trainer Virtuale

Sistema di coaching automatizzato via WhatsApp per palestre.

## Struttura

```
coach-ai/
├── docker-compose.yml    # Orchestrazione container
├── .env                  # Variabili ambiente
├── backend/              # Backend Node.js
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── index.js      # Server principale
└── README.md
```

## Avvio

### 1. Avvia i servizi

```bash
cd /Users/finalcut/Desktop/coach-ai
docker-compose up -d
```

### 2. Verifica che tutto funzioni

```bash
# Controlla i container
docker-compose ps

# Vedi i log
docker-compose logs -f
```

### 3. Configura WhatsApp

1. Apri: http://localhost:8080/manager
2. Crea istanza "coach-ai"
3. Scansiona QR code con WhatsApp

### 4. Testa

Scrivi un messaggio WhatsApp al numero collegato.

## API Endpoints

- `GET /health` - Health check
- `POST /webhook` - Riceve messaggi da Evolution API
- `GET /api/clients` - Lista clienti
- `GET /api/conversations/:phone` - Storia conversazione

## Costi

- Evolution API: Gratis (self-hosted)
- OpenRouter (AI): ~$0.01-0.03 per messaggio
- Hosting: Il tuo Mac / VPS ~$5-10/mese
