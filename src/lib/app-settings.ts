import { supabase } from "@/integrations/supabase/client";

export const ADMIN_KEY_SETTING = "admin_access_key";

/**
 * Live admin access key. Readable only by admins/super admins (RLS enforced);
 * returns "" for everyone else. Never use this to validate a key client-side —
 * validation happens server-side in claimAdminRole.
 */
export async function getAdminAccessKey(): Promise<string> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ADMIN_KEY_SETTING)
    .maybeSingle();
  return (data?.value ?? "").trim();
}

export async function setAdminAccessKey(value: string) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: ADMIN_KEY_SETTING, value: value.trim() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
