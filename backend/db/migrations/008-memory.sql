-- Migration: Client Memory System
-- Aggiunge memoria a lungo termine per ogni cliente

-- Tabella profilo cliente (estratto dalle conversazioni)
CREATE TABLE IF NOT EXISTS client_profiles (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,

    -- Info base estratte
    name VARCHAR(100),
    age VARCHAR(20),
    gender VARCHAR(20),

    -- Fitness info
    fitness_goals TEXT,           -- "perdere peso", "aumentare massa", ecc.
    fitness_level VARCHAR(50),    -- "principiante", "intermedio", "avanzato"
    training_frequency VARCHAR(100), -- "3 volte a settimana"
    preferred_activities TEXT,    -- "pesi", "cardio", "nuoto"

    -- Salute
    injuries TEXT,                -- infortuni o limitazioni
    health_notes TEXT,            -- note sulla salute

    -- Preferenze
    preferred_time VARCHAR(100),  -- orari preferiti
    communication_style VARCHAR(50), -- "formale", "informale", "motivazionale"

    -- Riassunto conversazioni
    conversation_summary TEXT,    -- riassunto AI delle conversazioni
    key_facts TEXT,               -- fatti importanti da ricordare
    last_topics TEXT,             -- ultimi argomenti discussi

    -- Metriche
    total_messages INTEGER DEFAULT 0,
    total_checkins INTEGER DEFAULT 0,
    member_since DATE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    summary_updated_at TIMESTAMP,

    UNIQUE(tenant_id, phone)
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_client_profiles_tenant ON client_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_phone ON client_profiles(tenant_id, phone);

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_client_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS client_profiles_updated_at ON client_profiles;
CREATE TRIGGER client_profiles_updated_at
    BEFORE UPDATE ON client_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_client_profile_timestamp();
