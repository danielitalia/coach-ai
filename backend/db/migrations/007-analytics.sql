-- =====================================================
-- MIGRATION 007: Analytics System
-- =====================================================
-- Sistema di analytics per tracciare metriche e KPI
-- =====================================================

-- Statistiche giornaliere per tenant
CREATE TABLE IF NOT EXISTS daily_stats (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Messaggi
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    ai_responses INTEGER DEFAULT 0,

    -- Clienti
    new_clients INTEGER DEFAULT 0,
    active_clients INTEGER DEFAULT 0, -- clienti che hanno interagito

    -- Check-in
    checkins INTEGER DEFAULT 0,
    unique_checkins INTEGER DEFAULT 0, -- clienti unici che hanno fatto check-in

    -- Automazioni
    automation_messages_sent INTEGER DEFAULT 0,
    automation_conversions INTEGER DEFAULT 0, -- risposte alle automazioni

    -- Engagement
    avg_response_time_seconds INTEGER, -- tempo medio risposta AI
    client_satisfaction_score DECIMAL(3,2), -- se implementato feedback

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, date)
);

-- Metriche aggregate mensili (per performance)
CREATE TABLE IF NOT EXISTS monthly_stats (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,

    -- Totali
    total_messages INTEGER DEFAULT 0,
    total_checkins INTEGER DEFAULT 0,
    total_new_clients INTEGER DEFAULT 0,
    total_automation_messages INTEGER DEFAULT 0,

    -- Medie
    avg_daily_messages DECIMAL(10,2),
    avg_daily_checkins DECIMAL(10,2),
    avg_response_time_seconds INTEGER,

    -- Crescita
    client_growth_rate DECIMAL(5,2), -- % crescita clienti vs mese precedente
    checkin_growth_rate DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, year, month)
);

-- Eventi analytics (per tracking dettagliato)
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,

    event_type VARCHAR(50) NOT NULL, -- 'message', 'checkin', 'automation', 'conversion', etc.
    event_name VARCHAR(100), -- nome specifico evento
    event_data JSONB DEFAULT '{}', -- dati aggiuntivi

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_daily_stats_tenant_date ON daily_stats(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_tenant ON monthly_stats(tenant_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant ON analytics_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type, created_at DESC);

-- Funzione per aggiornare stats giornaliere
CREATE OR REPLACE FUNCTION update_daily_stats(
    p_tenant_id UUID,
    p_date DATE,
    p_field VARCHAR,
    p_increment INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
    INSERT INTO daily_stats (tenant_id, date)
    VALUES (p_tenant_id, p_date)
    ON CONFLICT (tenant_id, date) DO NOTHING;

    EXECUTE format('UPDATE daily_stats SET %I = %I + $1, updated_at = NOW() WHERE tenant_id = $2 AND date = $3', p_field, p_field)
    USING p_increment, p_tenant_id, p_date;
END;
$$ LANGUAGE plpgsql;

-- Commenti
COMMENT ON TABLE daily_stats IS 'Statistiche giornaliere per ogni tenant';
COMMENT ON TABLE monthly_stats IS 'Statistiche mensili aggregate per performance';
COMMENT ON TABLE analytics_events IS 'Eventi dettagliati per analytics avanzati';
