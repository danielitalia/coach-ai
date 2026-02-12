-- =====================================================
-- SCHEMA MULTI-TENANCY PER COACH AI
-- =====================================================

-- ========== TABELLE CORE MULTI-TENANCY ==========

-- Tabella tenant (palestre)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,

    -- WhatsApp
    whatsapp_number VARCHAR(20),
    whatsapp_instance_name VARCHAR(100),
    whatsapp_connected BOOLEAN DEFAULT FALSE,

    -- Branding
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#22c55e',

    -- Settings AI
    coach_name VARCHAR(100) DEFAULT 'Coach AI',
    coach_personality TEXT DEFAULT 'amichevole e motivante',
    use_emoji BOOLEAN DEFAULT TRUE,
    custom_system_prompt TEXT,

    -- Subscription
    subscription_plan VARCHAR(50) DEFAULT 'trial', -- trial, basic, pro, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active', -- active, past_due, cancelled, expired
    trial_ends_at TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella utenti dashboard
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    avatar_url TEXT,

    -- Email verification
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(100),

    -- Password reset
    password_reset_token VARCHAR(100),
    password_reset_expires TIMESTAMP,

    -- Metadata
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relazione users <-> tenants (many-to-many)
CREATE TABLE IF NOT EXISTS user_tenants (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'staff', -- owner, admin, staff
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    UNIQUE(user_id, tenant_id)
);

-- ========== MODIFICHE TABELLE ESISTENTI ==========

-- Aggiungi tenant_id a clients
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Rimuovi vincolo UNIQUE su phone (ora è unique per tenant)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_phone_key CASCADE;
ALTER TABLE clients ADD CONSTRAINT clients_tenant_phone_unique UNIQUE(tenant_id, phone);

-- Aggiungi tenant_id a messages
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Aggiungi tenant_id a workout_plans
ALTER TABLE workout_plans
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Aggiungi tenant_id a sent_reminders
ALTER TABLE sent_reminders
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Aggiungi tenant_id a checkins
ALTER TABLE checkins
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Aggiungi tenant_id a referrals
ALTER TABLE referrals
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Aggiungi tenant_id a rewards
ALTER TABLE rewards
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Modifica config per supportare tenant-specific settings
ALTER TABLE config
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Rimuovi vincolo UNIQUE su key, ora è unique per tenant
ALTER TABLE config DROP CONSTRAINT IF EXISTS config_pkey;
ALTER TABLE config ADD CONSTRAINT config_tenant_key_unique UNIQUE(tenant_id, key);
ALTER TABLE config ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE config ADD CONSTRAINT config_pkey PRIMARY KEY (id);

-- ========== INDICI PER PERFORMANCE MULTI-TENANT ==========

CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_tenant ON workout_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checkins_tenant ON checkins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_referrals_tenant ON referrals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rewards_tenant ON rewards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_tenant ON config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp ON tenants(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ========== TABELLA SESSIONI (per JWT refresh tokens) ==========

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ========== TABELLA INVITI ==========

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff',
    token VARCHAR(100) UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON invitations(tenant_id);

-- ========== TABELLA AUDIT LOG ==========

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ========== FUNZIONI HELPER ==========

-- Funzione per generare slug da nome
CREATE OR REPLACE FUNCTION generate_slug(name TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per updated_at
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
