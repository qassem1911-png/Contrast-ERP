-- 1. Correct Audit Logs View (Using entity_id as per manual DB update)
CREATE OR REPLACE VIEW public.audit_logs_with_users AS
SELECT 
    al.id,
    al.created_at,
    al.action_type,
    al.table_name,
    al.record_id,
    al.user_id,
    al.user_role,
    al.action,
    al.entity_id, -- Verified manual update column name
    al.metadata,
    al.before_value,
    al.after_value,
    p.arabic_name as user_name
FROM public.audit_logs al
LEFT JOIN public.profiles p ON al.user_id = p.id;

-- 2. Correct Return Custody Item RPC (Includes Audit Logging)
CREATE OR REPLACE FUNCTION public.return_custody_item(
    _admin_id UUID,
    _custody_item_id UUID,
    _return_quantity INTEGER
) RETURNS VOID AS $$
DECLARE
    v_product_id UUID;
    v_printer_id UUID;
    v_available_to_return INTEGER;
BEGIN
    -- Get current state
    SELECT product_id, printer_id, (assigned_quantity - used_quantity)
    INTO v_product_id, v_printer_id, v_available_to_return
    FROM public.custody_items
    WHERE id = _custody_item_id;

    -- Validation
    IF v_available_to_return < _return_quantity THEN
        RAISE EXCEPTION 'الكمية المتاحة للإرجاع هي % فقط', v_available_to_return;
    END IF;

    -- Update Custody
    UPDATE public.custody_items
    SET assigned_quantity = assigned_quantity - _return_quantity
    WHERE id = _custody_item_id;

    -- Update Stock
    IF v_product_id IS NOT NULL THEN
        UPDATE public.products SET quantity = quantity + _return_quantity WHERE id = v_product_id;
    ELSIF v_printer_id IS NOT NULL THEN
        UPDATE public.printers SET status = 'available' WHERE id = v_printer_id;
    END IF;

    -- Record in Audit Logs (Using entity_id)
    INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, action, entity_id)
    VALUES (_admin_id, 'RETURN', 'custody_items', _custody_item_id, 'إرجاع عهدة للمخزن', v_product_id);
END;
$$ LANGUAGE plpgsql;

-- 3. Correct Record Payment RPC
CREATE OR REPLACE FUNCTION public.record_payment(
    _invoice_id UUID,
    _amount NUMERIC,
    _method TEXT
) RETURNS VOID AS $$
DECLARE
    v_current_paid NUMERIC;
    v_total NUMERIC;
BEGIN
    SELECT amount_paid, total INTO v_current_paid, v_total
    FROM public.invoices
    WHERE id = _invoice_id;

    -- Use payment_method column as per manual DB update
    INSERT INTO public.payments (invoice_id, amount, payment_method, recorded_by)
    VALUES (_invoice_id, _amount, _method, auth.uid());

    UPDATE public.invoices
    SET amount_paid = v_current_paid + _amount,
        remaining_amount = v_total - (v_current_paid + _amount),
        updated_at = NOW()
    WHERE id = _invoice_id;
END;
$$ LANGUAGE plpgsql;
