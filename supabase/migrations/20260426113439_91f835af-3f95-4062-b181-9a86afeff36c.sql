-- Ensure full row data is sent on UPDATE/DELETE so the frontend can reconcile
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.printers REPLICA IDENTITY FULL;
ALTER TABLE public.custody_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.custody_items REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.invoice_items REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication (idempotent)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'products','printers','custody_sessions','custody_items',
    'invoices','invoice_items','payments'
  ]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Helper RPC: custody activity in last 24h (for dashboard monitor)
CREATE OR REPLACE FUNCTION public.custody_activity_24h()
RETURNS TABLE (
  session_id UUID,
  technician_id UUID,
  technician_name TEXT,
  status TEXT,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  items_count BIGINT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.technician_id, p.arabic_name, s.status, s.opened_at, s.closed_at,
         COALESCE((SELECT COUNT(*) FROM public.custody_items ci WHERE ci.session_id = s.id), 0)
  FROM public.custody_sessions s
  LEFT JOIN public.profiles p ON p.id = s.technician_id
  WHERE (s.opened_at >= now() - interval '24 hours'
         OR s.closed_at >= now() - interval '24 hours')
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'storekeeper')
      OR s.technician_id = auth.uid()
    )
  ORDER BY COALESCE(s.closed_at, s.opened_at) DESC;
$$;