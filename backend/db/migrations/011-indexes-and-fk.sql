-- Migration 011: Performance indexes and FK constraints
-- Applied: 2026-03-05

-- Composite indexes for heavy queries
CREATE INDEX IF NOT EXISTS idx_messages_tenant_phone_date ON messages(tenant_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_activity ON clients(tenant_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_tenant_phone_date ON checkins(tenant_id, phone, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_plans_tenant_phone_date ON workout_plans(tenant_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_actions_tenant_phone_date ON brain_actions(tenant_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_signals_tenant_phone ON conversation_signals(tenant_id, phone);
