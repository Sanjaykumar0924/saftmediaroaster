import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Member-callable: confirm everything came back safely, or report an issue.
 * Notifies every admin / super admin.
 */
export const submitChecklistReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { service_id: string; kind: "safe" | "issue"; comment?: string }) => data)
  .handler(async ({ data, context }) => {
    if (data.kind === "issue" && !data.comment?.trim()) {
      throw new Error("Please describe the issue");
    }
    const userId = (context as any).userId;
    const client = (context as any).supabase;

    if (client) {
      const [{ data: svc }, { data: me }] = await Promise.all([
        client.from("mpc_services").select("name, service_date").eq("id", data.service_id).maybeSingle(),
        client.from("profiles").select("full_name, username").eq("id", userId).maybeSingle(),
      ]);

      const { error: repErr } = await client.from("checklist_reports").insert({
        service_id: data.service_id,
        reporter_id: userId,
        kind: data.kind,
        comment: data.comment?.trim() ?? null,
      });

      if (!repErr) {
        // Attempt notifications
        try {
          const { data: adminRoles } = await client.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
          const adminIds = Array.from(new Set((adminRoles ?? []).map((r: any) => r.user_id)));
          if (adminIds.length) {
            const who = me?.full_name ?? me?.username ?? "A member";
            const where = svc ? `${svc.name} · ${svc.service_date}` : "MPZ service";
            try {
              await client.from("notifications").insert(
                adminIds.map((id) => ({
                  user_id: id,
                  title: data.kind === "safe" ? "✅ All equipment returned safely" : "⚠️ Equipment issue reported",
                  body:
                    data.kind === "safe"
                      ? `${who} confirmed everything returned from ${where}`
                      : `${who} · ${where}: ${data.comment?.trim()}`,
                  kind: "checklist",
                })),
              );
            } catch {}
          }
        } catch {}
        return { ok: true };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: svc }, { data: me }, { data: admins }] = await Promise.all([
      supabaseAdmin.from("mpc_services").select("name, service_date").eq("id", data.service_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name, username").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
    ]);

    const { error } = await supabaseAdmin.from("checklist_reports").insert({
      service_id: data.service_id,
      reporter_id: userId,
      kind: data.kind,
      comment: data.comment?.trim() ?? null,
    });
    if (error) throw new Error(error.message);

    const who = me?.full_name ?? me?.username ?? "A member";
    const where = svc ? `${svc.name} · ${svc.service_date}` : "MPZ service";
    const adminIds = Array.from(new Set((admins ?? []).map((r: any) => r.user_id)));
    if (adminIds.length) {
      try {
        await supabaseAdmin.from("notifications").insert(
          adminIds.map((id) => ({
            user_id: id,
            title: data.kind === "safe" ? "✅ All equipment returned safely" : "⚠️ Equipment issue reported",
            body:
              data.kind === "safe"
                ? `${who} confirmed everything returned from ${where}`
                : `${who} · ${where}: ${data.comment?.trim()}`,
            kind: "checklist",
          })),
        );
      } catch {}
    }
    return { ok: true, notified: adminIds.length };
  });
