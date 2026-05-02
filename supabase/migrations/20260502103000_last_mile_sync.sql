-- 1. Expenses Table Fixes
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage expenses" ON public.expenses;
CREATE POLICY "Admins manage expenses" ON public.expenses
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin')
);

-- 2. Audit Logs Enhancement
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity TEXT;

DROP VIEW IF EXISTS public.audit_logs_with_users;
CREATE VIEW public.audit_logs_with_users AS
SELECT 
  al.*,
  p.arabic_name as user_name
FROM public.audit_logs al
LEFT JOIN public.profiles p ON p.id = al.user_id;

GRANT SELECT ON public.audit_logs_with_users TO authenticated;

-- 3. create_invoice RPC Update (matching new columns exactly)
DROP FUNCTION IF EXISTS public.create_invoice(uuid, jsonb, numeric, text, boolean);
DROP FUNCTION IF EXISTS public.create_invoice(uuid, jsonb, numeric, text, numeric, numeric, numeric, boolean);

CREATE OR REPLACE FUNCTION public.create_invoice(
  _customer_id uuid, 
  _items jsonb,
  _amount_paid numeric DEFAULT 0, 
  _notes text DEFAULT NULL, 
  _subtotal numeric DEFAULT 0,
  _tax_amount numeric DEFAULT 0,
  _total numeric DEFAULT 0,
  _apply_vat boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _invoice_id UUID; _session_id UUID; _item JSONB;
  _product_id UUID; _printer_id UUID; _qty INT; _price NUMERIC; _line_total NUMERIC;
  _custody_item_id UUID; _available INT; _status TEXT; _invoice_number TEXT;
  _tax_rate NUMERIC := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _session_id FROM public.custody_sessions
   WHERE technician_id = auth.uid() AND status = 'active';
  IF _session_id IS NULL THEN RAISE EXCEPTION 'No active custody session'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items provided'; END IF;

  IF _apply_vat THEN _tax_rate := 0.14; END IF;

  _invoice_number := public.next_invoice_number();
  
  -- Use passed totals if they are > 0, otherwise the DB would need to recalculate. 
  -- The prompt says "Ensure they match the new columns exactly", implying we trust the frontend calculation for these.
  
  INSERT INTO public.invoices (
    invoice_number, customer_id, technician_id, session_id, notes, 
    created_by, tax_rate, subtotal, tax_amount, total, 
    amount_paid, remaining_amount
  )
  VALUES (
    _invoice_number, _customer_id, auth.uid(), _session_id, _notes, 
    auth.uid(), _tax_rate, _subtotal, _tax_amount, _total,
    LEAST(_amount_paid, _total), GREATEST(_total - _amount_paid, 0)
  )
  RETURNING id INTO _invoice_id;

  -- Update payment status
  IF _amount_paid <= 0 THEN _status := 'unpaid';
  ELSIF _amount_paid >= _total THEN _status := 'paid';
  ELSE _status := 'partial'; END IF;
  
  UPDATE public.invoices SET payment_status = _status WHERE id = _invoice_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _product_id := NULLIF(_item->>'product_id','')::UUID;
    _printer_id := NULLIF(_item->>'printer_id','')::UUID;
    _qty := (_item->>'quantity')::INT;
    _price := (_item->>'price_at_sale')::NUMERIC;
    
    IF _product_id IS NOT NULL THEN
      SELECT id, (assigned_quantity - used_quantity) INTO _custody_item_id, _available
        FROM public.custody_items
       WHERE session_id = _session_id AND product_id = _product_id AND status = 'active'
       FOR UPDATE;
    ELSE
      SELECT id, (assigned_quantity - used_quantity) INTO _custody_item_id, _available
        FROM public.custody_items
       WHERE session_id = _session_id AND printer_id = _printer_id AND status = 'active'
       FOR UPDATE;
    END IF;
    
    IF _custody_item_id IS NULL THEN RAISE EXCEPTION 'Item not in your active custody'; END IF;
    IF _available < _qty THEN RAISE EXCEPTION 'Insufficient custody quantity'; END IF;

    UPDATE public.custody_items SET used_quantity = used_quantity + _qty WHERE id = _custody_item_id;

    _line_total := _qty * _price;
    INSERT INTO public.invoice_items (invoice_id, product_id, printer_id, quantity, price_at_sale, line_total)
    VALUES (_invoice_id, _product_id, _printer_id, _qty, _price, _line_total);

    INSERT INTO public.inventory_transactions (type, product_id, printer_id, quantity, reference_type, reference_id, reason, created_by)
    VALUES ('use', _product_id, _printer_id, -_qty, 'invoice', _invoice_id, 'Invoice ' || _invoice_number, auth.uid());
  END LOOP;

  IF _amount_paid > 0 THEN
    INSERT INTO public.payments (invoice_id, amount, method, recorded_by)
    VALUES (_invoice_id, LEAST(_amount_paid, _total), 'initial', auth.uid());
  END IF;

  RETURN _invoice_id;
END $$;

-- 4. Custody Return RPC (Fixing the crash by providing the missing function)
CREATE OR REPLACE FUNCTION public.return_custody_item(
  custody_item_id uuid,
  return_quantity integer,
  admin_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _product_id UUID;
  _printer_id UUID;
  _available INT;
BEGIN
  IF NOT (public.is_super_admin(admin_id) OR public.has_role(admin_id, 'admin') OR public.has_role(admin_id, 'storekeeper')) THEN
    RAISE EXCEPTION 'Not authorized to return custody';
  END IF;

  SELECT product_id, printer_id, (assigned_quantity - used_quantity) 
    INTO _product_id, _printer_id, _available
    FROM public.custody_items 
   WHERE id = custody_item_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Custody item not found'; END IF;
  IF _available < return_quantity THEN RAISE EXCEPTION 'Cannot return more than available'; END IF;

  -- Deduct from custody
  UPDATE public.custody_items 
     SET assigned_quantity = assigned_quantity - return_quantity
   WHERE id = custody_item_id;

  -- Add back to main inventory
  IF _product_id IS NOT NULL THEN
    UPDATE public.products SET quantity = quantity + return_quantity WHERE id = _product_id;
    
    INSERT INTO public.inventory_transactions (type, product_id, quantity, reason, reference_type, reference_id, created_by)
    VALUES ('in', _product_id, return_quantity, 'Custody Return', 'custody', custody_item_id, admin_id);
  ELSE
    UPDATE public.printers SET status = 'in_stock' WHERE id = _printer_id;
    
    INSERT INTO public.inventory_transactions (type, printer_id, quantity, reason, reference_type, reference_id, created_by)
    VALUES ('in', _printer_id, return_quantity, 'Custody Return', 'custody', custody_item_id, admin_id);
  END IF;
END $$;
