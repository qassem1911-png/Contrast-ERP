import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserBody {
  email: string;
  password: string;
  arabic_name: string;
  phone?: string;
  role: "super_admin" | "admin" | "storekeeper" | "technician";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: verify caller is a super_admin using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "غير مصرح" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "جلسة غير صالحة" }, 401);
    }

    const { data: isSuper, error: roleErr } = await callerClient.rpc("is_super_admin", {
      _user_id: userData.user.id,
    });
    if (roleErr || !isSuper) {
      return json({ error: "هذه العملية متاحة للسوبر أدمن فقط" }, 403);
    }

    const body = (await req.json()) as CreateUserBody;
    if (!body.email || !body.password || !body.arabic_name || !body.role) {
      return json({ error: "بيانات ناقصة" }, 400);
    }
    if (body.password.length < 6) {
      return json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, 400);
    }

    // Admin client (service role)
    const admin = createClient(supabaseUrl, serviceKey);

    // Create the auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email.trim(),
      password: body.password,
      email_confirm: true,
      user_metadata: {
        arabic_name: body.arabic_name.trim(),
        phone: body.phone?.trim() || null,
      },
    });

    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "فشل إنشاء المستخدم" }, 400);
    }

    const newUserId = created.user.id;

    // The trigger already inserted a default role (technician or super_admin for the special emails).
    // If the requested role differs, replace it.
    const { data: existingRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", newUserId);

    const hasRequested = existingRoles?.some((r: { role: string }) => r.role === body.role);
    if (!hasRequested) {
      // Wipe and set the requested role (single primary role per creation)
      await admin.from("user_roles").delete().eq("user_id", newUserId);
      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: newUserId, role: body.role });
      if (insErr) {
        return json({ error: `تم إنشاء المستخدم لكن فشل تعيين الدور: ${insErr.message}` }, 500);
      }
    }

    return json({ success: true, user_id: newUserId });
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
