-- ============================================================
-- Production-ready ERP improvements
-- ============================================================

-- 1) custody_items: add status + notes, atomic consumption trigger
ALTER TABLE public.custody_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.custody_items
SET status = 'consumed'
WHERE status = 'active' AND used_quantity >= assigned_quantity AND assigned_quantity > 0;

CREATE OR REPLACE FUNCTION public.custody_items_auto_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.used_quantity >= NEW.assigned_quantity AND NEW.assigned_quantity > 0 THEN
    NEW.status := 'consumed';
  ELSIF NEW.status IS NULL OR NEW.status NOT IN ('consumed','returned') THEN
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_custody_items_status ON public.custody_items;
CREATE TRIGGER trg_custody_items_status
BEFORE INSERT OR UPDATE OF used_quantity, assigned_quantity ON public.custody_items
FOR EACH ROW EXECUTE FUNCTION public.custody_items_auto_status();

-- 2) invoices VAT
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0;

-- 3) create_invoice with VAT + atomic locks
DROP FUNCTION IF EXISTS public.create_invoice(uuid, jsonb, numeric, text);
DROP FUNCTION IF EXISTS public.create_invoice(uuid, jsonb, numeric, text, boolean);
CREATE OR REPLACE FUNCTION public.create_invoice(
  _customer_id uuid, _items jsonb,
  _amount_paid numeric DEFAULT 0, _notes text DEFAULT NULL, _apply_vat boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _invoice_id UUID; _session_id UUID; _item JSONB;
  _product_id UUID; _printer_id UUID; _qty INT; _price NUMERIC; _line_total NUMERIC;
  _subtotal NUMERIC := 0; _custody_item_id UUID; _available INT;
  _status TEXT; _invoice_number TEXT;
  _tax_rate NUMERIC := 0; _tax_amount NUMERIC := 0; _grand_total NUMERIC := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _session_id FROM public.custody_sessions
   WHERE technician_id = auth.uid() AND status = 'active';
  IF _session_id IS NULL THEN RAISE EXCEPTION 'No active custody session'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items provided'; END IF;

  IF _apply_vat THEN _tax_rate := 0.14; END IF;

  _invoice_number := public.next_invoice_number();
  INSERT INTO public.invoices (invoice_number, customer_id, technician_id, session_id, notes, created_by, tax_rate)
  VALUES (_invoice_number, _customer_id, auth.uid(), _session_id, _notes, auth.uid(), _tax_rate)
  RETURNING id INTO _invoice_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _product_id := NULLIF(_item->>'product_id','')::UUID;
    _printer_id := NULLIF(_item->>'printer_id','')::UUID;
    _qty := (_item->>'quantity')::INT;
    _price := (_item->>'price_at_sale')::NUMERIC;
    IF _qty <= 0 OR _price < 0 THEN RAISE EXCEPTION 'Invalid item'; END IF;
    IF (_product_id IS NULL) = (_printer_id IS NULL) THEN
      RAISE EXCEPTION 'Item must reference exactly one of product/printer';
    END IF;

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
    IF _available < _qty THEN RAISE EXCEPTION 'Insufficient custody quantity (available: %)', _available; END IF;

    UPDATE public.custody_items
       SET used_quantity = used_quantity + _qty
     WHERE id = _custody_item_id;

    _line_total := _qty * _price;
    _subtotal := _subtotal + _line_total;

    INSERT INTO public.invoice_items (invoice_id, product_id, printer_id, quantity, price_at_sale, line_total)
    VALUES (_invoice_id, _product_id, _printer_id, _qty, _price, _line_total);

    INSERT INTO public.inventory_transactions (type, product_id, printer_id, quantity, reference_type, reference_id, reason, created_by)
    VALUES ('use', _product_id, _printer_id, -_qty, 'invoice', _invoice_id, 'Invoice ' || _invoice_number, auth.uid());
  END LOOP;

  _tax_amount := round(_subtotal * _tax_rate, 2);
  _grand_total := _subtotal + _tax_amount;

  IF _amount_paid <= 0 THEN _status := 'unpaid';
  ELSIF _amount_paid >= _grand_total THEN _status := 'paid';
  ELSE _status := 'partial'; END IF;

  UPDATE public.invoices
     SET subtotal = _subtotal, tax_amount = _tax_amount, total = _grand_total,
         amount_paid = LEAST(_amount_paid, _grand_total),
         remaining_amount = GREATEST(_grand_total - _amount_paid, 0),
         payment_status = _status
   WHERE id = _invoice_id;

  IF _amount_paid > 0 THEN
    INSERT INTO public.payments (invoice_id, amount, method, recorded_by)
    VALUES (_invoice_id, LEAST(_amount_paid, _grand_total), 'initial', auth.uid());
  END IF;

  INSERT INTO public.audit_logs (action_type, table_name, record_id, user_id, after_value)
  VALUES ('invoice_created','invoices',_invoice_id::text,auth.uid(),
          jsonb_build_object('invoice_number',_invoice_number,'subtotal',_subtotal,'tax',_tax_amount,'total',_grand_total));
  RETURN _invoice_id;
END $$;

-- 4) custody assigns persist notes
CREATE OR REPLACE FUNCTION public.assign_custody_product(
  _technician_id uuid, _product_id uuid, _quantity integer, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _session_id UUID; _new_qty INT;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  SELECT id INTO _session_id FROM public.custody_sessions
  WHERE technician_id = _technician_id AND status = 'active';
  IF _session_id IS NULL THEN
    INSERT INTO public.custody_sessions (technician_id, created_by)
    VALUES (_technician_id, auth.uid()) RETURNING id INTO _session_id;
  END IF;

  UPDATE public.products SET quantity = quantity - _quantity
  WHERE id = _product_id RETURNING quantity INTO _new_qty;
  IF _new_qty IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF _new_qty < 0 THEN RAISE EXCEPTION 'Insufficient stock'; END IF;

  INSERT INTO public.custody_items (session_id, product_id, assigned_quantity, notes)
  VALUES (_session_id, _product_id, _quantity, _reason);

  INSERT INTO public.inventory_transactions
    (type, product_id, quantity, reference_type, reference_id, reason, created_by)
  VALUES ('transfer', _product_id, -_quantity, 'custody', _session_id, _reason, auth.uid());

  RETURN _session_id;
END $$;

CREATE OR REPLACE FUNCTION public.assign_custody_printer(
  _technician_id uuid, _printer_id uuid, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _session_id UUID;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO _session_id FROM public.custody_sessions
  WHERE technician_id = _technician_id AND status = 'active';
  IF _session_id IS NULL THEN
    INSERT INTO public.custody_sessions (technician_id, created_by)
    VALUES (_technician_id, auth.uid()) RETURNING id INTO _session_id;
  END IF;

  UPDATE public.printers SET status = 'assigned'
  WHERE id = _printer_id AND status = 'in_stock';
  IF NOT FOUND THEN RAISE EXCEPTION 'Printer not available'; END IF;

  INSERT INTO public.custody_items (session_id, printer_id, assigned_quantity, notes)
  VALUES (_session_id, _printer_id, 1, _reason);

  INSERT INTO public.inventory_transactions
    (type, printer_id, quantity, reference_type, reference_id, reason, created_by)
  VALUES ('transfer', _printer_id, -1, 'custody', _session_id, _reason, auth.uid());

  RETURN _session_id;
END $$;

-- 5) my_custody returns notes & status
DROP FUNCTION IF EXISTS public.my_custody();
CREATE OR REPLACE FUNCTION public.my_custody()
RETURNS TABLE(custody_item_id uuid, session_id uuid, product_id uuid, printer_id uuid,
              item_name text, brand_name text, model_name text,
              assigned_quantity integer, used_quantity integer, remaining_quantity integer,
              unit_price numeric, notes text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT ci.id, ci.session_id, ci.product_id, ci.printer_id,
         COALESCE(p.name, 'Printer ' || pr.serial_number),
         b.name, m.name,
         ci.assigned_quantity, ci.used_quantity,
         (ci.assigned_quantity - ci.used_quantity),
         COALESCE(p.unit_price, pr.unit_price),
         ci.notes, ci.status
  FROM public.custody_sessions s
  JOIN public.custody_items ci ON ci.session_id = s.id
  LEFT JOIN public.products p ON p.id = ci.product_id
  LEFT JOIN public.printers pr ON pr.id = ci.printer_id
  LEFT JOIN public.brands b ON b.id = COALESCE(p.brand_id, pr.brand_id)
  LEFT JOIN public.models m ON m.id = COALESCE(p.model_id, pr.model_id)
  WHERE s.technician_id = auth.uid() AND s.status = 'active' AND ci.status = 'active';
$$;

-- 6) Audit logs RLS: technicians see own
DROP POLICY IF EXISTS "Tech reads own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admin reads audit logs" ON public.audit_logs;
CREATE POLICY "Read audit logs by role" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- 7) Generic audit-logging trigger
CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _action TEXT; _rec_id TEXT; _before JSONB; _after JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := TG_TABLE_NAME || '_insert'; _after := to_jsonb(NEW); _rec_id := NEW.id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := TG_TABLE_NAME || '_update'; _before := to_jsonb(OLD); _after := to_jsonb(NEW); _rec_id := NEW.id::text;
  ELSIF TG_OP = 'DELETE' THEN
    _action := TG_TABLE_NAME || '_delete'; _before := to_jsonb(OLD); _rec_id := OLD.id::text;
  END IF;
  INSERT INTO public.audit_logs (action_type, table_name, record_id, user_id, before_value, after_value)
  VALUES (_action, TG_TABLE_NAME, _rec_id, auth.uid(), _before, _after);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

DROP TRIGGER IF EXISTS trg_audit_printers ON public.printers;
CREATE TRIGGER trg_audit_printers AFTER INSERT OR UPDATE OR DELETE ON public.printers
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

DROP TRIGGER IF EXISTS trg_audit_custody_items ON public.custody_items;
CREATE TRIGGER trg_audit_custody_items AFTER INSERT OR UPDATE OR DELETE ON public.custody_items
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

-- 8) dashboard_stats
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS TABLE(invoices_today bigint, invoices_total bigint, revenue_today numeric, active_custody_sessions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    (SELECT COUNT(*) FROM public.invoices
       WHERE created_at::date = CURRENT_DATE
         AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'storekeeper') OR technician_id = auth.uid())),
    (SELECT COUNT(*) FROM public.invoices
       WHERE public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'storekeeper') OR technician_id = auth.uid()),
    (SELECT COALESCE(SUM(total),0) FROM public.invoices
       WHERE created_at::date = CURRENT_DATE
         AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'storekeeper') OR technician_id = auth.uid())),
    (SELECT COUNT(*) FROM public.custody_sessions
       WHERE status='active'
         AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'storekeeper') OR technician_id = auth.uid()));
$$;