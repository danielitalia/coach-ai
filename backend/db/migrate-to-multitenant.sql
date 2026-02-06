-- =====================================================
-- MIGRAZIONE A MULTI-TENANCY
-- Eseguire DOPO schema-multitenant.sql
-- =====================================================

-- 1. Crea il primo tenant (la palestra esistente)
INSERT INTO tenants (
    id,
    name,
    slug,
    whatsapp_number,
    whatsapp_instance_name,
    whatsapp_connected,
    coach_name,
    subscription_plan,
    subscription_status,
    trial_ends_at
) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Centro Fitness Amati',
    'centro-fitness-amati',
    '393920434058',
    'coach-ai',
    true,
    'Coach AI',
    'pro',
    'active',
    NOW() + INTERVAL '30 days'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Crea il primo utente admin
INSERT INTO users (
    id,
    email,
    password_hash,
    name,
    email_verified
) VALUES (
    'b0000000-0000-0000-0000-000000000001'::uuid,
    'admin@centrofitnessamati.it',
    -- Password: admin123 (da cambiare!)
    '$2b$10$rQZ8K.X8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8',
    'Admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- 3. Collega utente al tenant come owner
INSERT INTO user_tenants (user_id, tenant_id, role, accepted_at)
VALUES (
    'b0000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'owner',
    NOW()
) ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- 4. Aggiorna tutti i dati esistenti con il tenant_id
UPDATE clients SET tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE messages SET tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE workout_plans SET tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE sent_reminders SET tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE checkins SET tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE referrals SET tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE rewards SET tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE config SET tenant_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;

-- 5. Rendi tenant_id NOT NULL dopo la migrazione
ALTER TABLE clients ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE workout_plans ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sent_reminders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE checkins ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE referrals ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rewards ALTER COLUMN tenant_id SET NOT NULL;

-- 6. Crea configurazione default per il tenant
INSERT INTO config (tenant_id, key, value) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
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
) ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO config (tenant_id, key, value) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'ai',
    '{
        "gymName": "Centro Fitness Amati",
        "coachName": "Coach AI",
        "personality": "amichevole e motivante",
        "useEmoji": true
    }'::jsonb
) ON CONFLICT (tenant_id, key) DO NOTHING;

-- 7. Log della migrazione
INSERT INTO audit_logs (tenant_id, action, details) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'MIGRATION_TO_MULTITENANT',
    '{"version": "1.0", "date": "2026-02-06"}'::jsonb
);

-- Conferma completamento
SELECT 'Migrazione completata!' as status,
       (SELECT COUNT(*) FROM tenants) as tenants,
       (SELECT COUNT(*) FROM users) as users,
       (SELECT COUNT(*) FROM clients WHERE tenant_id IS NOT NULL) as clients_migrated;
