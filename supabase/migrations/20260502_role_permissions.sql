-- Create Role Permissions Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role TEXT PRIMARY KEY,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Insert Default Permissions
INSERT INTO public.role_permissions (role, permissions) VALUES
('super_admin', '{"inventory": true, "invoices": true, "expenses": true, "analytics": true, "customers": true, "suppliers": true, "system": true}'::jsonb),
('admin', '{"inventory": true, "invoices": true, "expenses": true, "analytics": true, "customers": true, "suppliers": true, "system": false}'::jsonb),
('storekeeper', '{"inventory": true, "invoices": true, "expenses": false, "analytics": false, "customers": true, "suppliers": true, "system": false}'::jsonb),
('technician', '{"inventory": true, "invoices": true, "expenses": false, "analytics": false, "customers": false, "suppliers": false, "system": false}'::jsonb)
ON CONFLICT (role) DO NOTHING;

-- RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for role_permissions" ON public.role_permissions;
CREATE POLICY "Enable all access for role_permissions" ON public.role_permissions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
