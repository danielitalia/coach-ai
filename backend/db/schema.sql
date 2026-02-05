-- Schema per Coach AI

-- Tabella clienti
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    objective VARCHAR(50),
    experience VARCHAR(50),
    days_per_week INTEGER,
    limitations TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella messaggi/conversazioni
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL REFERENCES clients(phone) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' o 'assistant'
    content TEXT NOT NULL,
    is_reminder BOOLEAN DEFAULT FALSE,
    is_workout_plan BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella schede allenamento
CREATE TABLE IF NOT EXISTS workout_plans (
    id VARCHAR(50) PRIMARY KEY,
    phone VARCHAR(20) NOT NULL REFERENCES clients(phone) ON DELETE CASCADE,
    client_name VARCHAR(100),
    objective VARCHAR(50),
    experience VARCHAR(50),
    days_per_week INTEGER,
    limitations TEXT,
    workouts JSONB NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella promemoria inviati (per evitare duplicati)
CREATE TABLE IF NOT EXISTS sent_reminders (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL REFERENCES clients(phone) ON DELETE CASCADE,
    reminder_days INTEGER NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone, reminder_days)
);

-- Tabella configurazione (singleton per settings)
CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella check-in palestra
CREATE TABLE IF NOT EXISTS checkins (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL REFERENCES clients(phone) ON DELETE CASCADE,
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    workout_day VARCHAR(100), -- es. "Giorno 1 - Petto/Tricipiti"
    notes TEXT
);

-- Tabella referral program
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_phone VARCHAR(20) NOT NULL REFERENCES clients(phone) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referred_phone VARCHAR(20) REFERENCES clients(phone) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, registered, completed
    reward_type VARCHAR(50) DEFAULT 'free_week', -- free_week, discount, points
    reward_claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    converted_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Tabella rewards/premi guadagnati
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL REFERENCES clients(phone) ON DELETE CASCADE,
    reward_type VARCHAR(50) NOT NULL, -- free_week, discount_10, points
    description TEXT,
    referral_id INTEGER REFERENCES referrals(id),
    claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_plans_phone ON workout_plans(phone);
CREATE INDEX IF NOT EXISTS idx_clients_last_activity ON clients(last_activity);
CREATE INDEX IF NOT EXISTS idx_checkins_phone ON checkins(phone);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_phone);
CREATE INDEX IF NOT EXISTS idx_rewards_phone ON rewards(phone);

-- Inserisci configurazione default promemoria
INSERT INTO config (key, value) VALUES (
    'reminders',
    '{
        "enabled": true,
        "checkIntervalMinutes": 60,
        "thresholds": [
            {"days": 3, "message": "Ciao! Non ti vediamo da qualche giorno. Tutto bene? Ricorda che la costanza e la chiave del successo!"},
            {"days": 7, "message": "Ehi! E passata una settimana dal tuo ultimo allenamento. Ti aspettiamo in palestra! Hai bisogno di una nuova scheda?"},
            {"days": 14, "message": "Ciao! Sono passate due settimane... Mi manchi! Se hai avuto impegni, capisco perfettamente. Quando vuoi tornare, sono qui per aiutarti a riprendere gradualmente."}
        ]
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;
