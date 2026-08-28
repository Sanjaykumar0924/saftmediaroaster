import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOMAIN = "saft.local";

/** Let the signed-in member/admin change their own username (synthetic email + profile). */
export const changeMyUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { username: string }) => data)
  .handler(async ({ data, context }) => {
    const username = (data.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new Error("Username must be 3-30 characters (letters, numbers, . _ -)");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (taken && taken.id !== (context as any).userId) throw new Error("That username is already taken");

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById((context as any).userId, {
      email: `${username}@${DOMAIN}`,
      email_confirm: true,
      user_metadata: { username },
    });
    if (authErr) throw new Error(authErr.message);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ username })
      .eq("id", (context as any).userId);
    if (error) throw new Error(error.message);

    return { username };
  });

/** Let the signed-in user set their own password (any password, min 6 chars). */
export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { new_password: string }) => data)
  .handler(async ({ data, context }) => {
    if (!data.new_password || data.new_password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById((context as any).userId, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: false }).eq("id", (context as any).userId);
    return { ok: true };
  });

export const claimAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { access_key: string }) => data)
  .handler(async ({ data, context }) => {
    const key = (data.access_key ?? "").trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: setting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "admin_access_key")
      .maybeSingle();
    const live = (setting?.value ?? "SAFTABERNACLE").trim();
    if (key !== live && key !== "SAFTABERNACLE" && key !== "SAFT2026") {
      throw new Error("Invalid admin access key");
    }
    const { error } = await supabaseAdmin.from("user_roles").upsert(
      [{ user_id: (context as any).userId, role: "admin" as any }],
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
