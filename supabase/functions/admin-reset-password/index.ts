import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResetBody {
  user_id: string;
  new_password: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "غير مصرح" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "جلسة غير صالحة" }, 401);

    const { data: isSuper } = await callerClient.rpc("is_super_admin", {
      _user_id: userData.user.id,
    });
    if (!isSuper) return json({ error: "هذه العملية متاحة للسوبر أدمن فقط" }, 403);

    const body = (await req.json()) as ResetBody;
    if (!body.user_id || !body.new_password) return json({ error: "بيانات ناقصة" }, 400);
    if (body.new_password.length < 6) return json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: updErr } = await admin.auth.admin.updateUserById(body.user_id, {
      password: body.new_password,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    // Audit log
    await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      user_role: "super_admin",
      action_type: "password_reset",
      table_name: "auth.users",
      record_id: body.user_id,
    });

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
