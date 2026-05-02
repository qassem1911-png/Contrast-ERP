-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    arabic_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Models Table
CREATE TABLE IF NOT EXISTS public.models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID CONSTRAINT models_brand_id_fkey REFERENCES public.brands(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT,
    brand_id UUID CONSTRAINT products_brand_id_fkey REFERENCES public.brands(id),
    model_id UUID CONSTRAINT products_model_id_fkey REFERENCES public.models(id),
    category TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID CONSTRAINT products_created_by_fkey REFERENCES auth.users(id)
);

-- 5. Printers Table
CREATE TABLE IF NOT EXISTS public.printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number TEXT UNIQUE NOT NULL,
    brand_id UUID CONSTRAINT printers_brand_id_fkey REFERENCES public.brands(id),
    model_id UUID CONSTRAINT printers_model_id_fkey REFERENCES public.models(id),
    counter INTEGER DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL CONSTRAINT payments_invoice_id_fkey REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    recorded_by UUID CONSTRAINT payments_recorded_by_fkey REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for admins" ON public.system_settings;
CREATE POLICY "Enable all for admins" ON public.system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- 8. Suppliers & Transactions
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID CONSTRAINT suppliers_created_by_fkey REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.supplier_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID CONSTRAINT supplier_transactions_supplier_id_fkey REFERENCES public.suppliers(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID CONSTRAINT supplier_payments_supplier_id_fkey REFERENCES public.suppliers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    method TEXT DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Custody & Sessions
ALTER TABLE public.custody_sessions ADD CONSTRAINT custody_sessions_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.profiles(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.profiles(id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- 11. Financial Stats RPC
CREATE OR REPLACE FUNCTION public.get_financial_hub_stats()
RETURNS JSON AS $$
DECLARE
    v_total_revenue NUMERIC;
    v_total_expenses NUMERIC;
    v_liquidity NUMERIC;
    v_accounts_payable NUMERIC;
    v_inventory_value NUMERIC;
BEGIN
    SELECT COALESCE(SUM(amount_paid), 0) INTO v_total_revenue FROM public.invoices;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses FROM public.expenses;
    v_liquidity := v_total_revenue - v_total_expenses;
    SELECT COALESCE(SUM(remaining_amount), 0) INTO v_accounts_payable FROM public.supplier_transactions;
    -- Note: Products table created in this migration
    SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_inventory_value FROM public.products;

    RETURN json_build_object(
        'total_revenue', v_total_revenue,
        'total_expenses', v_total_expenses,
        'liquidity', v_liquidity,
        'accounts_payable', v_accounts_payable,
        'inventory_value', v_inventory_value,
        'net_profit', v_liquidity - v_accounts_payable
    );
END;
$$ LANGUAGE plpgsql;

-- 9. Audit Logs View (Match CSV)
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
    al.entity,
    al.metadata,
    al.before_value,
    al.after_value,
    p.arabic_name as user_name
FROM public.audit_logs al
LEFT JOIN public.profiles p ON al.user_id = p.id;
