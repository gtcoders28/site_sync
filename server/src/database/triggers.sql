-- ============================================================================
-- Terminal-State Guard Triggers for Invoices
-- Prevents any modification or illegal transition from 'delivered' or 'cancelled'
-- ============================================================================

-- 1. Distributor Invoices Terminal-State Guard
CREATE OR REPLACE FUNCTION trg_guard_distributor_invoices_terminal_state()
RETURNS TRIGGER AS $$
BEGIN
    -- If current state in DB is already terminal, forbid any updates
    IF OLD.status IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Distributor invoice % is in a terminal state (%), modification is illegal', OLD.invoice_number, OLD.status
            USING ERRCODE = 'P0001';
    END IF;

    -- If moving to delivered, record delivered_at
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        NEW.delivered_at = COALESCE(NEW.delivered_at, clock_timestamp());
    END IF;

    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_distributor_invoices_terminal ON distributor_invoices;
CREATE TRIGGER trg_check_distributor_invoices_terminal
BEFORE UPDATE ON distributor_invoices
FOR EACH ROW
EXECUTE FUNCTION trg_guard_distributor_invoices_terminal_state();

-- 2. Dealer Invoices Terminal-State Guard
CREATE OR REPLACE FUNCTION trg_guard_dealer_invoices_terminal_state()
RETURNS TRIGGER AS $$
BEGIN
    -- If current state in DB is already terminal, forbid any updates
    IF OLD.status IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Dealer invoice % is in a terminal state (%), modification is illegal', OLD.invoice_number, OLD.status
            USING ERRCODE = 'P0001';
    END IF;

    -- If moving to delivered, record delivered_at
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        NEW.delivered_at = COALESCE(NEW.delivered_at, clock_timestamp());
    END IF;

    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_dealer_invoices_terminal ON dealer_invoices;
CREATE TRIGGER trg_check_dealer_invoices_terminal
BEFORE UPDATE ON dealer_invoices
FOR EACH ROW
EXECUTE FUNCTION trg_guard_dealer_invoices_terminal_state();

-- 3. Inbound Purchases Terminal-State Guard
CREATE OR REPLACE FUNCTION trg_guard_distributor_purchases_terminal_state()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('received', 'cancelled') THEN
        RAISE EXCEPTION 'Purchase % is in a terminal state (%), modification is illegal', OLD.invoice_number, OLD.status
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status = 'received' AND OLD.status != 'received' THEN
        NEW.received_at = COALESCE(NEW.received_at, clock_timestamp());
    END IF;

    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_distributor_purchases_terminal ON distributor_purchases;
CREATE TRIGGER trg_check_distributor_purchases_terminal
BEFORE UPDATE ON distributor_purchases
FOR EACH ROW
EXECUTE FUNCTION trg_guard_distributor_purchases_terminal_state();
