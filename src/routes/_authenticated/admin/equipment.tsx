import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Boxes, Plus, Search, Trash2, Pencil, Camera, Aperture, Mic2, Cable, Lightbulb,
  Radio, BatteryCharging, Package, Wrench, AlertTriangle, CheckCircle2,
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
    const byCat = new Map<string, { total: number; active: number; working: number }>();
    for (const i of items) {
      const s = byCat.get(i.category) ?? { total: 0, active: 0, working: 0 };
      s.total++;
      if (i.status === "active") s.active++;
      if (i.working_status === "working") s.working++;
      byCat.set(i.category, s);
    }
    return {
      byCat: Array.from(byCat.entries()).sort((a, b) => b[1].total - a[1].total),
      total: items.length,
      active: items.filter((i) => i.status === "active").length,
      broken: items.filter((i) => i.working_status !== "working").length,
    };
  }, [items]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      if (!s) return true;
      return [i.item_name, i.brand_name, i.category].some((v) => (v ?? "").toLowerCase().includes(s));
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

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Equipment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every asset owned by the SAFT Media Team, grouped by category.
          </p>
        </div>
        <Button className="min-h-11 bg-gradient-primary shadow-elegant" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* headline stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total items" value={stats.total} icon={Boxes} tone="primary" />
        <StatCard label="Active & ready" value={stats.active} icon={CheckCircle2} tone="success" />
        <StatCard label="Needs repair" value={stats.broken} icon={AlertTriangle} tone="destructive" />
      </div>

      {/* category dashboard */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">By category</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.byCat.map(([cat, s]) => {
            const Icon = CATEGORY_ICON[cat] ?? Boxes;
            const pct = s.total ? (s.working / s.total) * 100 : 0;
            const selected = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(selected ? "all" : cat)}
                className={cn(
                  "group rounded-2xl border bg-card p-4 text-left shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant",
                  selected ? "border-primary ring-1 ring-primary/40" : "border-border",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold leading-none">{s.total}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">items</div>
                  </div>
                </div>
                <div className="mt-3 font-semibold">{cat}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-success">{s.working} working</span>
                  {s.total - s.working > 0 && <span className="text-destructive">{s.total - s.working} faulty</span>}
                  <span>· {s.active} active</span>
                </div>
                <Progress value={pct} className="mt-3 h-1.5" />
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
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Array.from(new Set([...ITEM_CATEGORIES, ...items.map((i) => i.category)])).sort()
                  .map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}

              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="pl-9 sm:w-60" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Item name</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-44">Working status</TableHead>
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
                    <TableCell className="text-muted-foreground">{i.brand_name ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={i.status} onValueChange={(v) => patch(i, { status: v as Item["status"] })}>
                        <SelectTrigger className={cn("h-9", i.status === "active" ? "text-success" : "text-muted-foreground")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={i.working_status} onValueChange={(v) => patch(i, { working_status: v as Item["working_status"] })}>
                        <SelectTrigger className={cn("h-9", i.working_status === "working" ? "text-success" : "text-destructive")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="working">Working</SelectItem>
                          <SelectItem value="not_working">Not working</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
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
        categories={Array.from(new Set([...ITEM_CATEGORIES, ...items.map((i) => i.category)])).sort()}

        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditing(null); } }}
        onSaved={refresh}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const toneCls =
    tone === "success" ? "bg-success/10 text-success"
      : tone === "destructive" ? "bg-destructive/10 text-destructive"
      : "bg-primary/10 text-primary";
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("grid h-12 w-12 place-items-center rounded-xl", toneCls)}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
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
  const [brand, setBrand] = useState(item?.brand_name ?? "");
  const [status, setStatus] = useState<Item["status"]>(item?.status ?? "active");
  const [working, setWorking] = useState<Item["working_status"]>(item?.working_status ?? "working");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = isOther ? customCategory.trim() : category;
    if (!finalCategory) { toast.error("Type the new category name"); return; }
    if (!itemName.trim()) { toast.error("Item name is required"); return; }
    setSaving(true);
    const payload = {
      category: finalCategory, item_name: itemName.trim(), brand_name: brand.trim() || null,
      status, working_status: working,
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
          <div className="grid gap-3 sm:grid-cols-2">
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <div><Label>Item name</Label><Input value={itemName} onChange={(e) => setItemName(e.target.value)} required /></div>
          </div>
          <div><Label>Brand name</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Sony" /></div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Item["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Working status</Label>
              <Select value={working} onValueChange={(v) => setWorking(v as Item["working_status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="working">Working</SelectItem>
                  <SelectItem value="not_working">Not working</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="min-h-11 bg-gradient-primary">
              {saving ? "Saving…" : item ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
