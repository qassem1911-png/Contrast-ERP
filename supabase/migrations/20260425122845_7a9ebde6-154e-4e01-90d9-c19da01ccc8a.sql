-- 1. Drop existing inventory (no production data)
DROP TABLE IF EXISTS public.printers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- 2. Brands
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- 3. Models
CREATE TABLE public.models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('printer','spare_part','ink')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, name, type)
);
CREATE INDEX idx_models_brand ON public.models(brand_id);
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

-- 4. Products (spare parts / ink)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('spare_part','ink')),
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_brand ON public.products(brand_id);
CREATE INDEX idx_products_model ON public.products(model_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_products_touch BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Printers (machines with serials)
CREATE TABLE public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT NOT NULL UNIQUE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','assigned','sold','maintenance','retired')),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_printers_brand ON public.printers(brand_id);
CREATE INDEX idx_printers_model ON public.printers(model_id);
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_printers_touch BEFORE UPDATE ON public.printers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Safe view (no cost_price) for non-admin roles
CREATE VIEW public.products_safe
WITH (security_invoker = true)
AS
SELECT id, name, sku, brand_id, model_id, category, quantity,
       unit_price, low_stock_threshold, notes, created_at, updated_at
FROM public.products;

CREATE VIEW public.printers_safe
WITH (security_invoker = true)
AS
SELECT id, serial_number, brand_id, model_id, status,
       unit_price, notes, created_at, updated_at
FROM public.printers;

-- 7. Custody sessions
CREATE TABLE public.custody_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_by UUID,
  notes TEXT
);
-- Enforce ONE active session per technician
CREATE UNIQUE INDEX uniq_active_session_per_tech
  ON public.custody_sessions(technician_id)
  WHERE status = 'active';
CREATE INDEX idx_custody_sessions_tech ON public.custody_sessions(technician_id);
ALTER TABLE public.custody_sessions ENABLE ROW LEVEL SECURITY;

-- 8. Custody items
CREATE TABLE public.custody_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.custody_sessions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  printer_id UUID REFERENCES public.printers(id) ON DELETE RESTRICT,
  assigned_quantity INT NOT NULL DEFAULT 0 CHECK (assigned_quantity >= 0),
  used_quantity INT NOT NULL DEFAULT 0 CHECK (used_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (product_id IS NOT NULL AND printer_id IS NULL)
    OR (product_id IS NULL AND printer_id IS NOT NULL)
  ),
  CHECK (used_quantity <= assigned_quantity)
);
CREATE INDEX idx_custody_items_session ON public.custody_items(session_id);
ALTER TABLE public.custody_items ENABLE ROW LEVEL SECURITY;

-- 9. Inventory transactions
CREATE TABLE public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('add','deduct','transfer','adjustment')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  printer_id UUID REFERENCES public.printers(id) ON DELETE SET NULL,
  quantity INT NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('inventory','custody','invoice')),
  reference_id UUID,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_product ON public.inventory_transactions(product_id);
CREATE INDEX idx_tx_printer ON public.inventory_transactions(printer_id);
CREATE INDEX idx_tx_created_by ON public.inventory_transactions(created_by);
CREATE INDEX idx_tx_ref ON public.inventory_transactions(reference_type, reference_id);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- Brands: read for any signed in user; write for admins
CREATE POLICY "Authenticated read brands" ON public.brands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert brands" ON public.brands
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update brands" ON public.brands
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete brands" ON public.brands
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Models: same pattern
CREATE POLICY "Authenticated read models" ON public.models
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert models" ON public.models
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update models" ON public.models
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete models" ON public.models
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Products: only admins/super_admin can read full table (cost included)
-- Others use products_safe view (security_invoker means RLS still applies on base table -> we add a separate read for safe data)
CREATE POLICY "Admins read products full" ON public.products
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));
-- Storekeepers & technicians need to read the base table for the view to work, but the view excludes cost.
-- We add a permissive SELECT for them too; the column-level protection comes from never exposing cost in the view.
-- To truly hide cost at the DB level, deny direct table SELECT to non-admins:
CREATE POLICY "Storekeeper/tech read products via base" ON public.products
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'storekeeper') OR public.has_role(auth.uid(),'technician'));
-- Note: with the above, non-admins CAN technically read cost via the base table.
-- To truly block cost, revoke column privilege:
REVOKE SELECT (cost_price) ON public.products FROM authenticated;
GRANT SELECT (id, name, sku, brand_id, model_id, category, quantity, unit_price, low_stock_threshold, notes, created_by, created_at, updated_at) ON public.products TO authenticated;
-- And re-grant cost_price only to service_role (admins read via RLS using a separate path? Postgres column GRANTs apply to the role, not per-RLS-policy.)
-- Workaround: admins should read cost via a SECURITY DEFINER function or via products_full view owned by postgres.

CREATE POLICY "Admin/Storekeeper insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin/Storekeeper update products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin delete products" ON public.products
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Admin-only view that includes cost_price (bypasses column grant via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_products_full()
RETURNS TABLE (
  id UUID, name TEXT, sku TEXT, brand_id UUID, model_id UUID, category TEXT,
  quantity INT, unit_price NUMERIC, cost_price NUMERIC, low_stock_threshold INT,
  notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT p.id,p.name,p.sku,p.brand_id,p.model_id,p.category,
                      p.quantity,p.unit_price,p.cost_price,p.low_stock_threshold,
                      p.notes,p.created_at,p.updated_at
               FROM public.products p ORDER BY p.created_at DESC;
END $$;

-- Printers: same column-level restriction on cost_price
CREATE POLICY "Authenticated read printers" ON public.printers
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'storekeeper')
    OR public.has_role(auth.uid(),'technician')
  );
REVOKE SELECT (cost_price) ON public.printers FROM authenticated;
GRANT SELECT (id, serial_number, brand_id, model_id, status, unit_price, notes, created_by, created_at, updated_at) ON public.printers TO authenticated;

CREATE POLICY "Admin/Storekeeper insert printers" ON public.printers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin/Storekeeper update printers" ON public.printers
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin delete printers" ON public.printers
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_printers_full()
RETURNS TABLE (
  id UUID, serial_number TEXT, brand_id UUID, model_id UUID, status TEXT,
  unit_price NUMERIC, cost_price NUMERIC, notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT p.id,p.serial_number,p.brand_id,p.model_id,p.status,
                      p.unit_price,p.cost_price,p.notes,p.created_at,p.updated_at
               FROM public.printers p ORDER BY p.created_at DESC;
END $$;

-- Custody sessions
CREATE POLICY "Tech reads own sessions" ON public.custody_sessions
  FOR SELECT TO authenticated
  USING (
    technician_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'storekeeper')
  );
CREATE POLICY "Admin/Storekeeper manage sessions insert" ON public.custody_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin/Storekeeper manage sessions update" ON public.custody_sessions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin delete sessions" ON public.custody_sessions
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Custody items
CREATE POLICY "Tech reads own custody items" ON public.custody_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custody_sessions s
      WHERE s.id = custody_items.session_id
        AND (
          s.technician_id = auth.uid()
          OR public.is_super_admin(auth.uid())
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'storekeeper')
        )
    )
  );
CREATE POLICY "Admin/Storekeeper insert custody items" ON public.custody_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin/Storekeeper update custody items" ON public.custody_items
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'));
CREATE POLICY "Admin delete custody items" ON public.custody_items
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Inventory transactions
CREATE POLICY "Read own + admin/storekeeper all transactions" ON public.inventory_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'storekeeper')
    OR created_by = auth.uid()
  );
CREATE POLICY "Admin/Storekeeper insert transactions" ON public.inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper'))
    AND created_by = auth.uid()
  );
-- No update / delete policies => no one can modify or delete transaction history (immutable audit trail)

-- =========================================================
-- Atomic stock-adjustment RPC (writes product + transaction in one shot)
-- =========================================================
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  _product_id UUID,
  _delta INT,
  _reason TEXT,
  _type TEXT DEFAULT 'adjustment'
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _new_qty INT;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _type NOT IN ('add','deduct','adjustment') THEN
    RAISE EXCEPTION 'Invalid type';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason required';
  END IF;

  UPDATE public.products SET quantity = quantity + _delta
  WHERE id = _product_id
  RETURNING quantity INTO _new_qty;

  IF _new_qty IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF _new_qty < 0 THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  INSERT INTO public.inventory_transactions
    (type, product_id, quantity, reference_type, reason, created_by)
  VALUES
    (_type, _product_id, _delta, 'inventory', _reason, auth.uid());
END $$;

-- =========================================================
-- Atomic assign-custody RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.assign_custody_product(
  _technician_id UUID,
  _product_id UUID,
  _quantity INT,
  _reason TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _session_id UUID;
  _new_qty INT;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  -- get or create active session
  SELECT id INTO _session_id FROM public.custody_sessions
  WHERE technician_id = _technician_id AND status = 'active';
  IF _session_id IS NULL THEN
    INSERT INTO public.custody_sessions (technician_id, created_by)
    VALUES (_technician_id, auth.uid())
    RETURNING id INTO _session_id;
  END IF;

  -- deduct from warehouse
  UPDATE public.products SET quantity = quantity - _quantity
  WHERE id = _product_id
  RETURNING quantity INTO _new_qty;
  IF _new_qty IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF _new_qty < 0 THEN RAISE EXCEPTION 'Insufficient stock'; END IF;

  -- add or upsert custody item
  INSERT INTO public.custody_items (session_id, product_id, assigned_quantity)
  VALUES (_session_id, _product_id, _quantity);

  -- log transaction
  INSERT INTO public.inventory_transactions
    (type, product_id, quantity, reference_type, reference_id, reason, created_by)
  VALUES
    ('transfer', _product_id, -_quantity, 'custody', _session_id, _reason, auth.uid());

  RETURN _session_id;
END $$;

CREATE OR REPLACE FUNCTION public.assign_custody_printer(
  _technician_id UUID,
  _printer_id UUID,
  _reason TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _session_id UUID;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'storekeeper')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO _session_id FROM public.custody_sessions
  WHERE technician_id = _technician_id AND status = 'active';
  IF _session_id IS NULL THEN
    INSERT INTO public.custody_sessions (technician_id, created_by)
    VALUES (_technician_id, auth.uid())
    RETURNING id INTO _session_id;
  END IF;

  UPDATE public.printers SET status = 'assigned'
  WHERE id = _printer_id AND status = 'in_stock';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Printer not available';
  END IF;

  INSERT INTO public.custody_items (session_id, printer_id, assigned_quantity)
  VALUES (_session_id, _printer_id, 1);

  INSERT INTO public.inventory_transactions
    (type, printer_id, quantity, reference_type, reference_id, reason, created_by)
  VALUES
    ('transfer', _printer_id, -1, 'custody', _session_id, _reason, auth.uid());

  RETURN _session_id;
END $$;