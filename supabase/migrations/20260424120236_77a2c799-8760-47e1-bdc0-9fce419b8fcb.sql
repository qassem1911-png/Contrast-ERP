-- Inventory: products (spare parts, ink) and printers
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  category text NOT NULL DEFAULT 'spare_part',
  quantity integer NOT NULL DEFAULT 0,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL UNIQUE,
  model text NOT NULL,
  brand text,
  status text NOT NULL DEFAULT 'in_stock',
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_printers_updated_at
BEFORE UPDATE ON public.printers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: SELECT — all authenticated roles (admin, storekeeper, technician, super_admin)
CREATE POLICY "Authenticated read products"
ON public.products FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'storekeeper')
  OR public.has_role(auth.uid(), 'technician')
);

CREATE POLICY "Authenticated read printers"
ON public.printers FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'storekeeper')
  OR public.has_role(auth.uid(), 'technician')
);

-- INSERT/UPDATE/DELETE — only admin, storekeeper, super_admin
CREATE POLICY "Admin/Storekeeper insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'storekeeper')
);

CREATE POLICY "Admin/Storekeeper update products"
ON public.products FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'storekeeper')
);

CREATE POLICY "Admin/Storekeeper delete products"
ON public.products FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admin/Storekeeper insert printers"
ON public.printers FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'storekeeper')
);

CREATE POLICY "Admin/Storekeeper update printers"
ON public.printers FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'storekeeper')
);

CREATE POLICY "Admin delete printers"
ON public.printers FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);