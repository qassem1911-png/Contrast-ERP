
-- PRINTERS: counter
ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS counter INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'printers_counter_nonneg') THEN
    ALTER TABLE public.printers ADD CONSTRAINT printers_counter_nonneg CHECK (counter >= 0);
  END IF;
END $$;

DROP VIEW IF EXISTS public.printers_safe;
CREATE VIEW public.printers_safe WITH (security_invoker = true) AS
SELECT id, serial_number, brand_id, model_id, status, unit_price, counter, notes, created_at, updated_at
FROM public.printers;
GRANT SELECT ON public.printers_safe TO authenticated;

DROP FUNCTION IF EXISTS public.get_printers_full();
CREATE FUNCTION public.get_printers_full()
RETURNS TABLE(id uuid, serial_number text, brand_id uuid, model_id uuid, status text, unit_price numeric, cost_price numeric, counter integer, notes text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT p.id,p.serial_number,p.brand_id,p.model_id,p.status,
                      p.unit_price,p.cost_price,p.counter,p.notes,p.created_at,p.updated_at
               FROM public.printers p ORDER BY p.created_at DESC;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_qty_nonneg') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_qty_nonneg CHECK (quantity >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custody_items_used_le_assigned') THEN
    ALTER TABLE public.custody_items ADD CONSTRAINT custody_items_used_le_assigned
      CHECK (used_quantity >= 0 AND used_quantity <= assigned_quantity);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.spare_part_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, model_id)
);
ALTER TABLE public.spare_part_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read spare_part_models" ON public.spare_part_models;
DROP POLICY IF EXISTS "Admin/Storekeeper insert spare_part_models" ON public.spare_part_models;
DROP POLICY IF EXISTS "Admin/Storekeeper delete spare_part_models" ON public.spare_part_models;
CREATE POLICY "Authenticated read spare_part_models" ON public.spare_part_models
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Storekeeper insert spare_part_models" ON public.spare_part_models
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin/Storekeeper delete spare_part_models" ON public.spare_part_models
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper'));

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  type TEXT NOT NULL DEFAULT 'company',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS customers_touch ON public.customers;
CREATE TRIGGER customers_touch BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read customers" ON public.customers;
DROP POLICY IF EXISTS "Admin/Storekeeper insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admin/Storekeeper update customers" ON public.customers;
DROP POLICY IF EXISTS "Admin delete customers" ON public.customers;
CREATE POLICY "Authenticated read customers" ON public.customers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Storekeeper insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin/Storekeeper update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  technician_id UUID NOT NULL,
  session_id UUID REFERENCES public.custody_sessions(id) ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid','partial','unpaid')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount_paid >= 0 AND amount_paid <= total),
  CHECK (total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_invoices_technician ON public.invoices(technician_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
DROP TRIGGER IF EXISTS invoices_touch ON public.invoices;
CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read invoices by role" ON public.invoices;
CREATE POLICY "Read invoices by role" ON public.invoices
  FOR SELECT TO authenticated USING (
    is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper')
    OR technician_id = auth.uid()
  );

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  printer_id UUID REFERENCES public.printers(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_sale NUMERIC(12,2) NOT NULL CHECK (price_at_sale >= 0),
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((product_id IS NOT NULL)::int + (printer_id IS NOT NULL)::int = 1)
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read invoice_items via parent" ON public.invoice_items;
CREATE POLICY "Read invoice_items via parent" ON public.invoice_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id
      AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper')
           OR i.technician_id = auth.uid()))
  );

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read payments via invoice" ON public.payments;
CREATE POLICY "Read payments via invoice" ON public.payments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payments.invoice_id
      AND (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper')
           OR i.technician_id = auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n BIGINT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number,'[^0-9]','','g'),'')::BIGINT), 0) + 1
    INTO _n FROM public.invoices;
  RETURN 'INV-' || lpad(_n::text, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION public.create_invoice(
  _customer_id UUID, _items JSONB, _amount_paid NUMERIC DEFAULT 0, _notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invoice_id UUID; _session_id UUID; _item JSONB;
  _product_id UUID; _printer_id UUID; _qty INT; _price NUMERIC; _line_total NUMERIC;
  _subtotal NUMERIC := 0; _custody_item_id UUID; _available INT;
  _status TEXT; _invoice_number TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _session_id FROM public.custody_sessions
   WHERE technician_id = auth.uid() AND status = 'active';
  IF _session_id IS NULL THEN RAISE EXCEPTION 'No active custody session'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items provided'; END IF;

  _invoice_number := public.next_invoice_number();
  INSERT INTO public.invoices (invoice_number, customer_id, technician_id, session_id, notes, created_by)
  VALUES (_invoice_number, _customer_id, auth.uid(), _session_id, _notes, auth.uid())
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
       WHERE session_id = _session_id AND product_id = _product_id FOR UPDATE;
    ELSE
      SELECT id, (assigned_quantity - used_quantity) INTO _custody_item_id, _available
        FROM public.custody_items
       WHERE session_id = _session_id AND printer_id = _printer_id FOR UPDATE;
    END IF;
    IF _custody_item_id IS NULL THEN RAISE EXCEPTION 'Item not in your custody'; END IF;
    IF _available < _qty THEN RAISE EXCEPTION 'Insufficient custody quantity (available: %)', _available; END IF;
    UPDATE public.custody_items SET used_quantity = used_quantity + _qty WHERE id = _custody_item_id;
    _line_total := _qty * _price;
    _subtotal := _subtotal + _line_total;
    INSERT INTO public.invoice_items (invoice_id, product_id, printer_id, quantity, price_at_sale, line_total)
    VALUES (_invoice_id, _product_id, _printer_id, _qty, _price, _line_total);
    INSERT INTO public.inventory_transactions (type, product_id, printer_id, quantity, reference_type, reference_id, reason, created_by)
    VALUES ('use', _product_id, _printer_id, -_qty, 'invoice', _invoice_id, 'Invoice ' || _invoice_number, auth.uid());
  END LOOP;

  IF _amount_paid <= 0 THEN _status := 'unpaid';
  ELSIF _amount_paid >= _subtotal THEN _status := 'paid';
  ELSE _status := 'partial'; END IF;

  UPDATE public.invoices
     SET subtotal = _subtotal, total = _subtotal,
         amount_paid = LEAST(_amount_paid, _subtotal),
         remaining_amount = GREATEST(_subtotal - _amount_paid, 0),
         payment_status = _status
   WHERE id = _invoice_id;

  IF _amount_paid > 0 THEN
    INSERT INTO public.payments (invoice_id, amount, method, recorded_by)
    VALUES (_invoice_id, LEAST(_amount_paid, _subtotal), 'initial', auth.uid());
  END IF;

  INSERT INTO public.audit_logs (action_type, table_name, record_id, user_id, after_value)
  VALUES ('invoice_created','invoices',_invoice_id::text,auth.uid(),
          jsonb_build_object('invoice_number',_invoice_number,'total',_subtotal));
  RETURN _invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.record_payment(
  _invoice_id UUID, _amount NUMERIC, _method TEXT DEFAULT NULL, _notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _total NUMERIC; _paid NUMERIC; _new_paid NUMERIC; _status TEXT; _tech UUID;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT total, amount_paid, technician_id INTO _total, _paid, _tech
    FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT (is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin')
          OR has_role(auth.uid(),'storekeeper') OR _tech = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  _new_paid := LEAST(_paid + _amount, _total);
  IF _new_paid >= _total THEN _status := 'paid';
  ELSIF _new_paid > 0 THEN _status := 'partial';
  ELSE _status := 'unpaid'; END IF;
  INSERT INTO public.payments (invoice_id, amount, method, notes, recorded_by)
  VALUES (_invoice_id, _amount, _method, _notes, auth.uid());
  UPDATE public.invoices SET amount_paid = _new_paid,
                              remaining_amount = _total - _new_paid,
                              payment_status = _status
   WHERE id = _invoice_id;
  INSERT INTO public.audit_logs (action_type, table_name, record_id, user_id, after_value)
  VALUES ('payment_recorded','invoices',_invoice_id::text,auth.uid(),
          jsonb_build_object('amount',_amount,'new_paid',_new_paid));
END $$;

CREATE OR REPLACE FUNCTION public.top_customers(_limit INT DEFAULT 10)
RETURNS TABLE(customer_id UUID, name TEXT, total_spent NUMERIC, invoice_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, COALESCE(SUM(i.total),0)::NUMERIC, COUNT(i.id)
  FROM public.customers c
  LEFT JOIN public.invoices i ON i.customer_id = c.id
  WHERE is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper')
  GROUP BY c.id, c.name
  ORDER BY 3 DESC
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.technician_performance()
RETURNS TABLE(technician_id UUID, arabic_name TEXT, invoice_count BIGINT, items_used BIGINT, total_revenue NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.arabic_name,
         COUNT(DISTINCT i.id),
         COALESCE(SUM(ii.quantity),0)::BIGINT,
         COALESCE(SUM(i.total),0)::NUMERIC
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'technician'
  LEFT JOIN public.invoices i ON i.technician_id = p.id
  LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
  WHERE is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'storekeeper')
  GROUP BY p.id, p.arabic_name
  ORDER BY 5 DESC;
$$;

CREATE OR REPLACE FUNCTION public.low_stock_alerts()
RETURNS TABLE(product_id UUID, name TEXT, quantity INT, low_stock_threshold INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, quantity, low_stock_threshold
  FROM public.products
  WHERE quantity <= low_stock_threshold
  ORDER BY quantity ASC;
$$;

CREATE OR REPLACE FUNCTION public.my_custody()
RETURNS TABLE(
  custody_item_id UUID, session_id UUID, product_id UUID, printer_id UUID,
  item_name TEXT, brand_name TEXT, model_name TEXT,
  assigned_quantity INT, used_quantity INT, remaining_quantity INT, unit_price NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ci.id, ci.session_id, ci.product_id, ci.printer_id,
         COALESCE(p.name, 'Printer ' || pr.serial_number),
         b.name, m.name,
         ci.assigned_quantity, ci.used_quantity,
         (ci.assigned_quantity - ci.used_quantity),
         COALESCE(p.unit_price, pr.unit_price)
  FROM public.custody_sessions s
  JOIN public.custody_items ci ON ci.session_id = s.id
  LEFT JOIN public.products p ON p.id = ci.product_id
  LEFT JOIN public.printers pr ON pr.id = ci.printer_id
  LEFT JOIN public.brands b ON b.id = COALESCE(p.brand_id, pr.brand_id)
  LEFT JOIN public.models m ON m.id = COALESCE(p.model_id, pr.model_id)
  WHERE s.technician_id = auth.uid() AND s.status = 'active';
$$;
