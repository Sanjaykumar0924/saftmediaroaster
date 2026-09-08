import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Boxes, Plus, Search, Trash2, Pencil, Camera, Aperture, Mic2, Cable, Lightbulb,
  Radio, BatteryCharging, Package, Wrench, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ITEM_CATEGORIES } from "@/lib/saft";
import { useAuth } from "@/lib/auth";
import type { EquipItem as Item } from "@/components/ChecklistBoard";

import { ensureCurrentAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/equipment")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "admin" } as any });
    try {
      await ensureCurrentAdmin();
    } catch {
      // ignore
    }
  },
  component: EquipmentPage,
});

const CATEGORY_ICON: Record<string, any> = {
  Camera, Lens: Aperture, Tripod: Wrench, Audio: Mic2, Cables: Cable,
  Lighting: Lightbulb, Streaming: Radio, Power: BatteryCharging, Accessories: Package, Other: Boxes,
};

function EquipmentPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const itemsQ = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items").select("*").order("category").order("item_name");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const items = itemsQ.data ?? [];

  const stats = useMemo(() => {
    const byCat = new Map<string, { total: number; nos: number }>();
    for (const i of items) {
      const s = byCat.get(i.category) ?? { total: 0, nos: 0 };
      s.total++;
      s.nos += i.nos ?? 1;
      byCat.set(i.category, s);
    }
    return {
      byCat: Array.from(byCat.entries()).sort((a, b) => b[1].total - a[1].total),
      total: items.length,
      nos: items.reduce((a, i) => a + (i.nos ?? 1), 0),
      cats: byCat.size,
    };
  }, [items]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      if (!s) return true;
      return [i.item_name, i.category].some((v) => (v ?? "").toLowerCase().includes(s));
    });
  }, [items, search, categoryFilter]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["inventory-items"] });
    qc.invalidateQueries({ queryKey: ["checklist-entries"] });
  };

  const remove = async (item: Item) => {
    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item deleted");
    refresh();
  };

  const patch = async (item: Item, p: Partial<Item>) => {
    const { error } = await supabase.from("inventory_items").update(p as any).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const categories = Array.from(new Set([...ITEM_CATEGORIES, ...items.map((i) => i.category)])).sort();

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Equipment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every asset owned by the SAFT Media Team, grouped by category.
          </p>
        </div>
        <Button className="min-h-11 w-full bg-gradient-primary shadow-elegant sm:w-auto" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* headline stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Items" value={stats.total} icon={Boxes} tone="primary" />
        <StatCard label="Total nos" value={stats.nos} icon={Layers} tone="success" />
        <StatCard label="Categories" value={stats.cats} icon={Package} tone="primary" className="col-span-2 sm:col-span-1" />
      </div>

      {/* category dashboard */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">By category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.byCat.map(([cat, s]) => {
            const Icon = CATEGORY_ICON[cat] ?? Boxes;
            const selected = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(selected ? "all" : cat)}
                className={cn(
                  "group rounded-2xl border bg-card p-3 text-left shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant sm:p-4",
                  selected ? "border-primary ring-1 ring-primary/40" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold leading-none sm:text-2xl">{s.total}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">items</div>
                  </div>
                </div>
                <div className="mt-3 truncate text-sm font-semibold sm:text-base">{cat}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.nos} nos total</div>
              </button>
            );
          })}
          {stats.byCat.length === 0 && (
            <p className="text-sm text-muted-foreground">No equipment yet — add your first item.</p>
          )}
        </div>
      </div>

      {/* database table */}
      <Card className="shadow-card overflow-hidden">
        <CardHeader className="gap-3 border-b bg-gradient-subtle sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
            <Boxes className="h-5 w-5 text-primary" /> Equipment Database ({rows.length})
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="min-h-11 w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="min-h-11 w-full pl-9 sm:w-60" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Item name</TableHead>
                  <TableHead className="w-24">Nos</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Badge className="bg-primary/12 font-semibold text-primary hover:bg-primary/12">{i.category}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{i.item_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        className="h-9 w-20"
                        value={i.nos ?? 1}
                        onChange={(e) => {
                          const n = Math.max(1, Number(e.target.value) || 1);
                          patch(i, { nos: n });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Edit item" onClick={() => setEditing(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" aria-label="Delete item"
                          className="text-destructive hover:text-destructive" onClick={() => remove(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No equipment matches — click “Add Item” to build the database.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ItemDialog
        key={editing?.id ?? "new"}
        open={addOpen || !!editing}
        item={editing}
        userId={user?.id ?? null}
        categories={categories}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditing(null); } }}
        onSaved={refresh}
      />
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone, className,
}: { label: string; value: number; icon: any; tone: string; className?: string }) {
  const toneCls =
    tone === "success" ? "bg-success/10 text-success"
      : tone === "destructive" ? "bg-destructive/10 text-destructive"
      : "bg-primary/10 text-primary";
  return (
    <Card className={cn("shadow-card", className)}>
      <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl sm:h-12 sm:w-12", toneCls)}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold leading-none sm:text-2xl">{value}</div>
          <div className="mt-1 truncate text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const OTHER = "__other__";

function ItemDialog({
  open, onOpenChange, item, onSaved, userId, categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: Item | null;
  onSaved: () => void;
  userId: string | null;
  categories: string[];
}) {
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? ITEM_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [isOther, setIsOther] = useState(false);
  const [itemName, setItemName] = useState(item?.item_name ?? "");
  const [nos, setNos] = useState<number>(item?.nos ?? 1);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = isOther ? customCategory.trim() : category;
    if (!finalCategory) { toast.error("Type the new category name"); return; }
    if (!itemName.trim()) { toast.error("Item name is required"); return; }
    setSaving(true);
    const payload = {
      category: finalCategory,
      item_name: itemName.trim(),
      nos: Math.max(1, Number(nos) || 1),
    };
    const { error } = item
      ? await supabase.from("inventory_items").update(payload as any).eq("id", item.id)
      : await supabase.from("inventory_items").insert({ ...payload, created_by: userId } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(item ? "Item updated" : "Item added");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>Equipment carried from SAFT Church to MPZ.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={isOther ? OTHER : category}
              onValueChange={(v) => {
                if (v === OTHER) { setIsOther(true); return; }
                setIsOther(false);
                setCategory(v);
              }}
            >
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                <SelectItem value={OTHER}>Other… (new category)</SelectItem>
              </SelectContent>
            </Select>
            {isOther && (
              <Input
                autoFocus
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Type the new category name"
              />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr,7rem]">
            <div className="space-y-2">
              <Label>Item name</Label>
              <Input className="min-h-11" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Nos</Label>
              <Input
                className="min-h-11"
                type="number"
                min={1}
                value={nos}
                onChange={(e) => setNos(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="min-h-11 w-full bg-gradient-primary sm:w-auto">
              {saving ? "Saving…" : item ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
