-- Migration 010: Brain Settings - Configurazione per-tenant del Brain AI
-- Permette a ogni palestra di personalizzare frequenza messaggi, soglie e orari

CREATE TABLE IF NOT EXISTS brain_settings (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- ===== ON/OFF =====
    brain_enabled BOOLEAN DEFAULT TRUE,

    -- ===== LIMITI FREQUENZA MESSAGGI =====
    max_messages_per_day INTEGER DEFAULT 10,             -- tetto giornaliero per tenant
    max_messages_per_client_per_week INTEGER DEFAULT 3,  -- max messaggi per singolo cliente/settimana
    min_hours_between_messages INTEGER DEFAULT 24,       -- distanza minima tra 2 msg allo stesso cliente

    -- ===== ORARI SILENZIOSI =====
    quiet_hours_start VARCHAR(5) DEFAULT '22:00',        -- niente messaggi dalle 22:00
    quiet_hours_end VARCHAR(5) DEFAULT '07:00',          -- fino alle 07:00

    -- ===== SOGLIE CHURN RISK =====
    churn_threshold_high DECIMAL(3,2) DEFAULT 0.70,      -- soglia alta (comeback_message)
    churn_threshold_medium DECIMAL(3,2) DEFAULT 0.50,    -- soglia media (motivation)

    -- ===== SOGLIE INATTIVITA' =====
    inactivity_days_high INTEGER DEFAULT 5,              -- giorni inattività per comeback (regola 1)
    inactivity_days_support_max INTEGER DEFAULT 7,       -- max giorni per support (regola 3)
    streak_recovery_min_days INTEGER DEFAULT 2,          -- min giorni per streak recovery (regola 5)
    streak_recovery_max_days INTEGER DEFAULT 5,          -- max giorni per streak recovery (regola 5)

    -- ===== SOGLIE ENGAGEMENT/CONSISTENCY =====
    engagement_threshold DECIMAL(3,2) DEFAULT 0.60,      -- soglia engagement per check_progress (regola 4)
    consistency_threshold_progress DECIMAL(3,2) DEFAULT 0.50,  -- consistenza per check_progress
    consistency_threshold_streak DECIMAL(3,2) DEFAULT 0.70,    -- consistenza per streak recovery
    min_checkins_for_progress INTEGER DEFAULT 8,         -- min checkins/30d per check_progress

    -- ===== FREQUENZA CHECK PROGRESS =====
    check_progress_interval_days INTEGER DEFAULT 14,     -- intervallo minimo tra check_progress

    -- ===== RATE LIMITING =====
    delay_between_messages_ms INTEGER DEFAULT 3000,      -- delay tra invio messaggi (ms)

    -- ===== METADATA =====
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id)
);

-- Indice per lookup veloce
CREATE INDEX IF NOT EXISTS idx_brain_settings_tenant ON brain_settings(tenant_id);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_brain_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brain_settings_updated_at ON brain_settings;
CREATE TRIGGER brain_settings_updated_at
    BEFORE UPDATE ON brain_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_brain_settings_timestamp();

-- Inserisci settings di default per tutti i tenant esistenti
INSERT INTO brain_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
