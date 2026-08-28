import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Search, PackageCheck, Undo2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";

export type EquipItem = {
  id: string;
  category: string;
  item_name: string;
  brand_name: string | null;
  status: "active" | "inactive";
  working_status: "working" | "not_working";
};

export function useChecklistData(serviceId: string | null) {
  const itemsQ = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items").select("*").order("category").order("item_name");
      if (error) throw error;
      return (data ?? []) as EquipItem[];
    },
  });
  const entriesQ = useQuery({
    queryKey: ["checklist-entries", serviceId],
    enabled: !!serviceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_entries")
        .select("item_id, checked, returned")
        .eq("service_id", serviceId!);
      if (error) throw error;
      return data ?? [];
    },
  });
  return { itemsQ, entriesQ };
}

/** Two-stage packing board: going to MPZ, then returning to SAFT Church. */
export function ChecklistBoard({
  serviceId,
  footer,
}: {
  serviceId: string;
  footer?: (state: { going: number; back: number; total: number; allBack: boolean }) => React.ReactNode;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const { itemsQ, entriesQ } = useChecklistData(serviceId);

  useRealtimeInvalidate({
    table: "checklist_entries",
    queryKeys: [["checklist-entries", serviceId]],
  });

  const entryMap = useMemo(() => {
    const m = new Map<string, { checked: boolean; returned: boolean }>();
    for (const e of (entriesQ.data ?? []) as any[]) {
      m.set(e.item_id, { checked: !!e.checked, returned: !!e.returned });
    }
    return m;
  }, [entriesQ.data]);

  const activeItems = useMemo(
    () => (itemsQ.data ?? []).filter((i) => i.status === "active"),
    [itemsQ.data],
  );

  const match = (i: EquipItem) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [i.item_name, i.brand_name, i.category].some((v) => (v ?? "").toLowerCase().includes(s));
  };

  const goingItems = activeItems.filter(match);
  const carried = activeItems.filter((i) => entryMap.get(i.id)?.checked);
  const returnItems = carried.filter(match);

  const going = carried.length;
  const back = carried.filter((i) => entryMap.get(i.id)?.returned).length;

  const save = async (item: EquipItem, patch: { checked?: boolean; returned?: boolean }) => {
    const cur = entryMap.get(item.id) ?? { checked: false, returned: false };
    const checked = patch.checked ?? cur.checked;
    const returned = patch.returned ?? (checked ? cur.returned : false);
    const { error } = await supabase.from("checklist_entries").upsert(
      {
        service_id: serviceId,
        item_id: item.id,
        checked,
        checked_by: checked ? user?.id ?? null : null,
        checked_at: checked ? new Date().toISOString() : null,
        returned,
        returned_by: returned ? user?.id ?? null : null,
        returned_at: returned ? new Date().toISOString() : null,
      } as any,
      { onConflict: "service_id,item_id" },
    );
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["checklist-entries", serviceId] });
  };

  const allBack = going > 0 && back === going;

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* GOING */}
        <Card className="shadow-card overflow-hidden">
          <CardHeader className="border-b bg-gradient-subtle">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-primary" /> Going · SAFT → MPZ
              </span>
              <Badge className="bg-primary/12 font-semibold text-primary hover:bg-primary/12">
                {going} / {activeItems.length} packed
              </Badge>
            </CardTitle>
            <Progress value={activeItems.length ? (going / activeItems.length) * 100 : 0} className="mt-2 h-2" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[26rem] divide-y overflow-y-auto">
              {goingItems.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  checked={!!entryMap.get(i.id)?.checked}
                  onToggle={(v) => save(i, { checked: v })}
                />
              ))}
              {goingItems.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">No active items match your search.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RETURN */}
        <Card className={cn("shadow-card overflow-hidden", allBack && "ring-1 ring-success/40")}>
          <CardHeader className="border-b bg-gradient-subtle">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-success" /> Return · MPZ → SAFT
              </span>
              <Badge
                className={cn(
                  "font-semibold",
                  allBack ? "bg-success/15 text-success hover:bg-success/15" : "bg-warning/15 text-warning hover:bg-warning/15",
                )}
              >
                {allBack && <CheckCircle2 className="mr-1 h-3 w-3" />}
                {back} / {going} returned
              </Badge>
            </CardTitle>
            <Progress value={going ? (back / going) * 100 : 0} className="mt-2 h-2" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[26rem] divide-y overflow-y-auto">
              {returnItems.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  checked={!!entryMap.get(i.id)?.returned}
                  tone="success"
                  onToggle={(v) => save(i, { returned: v })}
                />
              ))}
              {returnItems.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Tick items in the going list first — they appear here for the return check.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {footer?.({ going, back, total: activeItems.length, allBack })}
    </div>
  );
}

function ItemRow({
  item, checked, onToggle, tone = "primary",
}: {
  item: EquipItem;
  checked: boolean;
  onToggle: (v: boolean) => void;
  tone?: "primary" | "success";
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2.5 transition-smooth hover:bg-muted/60",
        checked && (tone === "success" ? "bg-success/5" : "bg-primary/5"),
      )}
    >
      <Checkbox checked={checked} onCheckedChange={(v) => onToggle(v === true)} className="h-5 w-5" />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate font-medium", checked && "text-muted-foreground line-through")}>
          {item.item_name}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{item.category}</span>
          {item.brand_name && <span>{item.brand_name}</span>}
          <span className={item.working_status === "working" ? "text-success" : "text-destructive"}>
            {item.working_status === "working" ? "Working" : "Not working"}
          </span>
        </div>
      </div>
    </label>
  );
}
