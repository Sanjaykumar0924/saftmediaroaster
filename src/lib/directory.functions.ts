import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DirectoryMember = {
  id: string;
  username: string | null;
  full_name: string | null;
  role_title: string | null;
  seniority: string | null;
  photo_url: string | null;
  is_active: boolean | null;
};

/**
 * Returns safe (non-sensitive) profile fields for the requested user ids.
 * Uses service role on the server so members can look up teammates by name
 * without exposing phone numbers or other private fields directly via RLS.
 */
export const getMemberDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ids?: string[] } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<DirectoryMember[]> => {
    const client = (context as any)?.supabase;
    let found: DirectoryMember[] = [];
    if (client) {
      let q = client
        .from("profiles")
        .select("id, username, full_name, role_title, seniority, photo_url, is_active")
        .order("full_name");
      if (data?.ids && data.ids.length > 0) q = q.in("id", data.ids);
      const { data: rows, error } = await q;
      if (!error && rows) {
        found = rows as DirectoryMember[];
      }
    }

    // If all requested IDs were found, return them
    if (data?.ids && data.ids.length > 0 && found.length >= data.ids.length) {
      return found;
    }
    if (!data?.ids && found.length > 0) {
      return found;
    }

    // Fetch via supabaseAdmin service role to bypass RLS restrictions
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let q = supabaseAdmin
        .from("profiles")
        .select("id, username, full_name, role_title, seniority, photo_url, is_active")
        .order("full_name");
      if (data?.ids && data.ids.length > 0) q = q.in("id", data.ids);
      const { data: rows } = await q;
      if (rows && rows.length > 0) {
        return rows as DirectoryMember[];
      }
    } catch {}

    return found;
  });

