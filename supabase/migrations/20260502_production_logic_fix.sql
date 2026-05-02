-- 1. Optimized Return Custody Logic
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

    -- Validation: Prevent returning more than available (assigned - used)
    IF v_available_to_return < _return_quantity THEN
        RAISE EXCEPTION 'الكمية المتاحة للإرجاع هي % فقط (العهد المتبقية لدى الفني)', v_available_to_return;
    END IF;

    -- Update Custody Item: Decrement assigned quantity
    UPDATE public.custody_items
    SET assigned_quantity = assigned_quantity - _return_quantity
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

    -- Record Transaction
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

-- 2. Expense RLS Final Policy
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated" ON public.expenses;
CREATE POLICY "Enable all access for authenticated" ON public.expenses
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
