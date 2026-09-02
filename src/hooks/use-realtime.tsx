import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Table =
  | "roster"
  | "attendance"
  | "availability"
  | "notifications"
  | "announcements"
  | "profiles"
  | "checklist_entries"
  | "checklist_shares"
  | "checklist_reports"
  | "messages";


interface Options {
  table: Table;
  filter?: string;
  queryKeys: (string | (string | undefined)[])[];
  onChange?: (payload: any) => void;
  channelKey?: string;
}

/**
 * Subscribe to postgres_changes on a table and invalidate React Query keys
 * whenever a change arrives. Uses Supabase Realtime (WebSocket).
 */
export function useRealtimeInvalidate({ table, filter, queryKeys, onChange, channelKey }: Options) {
  const qc = useQueryClient();
  useEffect(() => {
    const key = channelKey ?? `${table}:${filter ?? "all"}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(key)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        (payload: any) => {
          for (const k of queryKeys) {
            qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] });
          }
          onChange?.(payload);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}
