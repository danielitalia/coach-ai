# Coach AI - Contesto per Claude

## Panoramica del Progetto
Coach AI è un **personal trainer virtuale WhatsApp** per palestre. I clienti possono chattare via WhatsApp con un AI che risponde come un coach, genera schede di allenamento personalizzate, gestisce check-in, referral e premi.

## Architettura

### Stack Tecnologico
- **Backend**: Node.js + Express (index-multitenant.js)
- **Database**: PostgreSQL (multi-tenant)
- **WhatsApp**: Evolution API v2.3.7 (evoapicloud/evolution-api:latest)
- **AI**: Groq API (llama-3.3-70b-versatile) - configurabile anche per OpenAI/Anthropic
- **Dashboard**: React + Vite + TailwindCSS + Recharts
- **Hosting**: Coolify su server Hetzner (46.225.16.97)
- **Dominio**: https://coachpalestra.it/
- **Marketing Automation**: node-cron scheduler per messaggi automatici
- **Monitoring**: Sistema di monitoraggio 24/7 con alert Telegram
- **Analytics**: Sistema di metriche e grafici con dati storici

### Container Docker in Produzione
```
- backend-z80wkw4o800cs4s408cccwwg (Node.js backend)
- dashboard-z80wkw4o800cs4s408cccwwg (Nginx + React)
- evolution-api-z80wkw4o800cs4s408cccwwg (WhatsApp gateway)
- evolution-db-z80wkw4o800cs4s408cccwwg (PostgreSQL per Evolution)
- v8k04c8kkwwc480s8g44s0gg (PostgreSQL principale)
```

### Credenziali Server
- **IP**: 46.225.16.97
- **SSH**: root@46.225.16.97
- **Password**: [vedi .env o Coolify]

### Credenziali Evolution API
- **URL**: http://localhost:8085 (interno) / http://46.225.16.97:8085 (esterno)
- **API Key**: [vedi .env]
- **Istanza WhatsApp**: palestra
- **Manager**: http://46.225.16.97:8085/manager

### Database Principale
- **Host**: v8k04c8kkwwc480s8g44s0gg (container)
- **User**: postgres
- **Password**: [vedi Coolify]
- **Database**: postgres

### AI Provider (Groq)
- **Base URL**: https://api.groq.com/openai/v1
- **API Key**: [vedi .env - GROQ_API_KEY]
- **Model**: llama-3.3-70b-versatile

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
- `/backend/src/middleware/auth.js` - Middleware tenant
- `/backend/src/monitoring/index.js` - Sistema monitoring 24/7 con alert Telegram
- `/backend/Dockerfile.prod` - Docker per produzione

### Dashboard
- `/dashboard/src/App.jsx` - Router principale
- `/dashboard/src/components/Analytics.jsx` - Dashboard analytics con grafici Recharts
- `/dashboard/src/components/Automations.jsx` - Gestione marketing automation
- `/dashboard/src/components/SuperAdmin.jsx` - Gestione palestre, monitoring e analytics globali
- `/dashboard/src/components/OnboardingWizard.jsx` - Wizard 4 step per nuove palestre
- `/dashboard/src/components/WorkoutPlans.jsx` - Gestione schede
- `/dashboard/src/components/ClientList.jsx` - Lista clienti
- `/dashboard/nginx.conf` - Configurazione Nginx

### Docker/Deploy
- `/docker-compose.prod.yml` - Compose per Coolify
- Il deploy avviene via GitHub → Coolify (auto-deploy su push)

## Funzionalità Implementate

### WhatsApp Bot
- Risponde ai messaggi dei clienti come un coach
- Genera schede di allenamento personalizzate via AI
- Invia PDF delle schede
- Gestisce check-in in palestra
- Sistema referral con codici
- Sistema premi/rewards

### Marketing Automation
- **Reminder Inattività**: messaggi automatici dopo 3, 7, 14 giorni senza check-in
- **Follow-up Post-Checkin**: messaggio motivazionale 1h dopo check-in
- **Milestone Streak**: celebrazione per 5, 10, 20 giorni consecutivi
- **Prevenzione Duplicati**: non reinvia se già inviato
- **Multi-tenant**: funziona per tutti i tenant
- **Scheduler**: esegue automaticamente ogni ora alle :05
- **Dashboard**: pagina dedicata per gestire/modificare le sequenze

### Dashboard Web
- Login multi-tenant (ogni palestra ha il suo account)
- Visualizzazione clienti e conversazioni
- **Gestione Schede**: modifica visuale delle schede di allenamento
- **Automazioni**: gestione sequenze marketing, storico invii, statistiche
- **Analytics**: grafici messaggi, check-in, clienti, automazioni
- Invio messaggi manuali ai clienti
- QR code per check-in
- Connessione WhatsApp con QR code

### SuperAdmin (/superadmin)
- **Password**: CoachAI2024!
- Gestione multi-tenant (crea/modifica/elimina palestre)
- **Gestione Abbonamenti**: piano, stato, scadenza, prezzo, note
- **Tab Monitoring**: stato servizi, alert history, test Telegram
- **Tab Analytics**: vista globale metriche tutte le palestre
- **Onboarding Links**: genera link per auto-configurazione nuove palestre
- Impersonation (accedi come una palestra)
- Statistiche globali (tenant totali, clienti, messaggi)
- Badge stato abbonamento (attivo, in scadenza, sospeso)
- Azioni rapide (+1 mese, +1 anno, attiva pro, sospendi)

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

# ANALYTICS ENDPOINTS
GET  /api/analytics/summary - Riepilogo metriche per periodo
GET  /api/analytics/timeline - Dati per grafici temporali
GET  /api/analytics/daily - Stats giornaliere dettagliate
GET  /api/analytics/events - Eventi analytics
POST /api/analytics/backfill - Ricalcola statistiche storiche

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
# Metodo 1: Copiare file singoli
scp backend/src/index-multitenant.js root@46.225.16.97:/tmp/
ssh root@46.225.16.97 'docker cp /tmp/index-multitenant.js backend-z80wkw4o800cs4s408cccwwg:/app/src/'
ssh root@46.225.16.97 'docker restart backend-z80wkw4o800cs4s408cccwwg'

# Metodo 2: Rebuild dashboard
ssh root@46.225.16.97 'docker exec dashboard-z80wkw4o800cs4s408cccwwg sh -c "cd /app && npm run build"'
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
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  "http://localhost:8085/message/sendText/palestra" -d @-
```

### Trigger manuale automazioni
```bash
curl -X POST https://coachpalestra.it/api/automations/run
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

## Tenant Configurati

```sql
SELECT id, name, whatsapp_instance_name FROM tenants;
-- Centro Fitness Amati -> palestra
-- amati -> palestra
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
- [ ] Agenti AI per marketing/analisi (OpenClaw/CrewAI)
- [ ] Upsell sequences avanzate
- [ ] A/B testing messaggi

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

---
*Ultimo aggiornamento: 15 Febbraio 2026*
