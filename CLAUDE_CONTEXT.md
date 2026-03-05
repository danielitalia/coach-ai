# Coach AI - Contesto per Claude

## Panoramica del Progetto
Coach AI è un **personal trainer virtuale WhatsApp** per palestre. I clienti possono chattare via WhatsApp con un AI che risponde come un coach, genera schede di allenamento personalizzate, gestisce check-in, referral e premi.

## Architettura

### Stack Tecnologico
- **Backend**: Node.js + Express (index-multitenant.js)
- **Database**: PostgreSQL (multi-tenant)
- **WhatsApp**: Evolution API v2.3.7 (evoapicloud/evolution-api:latest) con CACHE_REDIS_ENABLED=false
- **AI**: Groq API (llama-3.3-70b-versatile) - GRATUITO
- **Dashboard**: React + Vite + TailwindCSS + Recharts
- **Hosting**: Coolify su server Hetzner (46.225.16.97)
- **Dominio**: https://coachpalestra.it/
- **Marketing Automation**: node-cron scheduler per messaggi automatici
- **Brain AI**: Sistema intelligente con scoring, analisi conversazioni e azioni automatiche
- **Message Queue**: BullMQ + Redis per invio WhatsApp con retry automatici
- **Monitoring**: Sistema di monitoraggio 24/7 con alert Telegram
- **Analytics**: Sistema di metriche e grafici con dati storici

### Container Docker in Produzione
```
- backend-z80wkw4o800cs4s408cccwwg (Node.js backend)
- dashboard-z80wkw4o800cs4s408cccwwg (Nginx + React)
- evolution-api-z80wkw4o800cs4s408cccwwg (WhatsApp gateway)
- evolution-db-z80wkw4o800cs4s408cccwwg (PostgreSQL per Evolution)
- v8k04c8kkwwc480s8g44s0gg (PostgreSQL principale)
- redis (Redis per BullMQ message queue)
```

### Credenziali Server
- **IP**: 46.225.16.97
- **SSH**: root@46.225.16.97
- **Password**: [vedi .env o Coolify]

### Credenziali Evolution API
- **URL interna (tra container)**: http://evolution-api:8080
- **URL esterna**: http://46.225.16.97:8085
- **API Key**: 065aa73d6bbdeaa4a9a0c7b94a8db194
- **Manager**: http://46.225.16.97:8085/manager
- **IMPORTANTE**: Redis è disabilitato (CACHE_REDIS_ENABLED=false)
- **Formato risposta connectionState**: `{instance: {instanceName: "...", state: "open"}}` → usare `data.instance.state`

### Database Principale
- **Host**: v8k04c8kkwwc480s8g44s0gg (container)
- **User**: postgres
- **Password**: [vedi Coolify]
- **Database**: postgres

### AI Provider (Groq - GRATUITO)
- **Base URL**: https://api.groq.com/openai/v1
- **API Key**: [vedi .env - OPENAI_API_KEY / gsk_...]
- **Model**: llama-3.3-70b-versatile
- **Variabile nel codice**: `OPENAI_MODEL` (NON AI_MODEL)
- **Limiti gratuiti**: ~14,400 richieste/giorno, ~500,000 token/giorno

### Telegram Bot (Monitoring Alerts)
- **Bot**: @daniel0805bot
- **Token**: [vedi .env - TELEGRAM_BOT_TOKEN]
- **Chat ID**: 1483894435
- **Uso**: Riceve alert automatici quando servizi vanno offline

## File Principali

### Backend
- `/backend/src/index-multitenant.js` - Entry point principale con tutte le API
- `/backend/db/database-multitenant.js` - Funzioni database (CRUD + Automation + Analytics)
- `/backend/db/migrations/003-automation.sql` - Schema tabelle automation
- `/backend/db/migrations/005-monitoring.sql` - Schema tabelle monitoring
- `/backend/db/migrations/006-onboarding.sql` - Schema tabelle onboarding
- `/backend/db/migrations/007-analytics.sql` - Schema tabelle analytics
- `/backend/src/automation/index.js` - Scheduler marketing automation
- `/backend/src/automation/handlers/inactivity.js` - Handler reminder inattività
- `/backend/src/automation/handlers/followups.js` - Handler follow-up post-checkin
- `/backend/src/automation/handlers/milestones.js` - Handler celebrazione streak
- `/backend/src/automation/templates.js` - Template messaggi con variabili
- `/backend/src/routes/auth.js` - Autenticazione JWT
- `/backend/src/routes/tenants.js` - API tenant (WhatsApp status, QR code, ecc.)
- `/backend/src/middleware/auth.js` - Middleware: requireAuth, requireSuperadmin, requireTenant, identifyTenantFromWhatsApp
- `/backend/src/monitoring/index.js` - Sistema monitoring 24/7 con alert Telegram
- `/backend/src/services/whatsapp-queue.js` - BullMQ queue per invio WhatsApp con retry automatici
- `/backend/src/brain/index.js` - Orchestratore Brain AI (scheduler cron ogni 6h)
- `/backend/src/brain/scoring.js` - Scoring Engine: calcola churn_risk, engagement, consistency
- `/backend/src/brain/analyzer.js` - Conversation Analyzer: sentiment, motivazione, estrazione nomi
- `/backend/src/brain/actions.js` - Smart Actions Engine: decisioni score-based + invio messaggi AI
- `/backend/db/migrations/009-brain.sql` - Schema tabelle Brain (client_scoring, conversation_signals, brain_actions)
- `/backend/db/migrations/010-brain-settings.sql` - Schema brain_settings (configurazione per-tenant)
- `/backend/Dockerfile.prod` - Docker per produzione

### Dashboard
- `/dashboard/src/App.jsx` - Router principale
- `/dashboard/src/components/Analytics.jsx` - Dashboard analytics con grafici Recharts
- `/dashboard/src/components/Automations.jsx` - Gestione marketing automation
- `/dashboard/src/components/SuperAdmin.jsx` - Gestione palestre, monitoring e analytics globali
- `/dashboard/src/components/OnboardingWizard.jsx` - Wizard 4 step per nuove palestre
- `/dashboard/src/components/WorkoutPlans.jsx` - Gestione schede
- `/dashboard/src/components/ClientList.jsx` - Lista clienti
- `/dashboard/src/components/RegisterPage.jsx` - Registrazione nuovi utenti
- `/dashboard/src/components/BrainSettings.jsx` - Pagina configurazione Brain AI per tenant
- `/dashboard/src/components/ChurnAlert.jsx` - Dashboard warning clienti a rischio churn
- `/dashboard/src/contexts/AuthContext.jsx` - Context autenticazione (authFetch helper, JWT refresh)
- `/dashboard/nginx.conf` - Configurazione Nginx
- `/dashboard/.env` - VITE_API_URL='' (vuoto! usa URL relativi per Traefik)

### Docker/Deploy
- `/docker-compose.prod.yml` - Compose per Coolify
- Il deploy avviene via GitHub → Coolify (auto-deploy su push)

### Reverse Proxy (Traefik)
- **Config**: `/traefik/dynamic/coachpalestra.yaml` (dentro container coolify-proxy)
- `coachpalestra.it/api/*` e `/scheda/*` (priority 100) → `http://backend-z80wkw4o800cs4s408cccwwg:3000`
- `coachpalestra.it/*` (priority 1) → `http://dashboard-z80wkw4o800cs4s408cccwwg:80`
- **IMPORTANTE**: `VITE_API_URL` deve essere vuoto (NON l'IP del server) — le fetch usano URL relativi che Traefik inoltra al backend

## Funzionalità Implementate

### WhatsApp Bot
- Risponde ai messaggi dei clienti come un coach
- Genera schede di allenamento personalizzate via AI
- Invia PDF delle schede
- Gestisce check-in in palestra
- Sistema referral con codici
- Sistema premi/rewards (Referral + Loyalty)
- **Sistema Loyalty (NUOVO!)**: premi automatici ogni 10 check-in totali

### Marketing Automation
- **Reminder Inattività**: messaggi automatici dopo 3, 7, 14 giorni senza check-in
- **Follow-up Post-Checkin**: messaggio motivazionale 1h dopo check-in
- **Milestone Streak**: celebrazione per 5, 10, 20 giorni consecutivi
- **Prevenzione Duplicati**: non reinvia se già inviato
- **Multi-tenant**: funziona per tutti i tenant
- **Scheduler**: esegue automaticamente ogni ora alle :05
- **Dashboard**: pagina dedicata per gestire/modificare le sequenze
- **Variabile Referral**: supporto per `{{referral_code}}` in tutti i template (risoluzione asincrona)

### Dashboard Web
- Login multi-tenant (ogni palestra ha il suo account)
- **Isolamento completo**: ogni tenant vede solo i propri dati (client, messaggi, schede, analytics)
- **Churn Alert**: pannello warning con lista clienti a rischio abbandono (churn_risk ≥ 0.6), con indicatori motivazione e giorni di inattività
- **Brain Settings**: configurazione parametri Brain AI per-tenant (soglie, limiti, orari)
- Visualizzazione clienti e conversazioni
- **Gestione Schede**: modifica visuale delle schede di allenamento, download PDF autenticato
- **Automazioni**: gestione sequenze marketing, storico invii, statistiche
- **Analytics**: grafici messaggi, check-in, clienti, automazioni
- Invio messaggi manuali ai clienti
- QR code per check-in
- Connessione WhatsApp con QR code
- **Autenticazione**: JWT con `authFetch` helper (aggiunge Bearer token, gestisce 401/refresh)
- **Campagne Referral**: invio massivo proattivo (broadcast) di codici referral a tutti i clienti attivi

### SuperAdmin (/superadmin)
- **Accesso**: Login con admin@centrofitnessamati.it / Coach2024 (is_superadmin=true nel DB)
- **Autenticazione**: JWT + middleware `requireSuperadmin` (NON più password hardcoded)
- Gestione multi-tenant (crea/modifica/elimina palestre)
- **Stato WhatsApp real-time**: ogni caricamento della lista chiama Evolution API per aggiornare lo stato
- **Bottone refresh** con animazione spin per aggiornamento immediato
- **Validazione istanze duplicate**: impossibile assegnare la stessa istanza WhatsApp a due tenant
- **Gestione Abbonamenti**: piano, stato, scadenza, prezzo, note
- **Tab Monitoring**: stato servizi, alert history, test Telegram
- **Tab Analytics**: vista globale metriche tutte le palestre
- **Onboarding Links**: genera link per auto-configurazione nuove palestre
- Impersonation (accedi come una palestra)
- Statistiche globali (tenant totali, clienti, messaggi)
- Badge stato abbonamento (attivo, in scadenza, sospeso)
- Azioni rapide (+1 mese, +1 anno, attiva pro, sospendi)
- **Rate limit dedicato**: 1000 req/15min (vs 300 per API normale)

### Brain AI (Sistema Intelligente)

3 moduli orchestrati da `brain/index.js` con cron ogni 6 ore (00:30, 06:30, 12:30, 18:30):

**Modulo 1 — Scoring Engine** (`scoring.js`):
- Calcola per ogni cliente: `churn_risk`, `engagement_score`, `consistency_score`
- Determina `checkin_trend` (up/stable/down), `preferred_days/time`
- Fattori churn: inattività (0.35), trend (0.25), motivazione (0.20), silenzio messaggi (0.10), consistenza (0.10)
- Dati ultimi 60gg check-in + 30gg messaggi

**Modulo 2 — Conversation Analyzer** (`analyzer.js`):
- Analisi keyword-based in italiano (zero chiamate AI) su ogni messaggio in real-time
- 6 categorie segnali: frustration, pain, barrier, motivation, progress, celebration
- Aggiorna `motivation_level` (high/medium/low) basandosi sugli ultimi 10 segnali
- **Estrazione automatica nomi**: regex su "mi chiamo X", "sono X", "ciao sono X" → aggiorna `client_profiles.name`
- Blacklist nomi comuni per evitare falsi positivi

**Modulo 3 — Smart Actions Engine** (`actions.js`):
- Logica **score-based priority** (NON early-exit): valuta TUTTE le regole, assegna priorità, esegue la migliore
- 6 tipi di azione:
  1. `welcome_message` (priorità 100): nuovi clienti (<14gg, nessuna azione Brain precedente)
  2. `comeback_message` (priorità 90+): inattivi ≥14gg + churn≥0.70
  3. `streak_recovery` (priorità 80+): 3-7gg assenza + consistency≥0.50
  4. `scheda_adjust` (priorità 75): motivation=low + ancora attivo (≤7gg)
  5. `personalized_motivation` (priorità 70+): trend down o motivation low
  6. `check_progress` (priorità 50+): engagement≥0.50 + consistency≥0.50 + ≥6 checkins/mese
- Messaggi generati via AI (Groq) — personalizzati per ogni cliente
- Fallback messaggi template se AI non disponibile
- Anti-duplicato con `action_key` (tipo:telefono:data)

**Limiti e Sicurezza**:
- Max 10 messaggi/giorno per tenant
- Max 3 messaggi/settimana per cliente
- Min 24h tra messaggi allo stesso cliente
- Orari silenziosi: 22:00-07:00
- Rate limiting: 3s tra invii

**Invio messaggi via BullMQ** (`whatsapp-queue.js`):
- Retry automatico: 3 tentativi con backoff esponenziale (5s → 25s → 125s)
- Timeout 15s per chiamata a Evolution API
- Rate limiting: 2s tra messaggi (anti-ban WhatsApp)
- Concurrency 1 (sequenziale)
- Brain usa `enqueueWhatsAppMessage` anziché chiamate dirette axios

**Configurazione per-tenant** (`brain_settings`):
- Ogni palestra può personalizzare soglie, limiti e orari dal dashboard
- Settings modificabili via API `/api/brain/settings`
- Fallback a DEFAULT_SETTINGS se non configurato

### Sicurezza Multi-Tenant
- **legacyTenant middleware**: richiede JWT valido, NO fallback a tenant di default
- **requireSuperadmin middleware**: verifica `is_superadmin=true` su utente (dopo requireAuth)
- **Tutte le route superadmin/monitoring**: protette con `requireAuth + requireSuperadmin`
- **UNIQUE index** su `whatsapp_instance_name` (parziale, permette NULL multipli)
- **Webhook fallback rimosso**: se tenant non identificato → `req.tenant = null` (non fallback hardcoded)
- **PDF download**: autenticato via authFetch + blob (non più window.open)
- **Rate limiting**: 300 req/15min API generica, 1000 req/15min superadmin/monitoring

### Sistema Monitoring 24/7
- **Health Check ogni 5 minuti**: Database, Evolution API, WhatsApp per ogni tenant
- **Alert Telegram**: notifica immediata quando un servizio va offline
- **Report Giornaliero**: alle 9:00 invia riepilogo stato sistema
- **Alert Abbonamenti**: alle 10:00 notifica abbonamenti in scadenza (7 giorni)
- **Anti-duplicati**: cooldown 30 minuti tra alert identici
- **Dashboard**: tab dedicato in SuperAdmin per vedere stato e alert

### Onboarding Guidato (NUOVO!)
- **Wizard 4 Step**: Info Palestra → WhatsApp → Coach AI → Conferma
- **Link univoci**: generabili da SuperAdmin per ogni tenant
- **Token con scadenza**: 7 giorni di validità
- **Skip WhatsApp**: possibilità di saltare configurazione WhatsApp
- **Notifica Telegram**: alert quando nuova palestra completa onboarding
- **Salvataggio progressi**: dati salvati ad ogni step

### Analytics Avanzati (NUOVO!)
- **Dashboard per tenant**:
  - 4 KPI cards: Messaggi, Check-in, Nuovi Clienti, Automazioni
  - Grafico Area: Messaggi inviati/ricevuti nel tempo
  - Grafico Barre: Check-in giornalieri
  - Grafico Linee: Clienti attivi e nuovi
  - Grafico Area: Performance automazioni
  - Selettore periodo (7/14/30/90 giorni)
  - Pulsante "Ricalcola" per rigenerare stats storiche
- **SuperAdmin Analytics**:
  - Tabella tutte le palestre con metriche
  - Stato WhatsApp, clienti totali, messaggi, check-in
  - Dati ultimi 7 giorni con evidenziazione
  - Totali aggregati in footer
  - Pulsante "Ricalcola Tutte" per backfill globale

## API Endpoints Principali

```
POST /webhook - Riceve messaggi WhatsApp
GET  /api/stats - Statistiche dashboard
GET  /api/clients - Lista clienti
POST /api/clients - Crea cliente
GET  /api/conversations - Lista conversazioni
GET  /api/workouts - Lista schede
POST /api/workouts/generate - Genera scheda con AI
PUT  /api/workouts/:phone/:planId - Modifica scheda
POST /api/messages/send - Invia messaggio WhatsApp
GET  /api/whatsapp/status - Stato connessione WhatsApp
GET  /api/whatsapp/qrcode - QR code per connessione

# AUTOMATION ENDPOINTS
GET  /api/automations - Lista sequenze automation
GET  /api/automations/stats - Statistiche (inviati, falliti, ecc.)
GET  /api/automations/jobs - Storico job eseguiti
POST /api/automations/run - Trigger manuale automazioni
PUT  /api/automations/:id - Modifica sequenza (messaggio template)
POST /api/automations/:id/toggle - Abilita/disabilita sequenza
POST /api/referrals/broadcast - Invia campagna referral massiva

# ANALYTICS ENDPOINTS
GET  /api/analytics/summary - Riepilogo metriche per periodo
GET  /api/analytics/timeline - Dati per grafici temporali
GET  /api/analytics/daily - Stats giornaliere dettagliate
GET  /api/analytics/events - Eventi analytics
POST /api/analytics/backfill - Ricalcola statistiche storiche

# BRAIN AI ENDPOINTS
GET  /api/brain/overview - Overview Brain (scoring, segnali, azioni, clienti a rischio)
GET  /api/brain/settings - Settings Brain per il tenant corrente
PUT  /api/brain/settings - Aggiorna settings Brain
POST /api/brain/run - Trigger manuale ciclo Brain
GET  /api/brain/status - Stato Brain (running, initialized)

# SUPERADMIN ENDPOINTS
GET    /api/superadmin/tenants - Lista palestre con stats
POST   /api/superadmin/tenants - Crea nuova palestra
PUT    /api/superadmin/tenants/:id - Modifica palestra (incluso abbonamento)
DELETE /api/superadmin/tenants/:id - Elimina palestra
GET    /api/superadmin/tenants/:id - Dettagli singola palestra
POST   /api/superadmin/tenants/:id/onboarding - Genera link onboarding
GET    /api/superadmin/tenants/:id/onboarding - Stato onboarding
GET    /api/superadmin/analytics - Analytics globali tutte le palestre
POST   /api/superadmin/analytics/backfill-all - Backfill per tutti i tenant

# MONITORING ENDPOINTS
GET  /api/monitoring/health - Health check completo (DB, Evolution, WhatsApp)
GET  /api/monitoring/stats - Statistiche alert (totali, non letti)
GET  /api/monitoring/alerts - Storico alert con paginazione
POST /api/monitoring/alerts/:id/acknowledge - Segna alert come letto
POST /api/monitoring/test-telegram - Invia messaggio test a Telegram

# ONBOARDING ENDPOINTS (pubblici)
GET  /api/onboarding/:token - Info onboarding da token
POST /api/onboarding/:token/step/:step - Salva dati step
GET  /api/onboarding/:token/whatsapp/qrcode - QR code WhatsApp
GET  /api/onboarding/:token/whatsapp/status - Stato connessione WhatsApp
POST /api/onboarding/:token/complete - Completa onboarding
```

## Comandi Utili

### SSH al server
```bash
ssh root@46.225.16.97
# Password: vedi Coolify o .env
```

### Aggiornare il codice in produzione
```bash
# Backend: SCP diretto su /opt/coach-ai (montato nel container) + restart
scp backend/src/index-multitenant.js root@46.225.16.97:/opt/coach-ai/backend/src/index-multitenant.js
ssh root@46.225.16.97 'docker restart backend-z80wkw4o800cs4s408cccwwg'

# Dashboard: SCP file + rebuild dentro il container
scp dashboard/src/components/SuperAdmin.jsx root@46.225.16.97:/opt/coach-ai/dashboard/src/components/SuperAdmin.jsx
ssh root@46.225.16.97 'docker exec dashboard-z80wkw4o800cs4s408cccwwg sh -c "cd /app && npm run build"'

# Solo restart backend (se file già aggiornati sul server)
ssh root@46.225.16.97 'docker restart backend-z80wkw4o800cs4s408cccwwg'
```

### Vedere i log
```bash
docker logs backend-z80wkw4o800cs4s408cccwwg --tail 50
docker logs evolution-api-z80wkw4o800cs4s408cccwwg --tail 50
```

### Vedere log automation
```bash
docker logs backend-z80wkw4o800cs4s408cccwwg --tail 100 | grep -i "automation\|inactivity\|followup\|milestone"
```

### Vedere log monitoring
```bash
docker logs backend-z80wkw4o800cs4s408cccwwg --tail 100 | grep -i "monitoring\|health\|alert"
```

### Test alert Telegram
```bash
curl -X POST https://coachpalestra.it/api/monitoring/test-telegram
```

### Testare invio messaggio WhatsApp
```bash
echo '{"number": "NUMERO", "text": "Messaggio"}' | curl -s -X POST \
  -H "apikey: 065aa73d6bbdeaa4a9a0c7b94a8db194" \
  -H "Content-Type: application/json" \
  "http://localhost:8085/message/sendText/palestra" -d @-
```

### Trigger manuale automazioni
```bash
curl -X POST https://coachpalestra.it/api/automations/run
```

### Trigger manuale Brain AI
```bash
curl -X POST https://coachpalestra.it/api/brain/run
```

### Vedere log Brain AI
```bash
docker logs backend-z80wkw4o800cs4s408cccwwg --tail 100 | grep -i "brain\|scoring\|analyzer\|actions"
```

### Riconfigurare Webhook dopo riavvio Evolution API
```bash
curl -X POST "http://localhost:8085/webhook/set/palestra" \
  -H "apikey: 065aa73d6bbdeaa4a9a0c7b94a8db194" \
  -H "Content-Type: application/json" \
  -d '{"webhook": {"url": "http://backend-z80wkw4o800cs4s408cccwwg:3000/webhook", "enabled": true, "events": ["MESSAGES_UPSERT"]}}'
```

### Verificare stato WhatsApp
```bash
curl -s "http://localhost:8085/instance/connectionState/palestra" \
  -H "apikey: 065aa73d6bbdeaa4a9a0c7b94a8db194"
# Risposta: {"instance":{"instanceName":"palestra","state":"open"}}
```

### Riconnettere WhatsApp (se stato "connecting")
```bash
# Prima logout
curl -X DELETE "http://localhost:8085/instance/logout/palestra" \
  -H "apikey: 065aa73d6bbdeaa4a9a0c7b94a8db194"

# Poi ottieni nuovo QR code
curl -s "http://localhost:8085/instance/connect/palestra" \
  -H "apikey: 065aa73d6bbdeaa4a9a0c7b94a8db194"
```

### Accesso database
```bash
docker exec -it v8k04c8kkwwc480s8g44s0gg psql -U postgres
```

### Query utili database
```sql
-- Vedere sequenze automation
SELECT name, trigger_type, is_enabled FROM automation_sequences;

-- Vedere job eseguiti
SELECT phone, trigger_type, status, executed_at FROM automation_jobs ORDER BY executed_at DESC LIMIT 20;

-- Clienti inattivi da 3+ giorni
SELECT phone, name, last_activity FROM clients WHERE last_activity < NOW() - INTERVAL '3 days';

-- Vedere alert monitoring
SELECT title, severity, created_at, acknowledged FROM monitoring_alerts ORDER BY created_at DESC LIMIT 10;

-- Health check logs
SELECT check_type, status, created_at FROM monitoring_health_logs ORDER BY created_at DESC LIMIT 10;

-- Analytics giornalieri
SELECT date, messages_sent, checkins, new_clients FROM daily_stats WHERE tenant_id = 'UUID' ORDER BY date DESC LIMIT 10;

-- Onboarding tokens
SELECT token, status, current_step, expires_at FROM onboarding_tokens ORDER BY created_at DESC LIMIT 5;

-- Brain: distribuzione azioni (verifica diversificazione)
SELECT action_type, status, count(*) FROM brain_actions WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY action_type, status ORDER BY count DESC;

-- Brain: clienti a rischio churn
SELECT cs.phone, cp.name, cs.churn_risk, cs.engagement_score, cs.days_since_last_checkin, cs.motivation_level
FROM client_scoring cs LEFT JOIN client_profiles cp ON cp.tenant_id = cs.tenant_id AND cp.phone = cs.phone
WHERE cs.tenant_id = 'UUID' AND cs.churn_risk >= 0.6 ORDER BY cs.churn_risk DESC;

-- Brain: segnali conversazione recenti
SELECT phone, signal_type, keywords_matched, confidence, created_at FROM conversation_signals WHERE tenant_id = 'UUID' ORDER BY created_at DESC LIMIT 20;

-- Brain: nomi estratti automaticamente
SELECT phone, name, updated_at FROM client_profiles WHERE tenant_id = 'UUID' AND name IS NOT NULL ORDER BY updated_at DESC;
```

## Tabelle Database

### Automation
```sql
automation_sequences:
  - id UUID
  - tenant_id UUID
  - name VARCHAR(100)
  - trigger_type VARCHAR(50)  -- 'inactivity', 'checkin', 'milestone'
  - trigger_config JSONB      -- {"days": 3} o {"streak": 5}
  - message_template TEXT
  - is_enabled BOOLEAN

automation_jobs:
  - id UUID
  - tenant_id UUID
  - sequence_id UUID
  - phone VARCHAR(20)
  - trigger_type VARCHAR(50)
  - trigger_key VARCHAR(100)  -- 'inactivity:3', 'milestone:streak:5'
  - status VARCHAR(20)        -- 'sent', 'failed'
  - message_sent TEXT
  - error_message TEXT
  - executed_at TIMESTAMP
```

### Monitoring
```sql
monitoring_alerts:
  - id SERIAL
  - title VARCHAR(200)
  - message TEXT
  - severity VARCHAR(20)         -- 'info', 'warning', 'error'
  - acknowledged BOOLEAN
  - acknowledged_at TIMESTAMP
  - acknowledged_by VARCHAR(100)
  - created_at TIMESTAMP

monitoring_health_logs:
  - id SERIAL
  - check_type VARCHAR(50)       -- 'database', 'evolution_api', 'whatsapp', 'full'
  - status VARCHAR(20)           -- 'healthy', 'unhealthy', 'degraded'
  - details JSONB
  - response_time_ms INTEGER
  - created_at TIMESTAMP
```

### Brain AI
```sql
client_scoring:
  - tenant_id UUID
  - phone VARCHAR(20)
  - churn_risk DECIMAL(3,2)       -- 0.0 (safe) → 1.0 (drop-out)
  - engagement_score DECIMAL(3,2)  -- 0.0 (inattivo) → 1.0 (super attivo)
  - consistency_score DECIMAL(3,2) -- 0.0 (irregolare) → 1.0 (costante)
  - motivation_level VARCHAR(10)   -- 'high', 'medium', 'low'
  - preferred_days TEXT[]          -- ['monday', 'wednesday', 'friday']
  - preferred_time VARCHAR(5)      -- '18:00'
  - avg_checkins_per_week DECIMAL
  - days_since_last_checkin INTEGER
  - total_checkins_30d INTEGER
  - checkin_trend VARCHAR(10)      -- 'up', 'stable', 'down'
  - weekly_checkins_history JSONB   -- [3, 2, 4, 3] ultime 4 settimane
  - scoring_data JSONB              -- dati completi per debug
  - last_scored_at TIMESTAMP
  - UNIQUE(tenant_id, phone)

conversation_signals:
  - tenant_id UUID
  - phone VARCHAR(20)
  - signal_type VARCHAR(20)        -- 'frustration', 'pain', 'barrier', 'motivation', 'progress', 'celebration'
  - signal_text TEXT               -- primi 200 char del messaggio
  - keywords_matched TEXT[]        -- keywords che hanno matchato
  - confidence DECIMAL(3,2)        -- 0.50 → 1.00
  - created_at TIMESTAMP

brain_actions:
  - tenant_id UUID
  - phone VARCHAR(20)
  - action_type VARCHAR(50)        -- 'welcome_message', 'comeback_message', 'streak_recovery', etc.
  - reason TEXT                    -- motivazione della decisione
  - trigger_conditions JSONB       -- {churn_risk, engagement, motivation}
  - message_content TEXT           -- messaggio generato via AI
  - status VARCHAR(20)             -- 'pending', 'sent', 'failed', 'skipped'
  - action_key VARCHAR(200) UNIQUE -- anti-duplicato (tipo:phone:data)
  - skip_reason TEXT               -- motivo se skipped/failed
  - sent_at TIMESTAMP
  - created_at TIMESTAMP

brain_settings:
  - tenant_id UUID UNIQUE
  - brain_enabled BOOLEAN
  - max_messages_per_day INTEGER (10)
  - max_messages_per_client_per_week INTEGER (3)
  - min_hours_between_messages INTEGER (24)
  - quiet_hours_start VARCHAR(5) ('22:00')
  - quiet_hours_end VARCHAR(5) ('07:00')
  - churn_threshold_high DECIMAL (0.70)
  - churn_threshold_medium DECIMAL (0.50)
  - inactivity_days_high INTEGER (14)
  - inactivity_days_support_max INTEGER (7)
  - streak_recovery_min_days INTEGER (3)
  - streak_recovery_max_days INTEGER (7)
  - engagement_threshold DECIMAL (0.50)
  - consistency_threshold_progress DECIMAL (0.50)
  - consistency_threshold_streak DECIMAL (0.50)
  - min_checkins_for_progress INTEGER (6)
  - check_progress_interval_days INTEGER (14)
  - delay_between_messages_ms INTEGER (3000)
```

### Onboarding
```sql
onboarding_tokens:
  - id SERIAL
  - tenant_id UUID
  - token VARCHAR(64) UNIQUE
  - status VARCHAR(20)          -- 'pending', 'in_progress', 'completed', 'expired'
  - current_step INTEGER        -- 1-4
  - step_data JSONB             -- dati salvati per ogni step
  - expires_at TIMESTAMP
  - started_at TIMESTAMP
  - completed_at TIMESTAMP
  - created_at TIMESTAMP
```

### Analytics
```sql
daily_stats:
  - id SERIAL
  - tenant_id UUID
  - date DATE
  - messages_sent INTEGER
  - messages_received INTEGER
  - ai_responses INTEGER
  - new_clients INTEGER
  - active_clients INTEGER
  - checkins INTEGER
  - unique_checkins INTEGER
  - automation_messages_sent INTEGER
  - automation_conversions INTEGER
  - UNIQUE(tenant_id, date)

analytics_events:
  - id SERIAL
  - tenant_id UUID
  - client_id INTEGER
  - event_type VARCHAR(50)
  - event_name VARCHAR(100)
  - event_data JSONB
  - created_at TIMESTAMP
```

## Problemi Risolti

1. **npm ci fallisce**: Usare `npm install --omit=dev` nel Dockerfile
2. **Evolution API non invia messaggi**: Assicurarsi che state sia "open", non "connecting"
3. **QR code non appare**: Usare evoapicloud/evolution-api:latest (v2.3.7+)
4. **Backend non trova Evolution API**: Usare il nome completo del container (evolution-api-z80wkw4o800cs4s408cccwwg)
5. **Tenant usa istanza sbagliata**: Aggiornare colonna `whatsapp_instance_name` nella tabella `tenants`
6. **Route /api/automations/stats 404**: Mettere route specifiche PRIMA di route con `:id`
7. **Notifica Telegram non inviata**: Usare `monitoring.sendAlert()` invece di `sendTelegramAlert()`
8. **Analytics 401**: Gli endpoint superadmin devono essere pubblici (senza requireTenant)
9. **Redis disconnected errors in Evolution API**: Aggiungere `CACHE_REDIS_ENABLED: 'false'` nel docker-compose
10. **OpenRouter crediti esauriti**: Passare a Groq (gratuito) con llama-3.3-70b-versatile
11. **Modello AI non letto dal docker-compose**: Il codice usa `OPENAI_MODEL` (non AI_MODEL)
12. **Webhook si perde dopo riavvio**: Riconfigurare manualmente dopo ogni restart di Evolution API
13. **Link scheda non funziona**: La dashboard (npx serve) non proxa /scheda/* al backend. Soluzione: esporre backend su porta 3001 e usare APP_BASE_URL='http://46.225.16.97:3001'
14. **SuperAdmin password hardcoded**: Rimossa password `CoachAI2024!` da frontend, sostituita con JWT + `is_superadmin` flag nel DB
15. **Route superadmin/monitoring senza auth**: Aggiunti middleware `requireAuth + requireSuperadmin` a tutte le 18 route
16. **legacyTenant fallback insicuro**: Rimosso fallback a DEFAULT_TENANT_ID quando manca JWT (ora restituisce 401)
17. **Webhook fallback hardcoded**: Rimosso fallback a `centro-fitness-amati`, ora `req.tenant = null` se tenant non identificato
18. **CORS "Failed to fetch" su coachpalestra.it**: `VITE_API_URL=http://IP:3001` causava cross-origin. Fix: `VITE_API_URL=''` (URL relativi via Traefik)
19. **429 Too Many Requests nel SuperAdmin**: Rate limiter troppo basso (100/15min). Fix: 300 per API, 1000 per superadmin
20. **Stato WhatsApp stale nel SuperAdmin**: `GET /api/superadmin/tenants` ora chiama Evolution API in real-time per ogni tenant
21. **Parsing Evolution API errato**: `response.data.state` era undefined — il formato è `{instance: {state: "open"}}`. Fix: `data.instance.state || data.state` in 4 punti
22. **Istanze WhatsApp duplicate tra tenant**: Aggiunto UNIQUE partial index + validazione backend su POST/PUT
23. **Collisioni Referral Code**: Implementato retry automatico (max 5) e garanzia univocità anche con prefissi simili
24. **Crash Dashboard su 401**: Migliorata la resilienza di `Referral.jsx` e altri componenti agli errori di autenticazione
25. **Priorità keywords Referral**: Corretto bug dove "codice amico" impediva il rilevamento del codice reale se presenti entrambi
26. **Routing Link Schede**: I link `/scheda/*` venivano intercettati dalla dashboard (404). Fix: aggiunta regola Traefik per indirizzarli al backend.
27. **Sistema Loyalty (Fidelity)**: Implementata logica di premiazione automatica ogni 10 check-in e messaggi di benvenuto calorosi con statistiche totali.
28. **Brain AI 95% comeback_message**: Le regole usavano early-exit, la Regola 1 (comeback) catturava il 95% dei clienti. Fix: riscritto `decideAction` con logica score-based priority — valuta TUTTE le regole, assegna priorità, esegue la migliore.
29. **Brain AI 37% failure rate**: Messaggi Brain inviati con axios diretto senza retry. Fix: integrato BullMQ (`enqueueWhatsAppMessage`) con 3 retry automatici + timeout 15s.
30. **Brain AI nomi clienti mancanti**: `client_profiles.name` restava NULL. Fix: aggiunta estrazione automatica nomi in `analyzer.js` via regex su frasi italiane ("mi chiamo X", "sono X").
31. **Brain AI soglie troppo aggressive**: `inactivity_days_high=5` triggava comeback troppo presto. Fix: alzato a 14gg, `consistency_threshold_streak` 0.70→0.50, `min_checkins_for_progress` 8→6.
32. **Onboarding 500 error (`db.query is not a function`)**: 3 punti in `index-multitenant.js` usavano `db.query()` invece di `db.pool.query()`. Fix: corretto tutti e 3.
33. **Coolify UI bloccata (ERR_CONNECTION_TIMED_OUT)**: nftables DOCKER-USER chain bloccava il traffico DNAT (8000→8080). Fix: aggiunto `nft insert rule ip filter DOCKER-USER ip daddr 10.0.1.5 tcp dport 8080 accept`.
34. **OpenClaw Telegram spam**: Daemon OpenClaw inviava errori su Telegram. Fix: `systemctl stop openclaw && systemctl disable openclaw`. Healthcheck shell continua a funzionare.

## Tenant Configurati

```sql
SELECT id, name, slug, whatsapp_instance_name FROM tenants;
-- a0000000-0000-0000-0000-000000000001 | Centro Fitness Amati | centro-fitness-amati | palestra
-- (uuid)                                | fitness anna         | fitness-anna         | fitness-anna
-- (uuid)                                | amati                | amati                | NULL
-- (uuid)                                | roma                 | roma                 | coci
-- (uuid)                                | okokokbrtyhbytbhtyh  | okokok               | mkmk
-- (uuid)                                | asasasefearf         | asasas               | NULL
```

### Utenti Configurati
```
admin@centrofitnessamati.it / Coach2024 → is_superadmin=true (user ID: b0000000-0000-0000-0000-000000000001)
goldiamond.2010@gmail.com / Coach2024   → tenant: fitness-anna (5888261e-7f4b-41e8-9cd9-6a91216ef357)
```

## Sequenze Automation Default

Ogni tenant ha 7 sequenze pre-configurate:
1. `inactivity_3_days` - Reminder dopo 3 giorni
2. `inactivity_7_days` - Reminder dopo 7 giorni
3. `inactivity_14_days` - Reminder dopo 14 giorni
4. `post_checkin` - Followup 60 min dopo check-in
5. `streak_5` - Celebrazione 5 giorni consecutivi
6. `streak_10` - Celebrazione 10 giorni consecutivi
7. `streak_20` - Celebrazione 20 giorni consecutivi

## Modello di Business
- **Pagamento esterno**: il proprietario va dal cliente, firma contratto, pagamento via bonifico
- **Gestione abbonamenti**: tramite SuperAdmin (/superadmin)
- **Piani disponibili**: Trial, Basic, Pro, Enterprise
- **Nessuna integrazione Stripe necessaria** (pagamento manuale)

## Prossimi Sviluppi Possibili
- [ ] Notifiche push
- [x] ~~Integrazione pagamenti~~ Gestione manuale implementata!
- [ ] App mobile
- [ ] Multi-lingua
- [x] ~~Analytics avanzati~~ COMPLETATO! (Grafici Recharts + SuperAdmin)
- [x] ~~Automazioni marketing~~ COMPLETATO!
- [x] ~~Gestione abbonamenti~~ COMPLETATO!
- [x] ~~Sistema Monitoring 24/7~~ COMPLETATO! (Alert Telegram)
- [x] ~~Onboarding guidato~~ COMPLETATO! (Wizard 4 step + notifica Telegram)
- [x] ~~Sicurezza Multi-Tenant~~ COMPLETATO! (JWT superadmin, rate limiting, UNIQUE constraint, auth su tutte le route)
- [x] ~~Stato WhatsApp Real-Time~~ COMPLETATO! (Evolution API check nel SuperAdmin)
- [x] ~~Brain AI~~ COMPLETATO! (Scoring + Conversation Analyzer + Smart Actions + BullMQ)
- [x] ~~Message Queue (BullMQ)~~ COMPLETATO! (Retry automatici, rate limiting, anti-ban)
- [x] ~~Churn Alert Dashboard~~ COMPLETATO! (Warning UI per clienti a rischio)
- [ ] Agenti AI per marketing/analisi (OpenClaw/CrewAI)
- [ ] Upsell sequences avanzate
- [ ] A/B testing messaggi
- [ ] Ottimizzazione scalabilità (cache stato WhatsApp per 100+ tenant)

## Campi Database Abbonamento (tenants)

```sql
subscription_plan VARCHAR(50)      -- 'trial', 'basic', 'pro', 'enterprise'
subscription_status VARCHAR(50)    -- 'active', 'suspended', 'cancelled'
subscription_ends_at TIMESTAMP     -- data scadenza
subscription_price DECIMAL(10,2)   -- prezzo mensile in EUR
subscription_notes TEXT            -- note su contratto/pagamento
```

## Campi Database Onboarding (tenants)

```sql
onboarding_completed BOOLEAN       -- true se wizard completato
coach_name VARCHAR(100)            -- nome del coach virtuale
coach_tone VARCHAR(50)             -- 'formal', 'friendly', 'motivational'
welcome_message TEXT               -- messaggio benvenuto personalizzato
gym_address TEXT                   -- indirizzo palestra
gym_phone VARCHAR(50)              -- telefono palestra
gym_hours TEXT                     -- orari apertura
logo_url TEXT                      -- URL logo palestra
```

## Memoria Cliente (Long-term Memory)

Il coach AI ricorda le conversazioni passate grazie alla tabella `client_profiles`:

```sql
client_profiles:
  - id SERIAL
  - tenant_id UUID
  - phone VARCHAR(20)
  - fitness_goals TEXT           -- obiettivi fitness estratti dalle conversazioni
  - fitness_level VARCHAR(50)    -- livello (principiante, intermedio, avanzato)
  - injuries TEXT                -- infortuni/limitazioni
  - preferences JSONB            -- preferenze allenamento
  - conversation_summary TEXT    -- riassunto ultime conversazioni
  - key_facts TEXT[]             -- fatti chiave da ricordare
  - last_topics TEXT[]           -- ultimi argomenti discussi
  - total_messages INTEGER       -- contatore messaggi
  - total_checkins INTEGER       -- contatore check-in
  - total_workouts INTEGER       -- contatore allenamenti generati
  - updated_at TIMESTAMP
  - UNIQUE(tenant_id, phone)
```

Il sistema aggiorna la memoria ogni 10 messaggi usando AI per estrarre informazioni rilevanti.

## File Docker-Compose Produzione

Percorso: `/data/coolify/services/z80wkw4o800cs4s408cccwwg/docker-compose.yml`

Variabili chiave Evolution API:
```yaml
CACHE_REDIS_ENABLED: 'false'    # IMPORTANTE: disabilita Redis
AUTHENTICATION_API_KEY: 065aa73d6bbdeaa4a9a0c7b94a8db194
```

Variabili chiave Backend:
```yaml
OPENAI_BASE_URL: 'https://api.groq.com/openai/v1'
OPENAI_API_KEY: gsk_...
OPENAI_MODEL: llama-3.3-70b-versatile
APP_BASE_URL: 'https://coachpalestra.it'   # Per link schede allenamento
```
Porte esposte:
- **3001:3000** - Backend API (usato per link /scheda/*)

## Firewall Server (nftables)

Il server usa **nftables** con chain DOCKER-USER. Attenzione:
- Coolify UI (porta 8000) usa DNAT interno: 8000 → container su 10.0.1.5:8080
- Se una porta esterna è aperta in Hetzner ma non risponde, controllare nftables:
```bash
nft list chain ip filter DOCKER-USER
```
- Regola critica per Coolify: `nft insert rule ip filter DOCKER-USER ip daddr 10.0.1.5 tcp dport 8080 accept`
- Salvare: `nft list ruleset > /etc/nftables.conf`

## OpenClaw (disabilitato)

- Daemon systemd **disabilitato**: `systemctl disable openclaw`
- Script healthcheck shell **ancora attivo**: `0 */2 * * * /opt/openclaw/healthcheck-telegram.sh`
- Telegram bot: `@daniel0805bot` (token: `ROTATED_OR_REMOVED`)
- Chat ID: `1483894435`

## SSH Access

- **Chiave autorizzata**: `ssh-ed25519 ...finalcut@Mac-mini-di-Daniel.local` → già in `/root/.ssh/authorized_keys`
- **Accesso garantito** da questo Mac senza password

---
*Ultimo aggiornamento: 3 Marzo 2026 (Brain AI v2 + BullMQ + Churn Alert)*
