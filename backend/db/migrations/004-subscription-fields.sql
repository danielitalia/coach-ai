-- =====================================================
-- MIGRATION 004: Subscription Management Fields
-- =====================================================
-- Aggiunge campi per gestione manuale degli abbonamenti
-- (pagamenti esterni via bonifico/contratto)
-- =====================================================

-- Aggiungi campo prezzo abbonamento
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS subscription_price DECIMAL(10,2);

-- Aggiungi campo note abbonamento
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS subscription_notes TEXT;

-- Commenti per documentazione
COMMENT ON COLUMN tenants.subscription_price IS 'Prezzo mensile abbonamento in EUR';
COMMENT ON COLUMN tenants.subscription_notes IS 'Note sul contratto/pagamento (es. data firma, metodo pagamento)';
