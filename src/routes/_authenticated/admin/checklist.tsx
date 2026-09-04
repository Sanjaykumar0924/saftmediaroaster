import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ListChecks, Send, CalendarPlus, AlertTriangle, CheckCircle2, Trash2, Search, Check, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatServiceDate, secondSaturday, seniorityClass, seniorityLabel, toDateOnly } from "@/lib/saft";
import { getMemberDirectory } from "@/lib/directory.functions";
import { shareChecklist, ensureCurrentAdmin } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/admin/checklist")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "admin" } as any });
    try {
      await ensureCurrentAdmin();
    } catch {
      // ignore
    }
  },
  component: AdminChecklistPage,
  head: () => ({
    meta: [
      { title: "MPZ Checklist — SAFT Media Team" },
      { name: "description", content: "Pack and return equipment between SAFT Church and MPZ." },
    ],
  }),
});

function AdminChecklistPage() {
  const qc = useQueryClient();
  const dirFn = useServerFn(getMemberDirectory);
  const [serviceId, setServiceId] = useState<string | null>(null);

  const servicesQ = useQuery({
    queryKey: ["mpz-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mpc_services").select("*").order("service_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const services = servicesQ.data ?? [];
  const todayStr = toDateOnly(new Date());
  const upcoming = useMemo(() => services.filter((s: any) => s.service_date >= todayStr), [services, todayStr]);
  const finished = useMemo(
    () => services.filter((s: any) => s.service_date < todayStr).slice().reverse(),
    [services, todayStr],
  );
  const active = serviceId ?? upcoming[0]?.id ?? finished[0]?.id ?? null;
  const activeService = services.find((s: any) => s.id === active);

  const dirQ = useQuery({
    queryKey: ["checklist-directory"],
    queryFn: async () => {
      // Try member_directory view first – accessible to all authenticated users
      const { data: dirData, error: dirError } = await supabase
        .from("member_directory")
        .select("id, username, full_name, role_title, seniority, photo_url, is_active")
        .order("full_name");
      if (!dirError && dirData && dirData.length > 0) return dirData;

      // Fallback to profiles (admin access)
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, role_title, seniority, photo_url, is_active")
        .order("full_name");
      if (!error && data && data.length > 0) return data;
      try {
        return await dirFn({ data: {} });
      } catch {
        return data ?? [];
      }
    },
  });
  const people = useMemo(
    () => new Map((dirQ.data ?? []).map((p: any) => [p.id, p])),
    [dirQ.data],
  );

  // Report counts per service so admins see which service a report came from.
  const countsQ = useQuery({
    queryKey: ["checklist-report-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("checklist_reports").select("service_id, kind");
      if (error) throw error;
      const m: Record<string, { total: number; issues: number }> = {};
      for (const r of data ?? []) {
        const e = (m[(r as any).service_id] ??= { total: 0, issues: 0 });
        e.total += 1;
        if ((r as any).kind === "issue") e.issues += 1;
      }
      return m;
    },
  });
  const counts = countsQ.data ?? {};

  useRealtimeInvalidate({
    table: "checklist_reports",
    queryKeys: [["checklist-report-counts"], ["checklist-reports", active ?? undefined]],
  });

  const reportsQ = useQuery({
    queryKey: ["checklist-reports", active],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_reports").select("*").eq("service_id", active!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteService = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Its checklist ticks and member reports will be removed too.`)) return;
    await supabase.from("checklist_entries").delete().eq("service_id", id);
    await supabase.from("checklist_reports").delete().eq("service_id", id);
    await supabase.from("checklist_shares").delete().eq("service_id", id);
    const { error } = await supabase.from("mpc_services").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Service deleted");
    if (active === id) setServiceId(null);
    qc.invalidateQueries({ queryKey: ["mpz-services"] });
    qc.invalidateQueries({ queryKey: ["checklist-report-counts"] });
  };

  const deleteReport = async (id: string) => {
    const { error } = await supabase.from("checklist_reports").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Report deleted");
    qc.invalidateQueries({ queryKey: ["checklist-reports", active] });
    qc.invalidateQueries({ queryKey: ["checklist-report-counts"] });
  };


  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <ListChecks className="h-6 w-6 text-primary" /> MPZ Checklist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tick what you carry to MPZ, then tick it back in when it returns to SAFT Church.
          </p>
        </div>
        <AddServiceDialog onCreated={(id) => { setServiceId(id); qc.invalidateQueries({ queryKey: ["mpz-services"] }); }} />
      </div>

      <Card className="shadow-card">
        <CardHeader className="border-b bg-gradient-subtle">
          <CardTitle className="text-base">Service days (monthly 2nd Saturday at MPZ)</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Tabs defaultValue="upcoming">
            <TabsList className="grid w-full grid-cols-2 sm:w-72">
              <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="finished">Finished ({finished.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4">
              <ServicePicker list={upcoming} active={active} onPick={setServiceId} counts={counts} onDelete={deleteService} emptyMsg="No upcoming services — add one to start a checklist." />
            </TabsContent>
            <TabsContent value="finished" className="mt-4">
              <ServicePicker list={finished} active={active} onPick={setServiceId} counts={counts} onDelete={deleteService} emptyMsg="No finished services yet." />
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>

      {active && (
        <>
          <div className="flex justify-end">
            <ShareDialog serviceId={active} serviceLabel={activeService?.name ?? ""} />
          </div>
          <ChecklistBoard serviceId={active} />

          <Card className="shadow-card">
            <CardHeader className="border-b bg-gradient-subtle">
              <CardTitle className="text-base">Member reports</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {(reportsQ.data ?? []).map((r: any) => {
                const p: any = people.get(r.reporter_id);
                const name = p?.full_name ?? p?.username ?? "Member";
                const level = seniorityLabel(p?.seniority);
                return (
                  <div key={r.id} className="flex items-start gap-3 p-4">
                    {r.kind === "safe"
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{name}</span>
                        {level && (
                          <Badge className={cn("text-[10px] font-semibold", seniorityClass(p?.seniority))}>
                            {level}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm font-medium">
                        {r.kind === "safe" ? "All equipment returned safely" : "Issue reported"}
                      </div>
                      {r.comment && <div className="text-sm text-muted-foreground">{r.comment}</div>}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete report"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => deleteReport(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              {(reportsQ.data ?? []).length === 0 && (
                <p className="p-6 text-sm text-muted-foreground">No reports for this service yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AddServiceDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const nextSat = useMemo(() => {
    const now = new Date();
    let d = secondSaturday(now.getFullYear(), now.getMonth());
    if (d < now) d = secondSaturday(now.getFullYear(), now.getMonth() + 1);
    return d;
  }, []);
  const [date, setDate] = useState(toDateOnly(nextSat));
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from("mpc_services")
      .insert({
        name: name.trim() || `MPZ Service · ${formatServiceDate(date)}`,
        service_date: date,
        created_by: user?.id ?? null,
      } as any)
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Service added");
    setOpen(false);
    setName("");
    if (data?.id) onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          <CalendarPlus className="mr-2 h-4 w-4" /> New service
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New MPZ service</DialogTitle>
          <DialogDescription>Defaults to the next monthly 2nd Saturday.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Date · {formatServiceDate(date)}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div><Label>Service name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MPZ Service" /></div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="min-h-11 bg-gradient-primary">
              {saving ? "Adding…" : "Add service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ serviceId, serviceLabel }: { serviceId: string; serviceLabel: string }) {
  const qc = useQueryClient();
  const dirFn = useServerFn(getMemberDirectory);
  const shareFn = useServerFn(shareChecklist);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [sending, setSending] = useState(false);

  const peopleQ = useQuery({
    queryKey: ["share-directory"],
    enabled: open,
    queryFn: async () => {
      // Try member_directory view first – accessible to all authenticated users
      const { data: dirData, error: dirError } = await supabase
        .from("member_directory")
        .select("id, username, full_name, role_title, seniority, photo_url, is_active")
        .order("full_name");
      if (!dirError && dirData && dirData.length > 0) return dirData;

      // Fallback: query profiles directly (works for admins via RLS)
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, role_title, seniority, photo_url, is_active")
        .order("full_name");
      if (!error && data && data.length > 0) return data;

      // Last resort: server function
      try {
        const res = await dirFn({ data: {} });
        if (res && res.length > 0) return res;
      } catch {
        // ignore
      }
      return data ?? [];
    },
  });

  const sharesQ = useQuery({
    queryKey: ["checklist-shares", serviceId],
    enabled: open && !!serviceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_shares")
        .select("recipient_id")
        .eq("service_id", serviceId);
      if (error) return [];
      return (data ?? []).map((s: any) => s.recipient_id as string);
    },
  });

  const alreadySharedSet = useMemo(() => new Set(sharesQ.data ?? []), [sharesQ.data]);
  const people = (peopleQ.data ?? []) as any[];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return people.filter((p: any) => {
      if (filterActiveOnly && p.is_active === false) return false;
      if (!s) return true;
      return (
        (p.full_name ?? "").toLowerCase().includes(s) ||
        (p.username ?? "").toLowerCase().includes(s) ||
        (p.role_title ?? "").toLowerCase().includes(s)
      );
    });
  }, [people, search, filterActiveOnly]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectAll = () => {
    const allFilteredIds = filtered.map((p) => p.id);
    const unsharedFilteredIds = allFilteredIds.filter((id) => !alreadySharedSet.has(id));

    // If all are selected, deselect
    if (selected.length === allFilteredIds.length && allFilteredIds.length > 0) {
      setSelected([]);
      return;
    }

    // If unshared members exist and not all are selected, select all unshared
    if (unsharedFilteredIds.length > 0 && selected.length < unsharedFilteredIds.length) {
      setSelected(unsharedFilteredIds);
    } else {
      // Otherwise select all filtered
      setSelected(allFilteredIds);
    }
  };

  const send = async () => {
    if (selected.length === 0) return;
    setSending(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id ?? null;

      // Filter out recipients already recorded in checklist_shares to prevent duplicates
      const newRecipientIds = selected.filter((id) => !alreadySharedSet.has(id));

      if (newRecipientIds.length === 0) {
        toast.info("Selected member(s) already have this checklist shared.");
        setOpen(false);
        return;
      }

      // 1. Direct client insert into checklist_shares
      const shareRecords = newRecipientIds.map((rid) => ({
        service_id: serviceId,
        recipient_id: rid,
        sent_by: currentUserId,
      }));

      const { error: shareError } = await supabase.from("checklist_shares").insert(shareRecords);

      if (shareError) {
        // Fallback to server function if client insert encounters RLS
        await shareFn({ data: { service_id: serviceId, recipient_ids: newRecipientIds } });
      } else {
        // Direct notification insert
        const notifs = newRecipientIds.map((rid) => ({
          user_id: rid,
          title: "MPZ checklist shared",
          body: `${serviceLabel || "MPZ Service"}`,
          kind: "checklist",
        }));
        try {
          await supabase.from("notifications").insert(notifs);
        } catch {
          // non-blocking
        }
      }

      toast.success(`Checklist shared with ${newRecipientIds.length} member(s)`);
      qc.invalidateQueries({ queryKey: ["checklist-shares", serviceId] });
      qc.invalidateQueries({ queryKey: ["share-directory"] });
      qc.invalidateQueries({ queryKey: ["my-checklists"] });
      setOpen(false);
      setSelected([]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to share checklist");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelected([]); setSearch(""); } }}>
      <DialogTrigger asChild>
        <Button className="min-h-11 bg-gradient-primary shadow-elegant">
          <Send className="mr-2 h-4 w-4" /> Send to
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Share checklist
          </DialogTitle>
          <DialogDescription>
            {serviceLabel ? `${serviceLabel} — ` : ""}Select members to grant checklist access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members by name, username, or role…"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{selected.length} selected</span>
              {alreadySharedSet.size > 0 && (
                <span>• {alreadySharedSet.size} already shared</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setFilterActiveOnly(!filterActiveOnly)}
              >
                {filterActiveOnly ? "Showing active only" : "Showing all"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={selectAll}
                disabled={filtered.length === 0}
              >
                {selected.length === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
              </Button>
            </div>
          </div>

          <ScrollArea className="h-80 rounded-xl border">
            <div className="divide-y">
              {filtered.map((p: any) => {
                const isSelected = selected.includes(p.id);
                const isAlreadyShared = alreadySharedSet.has(p.id);
                const name = p.full_name || p.username || "Team member";
                const initials = (name.replace(/[^a-zA-Z]/g, "").slice(0, 2) || "TM").toUpperCase();
                const level = seniorityLabel(p.seniority);

                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60",
                      isSelected && "bg-primary/5",
                      isAlreadyShared && "bg-muted/20"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <Avatar className="h-9 w-9 shrink-0">
                      {p.photo_url ? (
                        <AvatarImage src={p.photo_url} alt={name} />
                      ) : null}
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{name}</span>
                        {level && (
                          <Badge className={cn("text-[9px] px-1.5 py-0 font-medium", seniorityClass(p.seniority))}>
                            {level}
                          </Badge>
                        )}
                        {p.is_active === false && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>@{p.username}</span>
                        {p.role_title && <span>• {p.role_title}</span>}
                      </div>
                    </div>
                    {isAlreadyShared && (
                      <Badge variant="outline" className="shrink-0 border-success/30 bg-success/10 text-[10px] text-success font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Shared
                      </Badge>
                    )}
                  </label>
                );
              })}

              {peopleQ.isLoading && (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                  Loading members…
                </div>
              )}

              {!peopleQ.isLoading && filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {search ? `No members found matching "${search}"` : "No members found in this project."}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selected.length === 0 ? "Pick recipients above" : `${selected.length} recipient(s) ready`}
          </span>
          <Button
            onClick={send}
            disabled={sending || selected.length === 0}
            className="min-h-11 bg-gradient-primary shadow-elegant"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sharing…" : `Share checklist (${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ServicePicker({
  list, active, onPick, emptyMsg, counts, onDelete,
}: {
  list: any[]; active: string | null; onPick: (id: string) => void; emptyMsg: string;
  counts?: Record<string, { total: number; issues: number }>;
  onDelete?: (id: string, name: string) => void;
}) {
  if (list.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMsg}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((s: any) => {
        const c = counts?.[s.id];
        return (
          <div key={s.id} className="relative">
          <button
            onClick={() => onPick(s.id)}
            className={cn(
              "min-h-11 w-full rounded-xl border py-2 pl-3 pr-10 text-left text-sm transition-smooth",
              s.id === active
                ? "border-primary bg-primary/10 font-semibold text-primary shadow-elegant"
                : "border-border hover:bg-muted",
              c?.issues ? "border-destructive/50" : "",
            )}
          >
            {c && c.total > 0 && (
              <span
                title={c.issues ? `${c.issues} issue report(s)` : `${c.total} report(s)`}
                className={cn(
                  "absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold leading-none text-white shadow",
                  c.issues ? "bg-destructive" : "bg-success",
                )}
              >
                {c.total > 9 ? "9+" : c.total}
              </span>
            )}
            <div className="font-semibold">{formatServiceDate(s.service_date)}</div>
            <div className="text-xs text-muted-foreground">{s.name}{s.location ? ` · ${s.location}` : ""}</div>
          </button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${s.name}`}
              className="absolute bottom-1 right-1 h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(s.id, s.name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          </div>
        );
      })}
    </div>
  );
}

