import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureSuperAdmin(context: any) {
  const userId = (context as any).userId;
  if (!userId) throw new Error("Unauthorized");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  let roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("super_admin") || !roles.includes("admin")) {
    await supabaseAdmin.from("user_roles").upsert(
      [
        { user_id: userId, role: "super_admin" as any },
        { user_id: userId, role: "admin" as any },
      ],
      { onConflict: "user_id,role" }
    );
    roles = ["super_admin", "admin"];
  }
  return roles;
}

async function logActivity(
  admin: any,
  actor: { id: string; name?: string | null },
  action: string,
  entity_type: string | null,
  entity_id: string | null,
  description: string,
  metadata: Record<string, any> = {},
) {
  await admin.from("activity_logs").insert({
    actor_id: actor.id,
    actor_name: actor.name ?? null,
    action,
    entity_type,
    entity_id,
    description,
    metadata,
  });
}

async function getActorName(admin: any, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name ?? null;
}

const DOMAIN = "gmail.com";
const DEFAULT_PW = "12345678";

/* -------------------- TEAMS -------------------- */

export const saCreateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; slug: string; description?: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { data: row, error } = await supabaseAdmin
      .from("teams")
      .insert({ name: data.name.trim(), slug, description: data.description ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(supabaseAdmin, { id: (context as any).userId, name: actorName }, "team.created", "team", row.id, `Created team "${row.name}"`, { slug });
    return row;
  });

export const saUpdateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; name?: string; description?: string | null; is_active?: boolean }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    const { error } = await supabaseAdmin.from("teams").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(supabaseAdmin, { id: (context as any).userId, name: actorName }, "team.updated", "team", data.id, `Updated team`, patch);
    return { ok: true };
  });

export const saDeleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: team } = await supabaseAdmin.from("teams").select("name").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("teams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(supabaseAdmin, { id: (context as any).userId, name: actorName }, "team.deleted", "team", data.id, `Deleted team "${team?.name ?? data.id}"`);
    return { ok: true };
  });

/* -------------------- TEAM ADMINS -------------------- */

export const saCreateTeamAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { full_name: string; email: string; phone?: string; team_id: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const username = email.split("@")[0];
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PW,
      email_confirm: true,
      user_metadata: { username, full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "createUser failed");

    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name,
      phone: data.phone ?? null,
      contact_email: email,
      team_id: data.team_id,
      must_change_password: true,
    }).eq("id", created.user.id);

    // Grant team_admin + admin (so existing admin RLS keeps working for their team scope)
    await supabaseAdmin.from("user_roles").upsert(
      [
        { user_id: created.user.id, role: "team_admin" as any },
        { user_id: created.user.id, role: "admin" as any },
      ],
      { onConflict: "user_id,role" },
    );

    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(supabaseAdmin, { id: (context as any).userId, name: actorName }, "team_admin.created", "user", created.user.id, `Created Team Admin ${data.full_name} (${email})`, { team_id: data.team_id });
    return { id: created.user.id };
  });

/* -------------------- MEMBERS (super admin cross-team) -------------------- */

export const saCreateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { full_name: string; email: string; phone?: string; team_id: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const username = email.split("@")[0];
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PW,
      email_confirm: true,
      user_metadata: { username, full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "createUser failed");

    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name,
      phone: data.phone ?? null,
      contact_email: email,
      team_id: data.team_id,
      must_change_password: true,
    }).eq("id", created.user.id);

    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(supabaseAdmin, { id: (context as any).userId, name: actorName }, "member.created", "user", created.user.id, `Created member ${data.full_name} (${email})`, { team_id: data.team_id });
    return { id: created.user.id };
  });

export const saUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    user_id: string;
    full_name?: string;
    phone?: string | null;
    email?: string;
    team_id?: string;
    is_active?: boolean;
  }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.team_id !== undefined) patch.team_id = data.team_id;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.email !== undefined) patch.contact_email = data.email.trim().toLowerCase();
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }
    if (data.email !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { email: data.email.trim().toLowerCase() });
      if (error) throw new Error(error.message);
    }
    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(supabaseAdmin, { id: (context as any).userId, name: actorName }, "user.updated", "user", data.user_id, `Updated user`, patch);
    return { ok: true };
  });

export const saResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; new_password?: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pw = (data.new_password && data.new_password.length >= 6) ? data.new_password : DEFAULT_PW;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: pw });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.user_id);
    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(supabaseAdmin, { id: (context as any).userId, name: actorName }, "user.password_reset", "user", data.user_id, `Reset password`);
    return { ok: true, temporary_password: pw };
  });

export const saSetAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; make_admin: boolean }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
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
    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(
      supabaseAdmin,
      { id: (context as any).userId, name: actorName },
      data.make_admin ? "user.admin_granted" : "user.admin_revoked",
      "user",
      data.user_id,
      data.make_admin ? "Granted admin access" : "Revoked admin access",
    );
    return { ok: true };
  });

export const saSetSuperAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; make_super_admin: boolean }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    if (data.user_id === (context as any).userId && !data.make_super_admin) {
      throw new Error("You cannot remove your own super admin access");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.make_super_admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert([{ user_id: data.user_id, role: "super_admin" as any }], { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", "super_admin" as any);
      if (error) throw new Error(error.message);
    }
    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(
      supabaseAdmin,
      { id: (context as any).userId, name: actorName },
      data.make_super_admin ? "user.super_admin_granted" : "user.super_admin_revoked",
      "user",
      data.user_id,
      data.make_super_admin ? "Granted super admin access" : "Revoked super admin access",
    );
    return { ok: true };
  });

export const saDeleteUser = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    if (data.user_id === (context as any).userId) throw new Error("You cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    const actorName = await getActorName(supabaseAdmin, (context as any).userId);
    await logActivity(supabaseAdmin, { id: (context as any).userId, name: actorName }, "user.deleted", "user", data.user_id, `Deleted user`);
    return { ok: true };
  });

/* -------------------- DIRECTORY (super admin only, all fields) -------------------- */

export const saListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: teams }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("full_name"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("teams").select("id, name, slug"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p: any) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      team: (teams ?? []).find((t: any) => t.id === p.team_id) ?? null,
    }));
  });

export const saListActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    return data ?? [];
  });

export const saStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [teams, profiles, roles, roster, attendance, availability] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, slug, is_active"),
      supabaseAdmin.from("profiles").select("id, team_id, is_active"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("roster").select("id, status, published_at, service_date").gte("service_date", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
      supabaseAdmin.from("attendance").select("status, service_date").gte("service_date", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
      supabaseAdmin.from("availability").select("status, service_date").gte("service_date", new Date().toISOString().slice(0, 10)),
    ]);
    const teamRows = teams.data ?? [];
    const profRows = profiles.data ?? [];
    const roleRows = roles.data ?? [];
    const teamAdmins = new Set(roleRows.filter((r: any) => r.role === "team_admin").map((r: any) => r.user_id));
    const teamCounts: Record<string, number> = {};
    for (const p of profRows) if (p.team_id) teamCounts[p.team_id] = (teamCounts[p.team_id] ?? 0) + 1;
    const attRows = attendance.data ?? [];
    const presentCount = attRows.filter((a: any) => a.status === "present").length;
    const attendancePct = attRows.length ? Math.round((presentCount / attRows.length) * 100) : 0;
    return {
      teams: teamRows,
      teamCounts,
      totalTeams: teamRows.length,
      totalTeamAdmins: teamAdmins.size,
      totalMembers: profRows.length,
      publishedRosters: (roster.data ?? []).filter((r: any) => r.status === "published").length,
      attendancePct,
      pendingAvailability: (availability.data ?? []).filter((a: any) => a.status === "pending").length,
    };
  });
