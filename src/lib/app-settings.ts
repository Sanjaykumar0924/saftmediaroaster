import { supabase } from "@/integrations/supabase/client";
import { ADMIN_ACCESS_KEY } from "@/lib/saft";

export const ADMIN_KEY_SETTING = "admin_access_key";

/** Live admin access key (falls back to the built-in default). */
export async function getAdminAccessKey(): Promise<string> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ADMIN_KEY_SETTING)
    .maybeSingle();
  return (data?.value ?? ADMIN_ACCESS_KEY).trim();
}

export async function setAdminAccessKey(value: string) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: ADMIN_KEY_SETTING, value: value.trim() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
