-- =====================================================
-- MIGRATION 005: Monitoring System
-- =====================================================
-- Tabelle per il sistema di monitoring e alert
-- =====================================================

-- Storico alert inviati
CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error'
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created ON monitoring_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity);

-- Log health checks
CREATE TABLE IF NOT EXISTS monitoring_health_logs (
    id SERIAL PRIMARY KEY,
    check_type VARCHAR(50) NOT NULL, -- 'database', 'evolution_api', 'whatsapp', 'full'
    status VARCHAR(20) NOT NULL, -- 'healthy', 'unhealthy', 'degraded'
    details JSONB,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mantieni solo ultimi 7 giorni di log (pulizia automatica)
CREATE INDEX IF NOT EXISTS idx_health_logs_created ON monitoring_health_logs(created_at DESC);

-- Commenti
COMMENT ON TABLE monitoring_alerts IS 'Storico degli alert inviati via Telegram';
COMMENT ON TABLE monitoring_health_logs IS 'Log dei controlli di salute del sistema';
