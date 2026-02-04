# Coach AI - Guida Deploy su Coolify

## Prerequisiti

1. **Server VPS** con almeno:
   - 2 CPU
   - 4GB RAM
   - 40GB SSD
   - Ubuntu 22.04 o Debian 12

   Consigliati: Hetzner CX31 (~15€/mese) o Contabo VPS S

2. **Dominio** configurato (es. coachai.it)

3. **Account OpenAI** con API key

## Setup Iniziale (una volta)

### 1. Installa Coolify sul server

```bash
ssh root@tuo-server-ip
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Dopo l'installazione, accedi a `http://tuo-server-ip:8000`

### 2. Configura Coolify

1. Crea un account admin
2. Aggiungi il server come "Localhost"
3. Configura il dominio wildcard DNS:
   - `*.coachai.it` → IP del server
   - `coachai.it` → IP del server

### 3. Carica il progetto su GitHub/GitLab

```bash
cd coach-ai
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tuousername/coach-ai.git
git push -u origin main
```

## Deploy Nuova Palestra

### 1. In Coolify, crea nuovo progetto

- Click "New Project"
- Nome: `palestra-nome`

### 2. Aggiungi Docker Compose

- Click "New Resource" → "Docker Compose"
- Seleziona repository GitHub
- File: `docker-compose.prod.yml`

### 3. Configura variabili ambiente

Nel pannello Environment Variables, aggiungi:

```
SERVER_URL=https://palestra-nome.coachai.it
POSTGRES_PASSWORD=genera-password-sicura
EVOLUTION_API_KEY=genera-uuid-casuale
OPENAI_API_KEY=sk-tua-chiave-openai
GYM_NAME=Nome Palestra Cliente
COACH_NAME=Coach Marco
OPENAI_MODEL=gpt-4o-mini
```

### 4. Configura dominio

- Vai su "Domains"
- Aggiungi: `palestra-nome.coachai.it`
- Abilita SSL (Let's Encrypt automatico)

### 5. Deploy

- Click "Deploy"
- Attendi che tutti i container siano verdi

### 6. Configura WhatsApp

1. Accedi a `https://palestra-nome.coachai.it`
2. Vai su Impostazioni
3. Scansiona QR code con WhatsApp Business della palestra

## Costi Stimati

| Voce | Costo Mensile |
|------|---------------|
| VPS Hetzner CX31 | ~15€ |
| Dominio .it | ~1€ (annuale/12) |
| OpenAI API (per palestra) | ~5-20€ |
| **Totale infrastruttura** | **~20€/mese** |

Con 10 palestre a 80€/mese = 800€ entrate - 70€ costi = **730€ profitto**

## Manutenzione

### Aggiornamenti

1. Push nuova versione su GitHub
2. In Coolify, click "Redeploy" su ogni istanza
   - Oppure usa webhook per deploy automatico

### Backup

Coolify gestisce backup automatici. Configura:
- Backup giornaliero database
- Retention 7 giorni
- Storage S3 (opzionale)

### Monitoring

- Coolify mostra logs e metriche
- Configura alert email per container down

## Troubleshooting

### Container non parte
```bash
# Vedi logs
docker logs nome-container

# Verifica risorse
docker stats
```

### WhatsApp non si connette
1. Verifica che Evolution API sia running
2. Rigenera QR code da dashboard
3. Controlla che il numero non sia già connesso altrove

### AI non risponde
1. Verifica OPENAI_API_KEY valida
2. Controlla credito OpenAI
3. Vedi logs backend per errori

## Struttura Prezzi Suggerita

| Piano | Prezzo | Include |
|-------|--------|---------|
| Starter | 49€/mese | 500 messaggi AI |
| Business | 99€/mese | 2000 messaggi AI |
| Pro | 199€/mese | Messaggi illimitati |

Setup una tantum: 299€ (include configurazione e training)
