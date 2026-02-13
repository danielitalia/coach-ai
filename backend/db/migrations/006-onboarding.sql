-- =====================================================
-- MIGRATION 006: Onboarding System
-- =====================================================
-- Sistema di onboarding guidato per nuove palestre
-- =====================================================

-- Token di onboarding per nuove palestre
CREATE TABLE IF NOT EXISTS onboarding_tokens (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'expired'
    current_step INTEGER DEFAULT 1, -- 1-4
    step_data JSONB DEFAULT '{}', -- Dati salvati per ogni step
    expires_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_onboarding_token ON onboarding_tokens(token);
CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON onboarding_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_tokens(status);

-- Aggiungi campi onboarding alla tabella tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS coach_name VARCHAR(100) DEFAULT 'Coach';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS coach_tone VARCHAR(50) DEFAULT 'friendly'; -- 'formal', 'friendly', 'motivational'
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gym_address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gym_phone VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gym_hours TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Commenti
COMMENT ON TABLE onboarding_tokens IS 'Token per wizard di onboarding nuove palestre';
COMMENT ON COLUMN onboarding_tokens.step_data IS 'JSON con dati salvati ad ogni step del wizard';
COMMENT ON COLUMN tenants.coach_name IS 'Nome del coach virtuale (es. Marco, Coach Fit)';
COMMENT ON COLUMN tenants.coach_tone IS 'Tono di voce: formal, friendly, motivational';
