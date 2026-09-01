import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(context: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", (context as any).userId);
  if (error) throw new Error(error.message);
  const isAdmin = (data ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
  if (!isAdmin) throw new Error("Forbidden: Admin access required");
}

const DOMAIN = "saft.local";

export const adminCreateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    username: string; password: string; full_name?: string;
    phone?: string; role_title?: string; seniority?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const username = data.username.trim().toLowerCase();
    const email = `${username}@${DOMAIN}`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username, full_name: data.full_name ?? username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "createUser failed");
    // Extra profile fields + force password change on first login
    await supabaseAdmin.from("profiles").update({
      phone: data.phone ?? null,
      role_title: data.role_title ?? null,
      seniority: (data.seniority ?? null) as any,
      must_change_password: false,
    }).eq("id", created.user.id);
    return { id: created.user.id, username };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; new_password: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (!data.new_password || data.new_password.length < 6) throw new Error("Password must be at least 6 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: false }).eq("id", data.user_id);
    return { ok: true };
  });

export const adminUpdateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    user_id: string; full_name?: string; phone?: string | null;
    role_title?: string | null; is_active?: boolean; photo_url?: string | null;
    seniority?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.role_title !== undefined) patch.role_title = data.role_title;
    if (data.seniority !== undefined) patch.seniority = data.seniority;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.photo_url !== undefined) patch.photo_url = data.photo_url;
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; make_admin: boolean }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.make_admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert([{ user_id: data.user_id, role: "admin" as any }], { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", "admin" as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getMemberRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap: Record<string, string[]> = {};
    for (const r of roles ?? []) {
      (roleMap[r.user_id] ??= []).push(r.role);
    }
    return roleMap;
  });

export const adminSeedPreloaded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const NAMES = ["Kingston","Akash","Sam","Ezra","Vishal","David","Isaac","Sanjay","Sujith","Samuel","Edward","Lorenzo"];
    const { data: existing } = await supabaseAdmin.from("profiles").select("username");
    const set = new Set((existing ?? []).map((p: any) => p.username?.toLowerCase()));
    let created = 0;
    for (const name of NAMES) {
      const uname = name.toLowerCase();
      if (set.has(uname)) continue;
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: `${uname}@${DOMAIN}`,
        password: `${uname}1234`,
        email_confirm: true,
        user_metadata: { username: uname, full_name: name },
      });
      if (!error) created++;
    }
    return { created };
  });
/** Share a saved MPZ checklist with selected members/admins (also notifies them). */
export const shareChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { service_id: string; recipient_ids: string[] }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (!data.recipient_ids?.length) throw new Error("Pick at least one recipient");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: svc, error: svcErr } = await supabaseAdmin
      .from("mpc_services").select("name, service_date").eq("id", data.service_id).maybeSingle();
    if (svcErr) throw new Error(svcErr.message);
    if (!svc) throw new Error("Service not found");
    const { error } = await supabaseAdmin.from("checklist_shares").insert(
      data.recipient_ids.map((rid) => ({ service_id: data.service_id, recipient_id: rid, sent_by: (context as any).userId })),
    );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("notifications").insert(
      data.recipient_ids.map((rid) => ({
        user_id: rid,
        title: "MPZ checklist shared",
        body: `${svc.name} · ${svc.service_date}`,
        kind: "checklist",
      })),
    );
    return { sent: data.recipient_ids.length };
  });

/**
 * Danger zone: wipe all roster + checklist/MPZ test data before launch.
 * Callable by admin or super admin.
 */
export const adminWipeTestData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rosters: boolean; checklists: boolean; attendance?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { data: roles, error: rErr } = await (context as any).supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", (context as any).userId);
    if (rErr) throw new Error(rErr.message);
    const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!ok) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const all = "00000000-0000-0000-0000-000000000000";
    const counts = { rosters: 0, services: 0, attendance: 0 };

    if (data.rosters) {
      const { count } = await supabaseAdmin.from("roster").select("id", { count: "exact", head: true });
      counts.rosters = count ?? 0;
      const { error } = await supabaseAdmin.from("roster").delete().neq("id", all);
      if (error) throw new Error(error.message);
    }

    if (data.checklists) {
      const { count } = await supabaseAdmin.from("mpc_services").select("id", { count: "exact", head: true });
      counts.services = count ?? 0;
      for (const t of ["checklist_entries", "checklist_reports", "checklist_shares", "mpc_services"] as const) {
        const { error } = await supabaseAdmin.from(t).delete().neq("id", all);
        if (error) throw new Error(error.message);
      }
    }

    if (data.attendance) {
      const { count } = await supabaseAdmin.from("attendance").select("id", { count: "exact", head: true });
      counts.attendance = count ?? 0;
      const { error } = await supabaseAdmin.from("attendance").delete().neq("id", all);
      if (error) throw new Error(error.message);
    }

    return { ok: true, ...counts };
  });

