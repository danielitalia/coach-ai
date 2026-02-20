-- Migration 009: Brain AI - Sistema Intelligente per Palestra
-- Aggiunge scoring clienti e azioni intelligenti automatiche

-- =============================================
-- Tabella: client_scoring
-- Score e pattern comportamentali per ogni cliente
-- =============================================
CREATE TABLE IF NOT EXISTS client_scoring (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,

    -- Risk & Engagement Scores (0.0 - 1.0)
    churn_risk DECIMAL(3,2) DEFAULT 0.50,
    engagement_score DECIMAL(3,2) DEFAULT 0.50,
    consistency_score DECIMAL(3,2) DEFAULT 0.50,

    -- Motivation (da analisi conversazioni)
    motivation_level VARCHAR(20) DEFAULT 'medium', -- high, medium, low

    -- Pattern comportamentali
    preferred_days TEXT[],            -- es. ARRAY['monday','wednesday','friday']
    preferred_time VARCHAR(10),       -- es. '18:00'
    avg_checkins_per_week DECIMAL(3,1) DEFAULT 0.0,
    days_since_last_checkin INTEGER DEFAULT 0,
    total_checkins_30d INTEGER DEFAULT 0,

    -- Trend
    checkin_trend VARCHAR(20) DEFAULT 'stable', -- up, stable, down
    weekly_checkins_history JSONB,     -- ultimi 4 settimane: [3,3,2,1]

    -- Dati grezzi del calcolo
    scoring_data JSONB,

    -- Timestamps
    last_scored_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, phone)
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_client_scoring_tenant ON client_scoring(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_scoring_churn ON client_scoring(tenant_id, churn_risk DESC);
CREATE INDEX IF NOT EXISTS idx_client_scoring_engagement ON client_scoring(tenant_id, engagement_score DESC);

-- =============================================
-- Tabella: brain_actions
-- Azioni intelligenti generate e inviate dal Brain
-- =============================================
CREATE TABLE IF NOT EXISTS brain_actions (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(50),

    -- Tipo azione
    action_type VARCHAR(50) NOT NULL,
    -- Valori possibili:
    -- 'comeback_message'        → cliente ad alto rischio churn
    -- 'personalized_motivation' → motivazionale personalizzato
    -- 'check_progress'          → chiedi feedback sulla scheda
    -- 'gentle_reminder'         → reminder nel giorno/ora preferito
    -- 'streak_recovery'         → recupera streak interrotta
    -- 'celebration'             → celebra un traguardo
    -- 'scheda_adjust'           → suggerisci modifica scheda

    -- Contesto decisione
    reason TEXT,                   -- es. "churn_risk=0.82, inattivo 8gg, motivation=low"
    trigger_conditions JSONB,      -- condizioni che hanno scatenato l'azione

    -- Messaggio
    message_content TEXT,          -- messaggio generato dall'AI

    -- Stato
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, skipped, failed
    skip_reason TEXT,              -- se skipped, perché

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,

    -- Anti-duplicato
    action_key VARCHAR(200)        -- es. "comeback:+39xxx:2026-02-20"
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_brain_actions_tenant ON brain_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brain_actions_status ON brain_actions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_brain_actions_phone ON brain_actions(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_brain_actions_key ON brain_actions(action_key);
CREATE INDEX IF NOT EXISTS idx_brain_actions_created ON brain_actions(created_at DESC);

-- =============================================
-- Tabella: conversation_signals
-- Segnali estratti dalle conversazioni in tempo reale
-- =============================================
CREATE TABLE IF NOT EXISTS conversation_signals (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,

    signal_type VARCHAR(50) NOT NULL,
    -- Valori: 'frustration', 'motivation', 'barrier', 'progress', 'pain', 'celebration'

    signal_text TEXT,              -- il testo che ha generato il segnale
    keywords_matched TEXT[],       -- keywords trovate
    confidence DECIMAL(3,2),       -- 0.0-1.0

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_signals_tenant ON conversation_signals(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_conversation_signals_type ON conversation_signals(tenant_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_conversation_signals_created ON conversation_signals(created_at DESC);

-- Trigger per updated_at su client_scoring
CREATE OR REPLACE FUNCTION update_client_scoring_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_scoring_updated_at ON client_scoring;
CREATE TRIGGER client_scoring_updated_at
    BEFORE UPDATE ON client_scoring
    FOR EACH ROW
    EXECUTE FUNCTION update_client_scoring_timestamp();
