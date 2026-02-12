-- Migration 003: Marketing Automation Tables
-- Created: 2026-02-12

-- Sequenze automazione configurabili per tenant
CREATE TABLE IF NOT EXISTS automation_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,  -- 'inactivity', 'checkin', 'milestone'
    trigger_config JSONB NOT NULL,       -- {"days": 3} o {"streak": 5}
    message_template TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- Log dei job eseguiti (previene duplicati)
CREATE TABLE IF NOT EXISTS automation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sequence_id UUID REFERENCES automation_sequences(id) ON DELETE SET NULL,
    phone VARCHAR(20) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_key VARCHAR(100) NOT NULL,  -- 'inactivity:3', 'milestone:streak:5'
    status VARCHAR(20) DEFAULT 'sent',  -- 'sent', 'failed', 'skipped'
    message_sent TEXT,
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_automation_jobs_lookup
    ON automation_jobs(tenant_id, phone, trigger_key);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_executed
    ON automation_jobs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_sequences_tenant
    ON automation_sequences(tenant_id, trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_sequences_enabled
    ON automation_sequences(tenant_id, is_enabled) WHERE is_enabled = TRUE;

-- Inserisci sequenze di default per tenant esistenti
INSERT INTO automation_sequences (tenant_id, name, trigger_type, trigger_config, message_template, is_enabled)
SELECT
    t.id,
    'inactivity_3_days',
    'inactivity',
    '{"days": 3}'::jsonb,
    'Ciao {{client_name}}! Non ti vediamo da qualche giorno. Tutto bene? Il tuo prossimo allenamento ti aspetta! 💪',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM automation_sequences WHERE tenant_id = t.id AND name = 'inactivity_3_days'
);

INSERT INTO automation_sequences (tenant_id, name, trigger_type, trigger_config, message_template, is_enabled)
SELECT
    t.id,
    'inactivity_7_days',
    'inactivity',
    '{"days": 7}'::jsonb,
    'Ehi {{client_name}}! È passata una settimana dal tuo ultimo check-in. Non mollare, ogni allenamento conta! 🏋️',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM automation_sequences WHERE tenant_id = t.id AND name = 'inactivity_7_days'
);

INSERT INTO automation_sequences (tenant_id, name, trigger_type, trigger_config, message_template, is_enabled)
SELECT
    t.id,
    'inactivity_14_days',
    'inactivity',
    '{"days": 14}'::jsonb,
    '{{client_name}}, sono passate due settimane! Mi manchi in palestra. Che ne dici di tornare questa settimana? 🎯',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM automation_sequences WHERE tenant_id = t.id AND name = 'inactivity_14_days'
);

INSERT INTO automation_sequences (tenant_id, name, trigger_type, trigger_config, message_template, is_enabled)
SELECT
    t.id,
    'post_checkin',
    'checkin',
    '{"delay_minutes": 60}'::jsonb,
    'Grande {{client_name}}! Ottimo allenamento oggi! 🔥 Ricordati di idratarti e riposare bene.',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM automation_sequences WHERE tenant_id = t.id AND name = 'post_checkin'
);

INSERT INTO automation_sequences (tenant_id, name, trigger_type, trigger_config, message_template, is_enabled)
SELECT
    t.id,
    'streak_5',
    'milestone',
    '{"streak": 5}'::jsonb,
    '🎉 WOW {{client_name}}! 5 giorni consecutivi in palestra! Sei una macchina! Continua così! 💪🔥',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM automation_sequences WHERE tenant_id = t.id AND name = 'streak_5'
);

INSERT INTO automation_sequences (tenant_id, name, trigger_type, trigger_config, message_template, is_enabled)
SELECT
    t.id,
    'streak_10',
    'milestone',
    '{"streak": 10}'::jsonb,
    '🏆 INCREDIBILE {{client_name}}! 10 giorni di streak! Sei tra i TOP 10% dei nostri membri più costanti! 🌟',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM automation_sequences WHERE tenant_id = t.id AND name = 'streak_10'
);

INSERT INTO automation_sequences (tenant_id, name, trigger_type, trigger_config, message_template, is_enabled)
SELECT
    t.id,
    'streak_20',
    'milestone',
    '{"streak": 20}'::jsonb,
    '🥇 LEGGENDA {{client_name}}! 20 giorni consecutivi! Passa in reception per il tuo premio speciale! 🎁',
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM automation_sequences WHERE tenant_id = t.id AND name = 'streak_20'
);
