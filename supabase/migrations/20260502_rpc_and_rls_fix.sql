-- 1. Return Custody Item RPC
CREATE OR REPLACE FUNCTION public.return_custody_item(
    _admin_id UUID,
    _custody_item_id UUID,
    _return_quantity INTEGER
) RETURNS VOID AS $$
DECLARE
    v_product_id UUID;
    v_printer_id UUID;
BEGIN
    -- Get IDs from the custody record
    SELECT product_id, printer_id INTO v_product_id, v_printer_id
    FROM public.custody_items
    WHERE id = _custody_item_id;

    -- Update Custody Item: Decrement assigned quantity
    UPDATE public.custody_items
    SET assigned_quantity = assigned_quantity - _return_quantity,
        notes = COALESCE(notes, '') || E'\n[إرجاع] تم إرجاع ' || _return_quantity || ' وحدة بتاريخ ' || NOW()::DATE
    WHERE id = _custody_item_id;

    -- Restore Inventory Stock
    IF v_product_id IS NOT NULL THEN
        UPDATE public.products
        SET quantity = quantity + _return_quantity
        WHERE id = v_product_id;
    ELSIF v_printer_id IS NOT NULL THEN
        UPDATE public.printers
        SET status = 'available'
        WHERE id = v_printer_id;
    END IF;

    -- Record the return transaction
    INSERT INTO public.inventory_transactions (
        type, 
        quantity, 
        product_id, 
        printer_id, 
        created_by, 
        reason, 
        reference_type, 
        reference_id
    ) VALUES (
        'in', 
        _return_quantity, 
        v_product_id, 
        v_printer_id, 
        _admin_id, 
        'إرجاع عهدة إلى المخزن', 
        'custody', 
        _custody_item_id
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Expense Table RLS & Visibility
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.expenses;
CREATE POLICY "Enable select for authenticated users" ON public.expenses
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.expenses;
CREATE POLICY "Enable insert for authenticated users" ON public.expenses
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Record Payment RPC
CREATE OR REPLACE FUNCTION public.record_payment(
    _invoice_id UUID,
    _amount NUMERIC,
    _method TEXT
) RETURNS VOID AS $$
DECLARE
    v_current_paid NUMERIC;
    v_total NUMERIC;
BEGIN
    -- Get current invoice status
    SELECT amount_paid, total INTO v_current_paid, v_total
    FROM public.invoices
    WHERE id = _invoice_id;

    -- Insert record into payments table
    INSERT INTO public.payments (invoice_id, amount, payment_method, recorded_by)
    VALUES (_invoice_id, _amount, _method, auth.uid());

    -- Update invoice financial balance
    UPDATE public.invoices
    SET amount_paid = v_current_paid + _amount,
        remaining_amount = v_total - (v_current_paid + _amount),
        updated_at = NOW()
    WHERE id = _invoice_id;
END;
$$ LANGUAGE plpgsql;
