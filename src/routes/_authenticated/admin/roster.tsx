import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CAMERA_OPTIONS, FRAME_OPTIONS, ROLE_OPTIONS, ROSTER_ROLES, SERVICES,
  formatServiceDate, nextServiceDate, serviceLabel, toDateOnly,
} from "@/lib/saft";
import type { ServiceType } from "@/lib/saft";
import { Sparkles, Save, Printer, Send, FileEdit, CheckCircle2, Plus, Trash2, Pencil, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";

import { ensureCurrentAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/roster")({
  beforeLoad: async () => {
    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user ?? (await supabase.auth.getUser()).data.user;
    if (!user) throw redirect({ to: "/auth", search: { mode: "admin" } as any });
    try {
      await ensureCurrentAdmin();
    } catch {
      // ignore
    }
  },
  component: BuildRosterPage,
});

type SlotRow = {
  key: string;
  role: string;
  camera: string | null;
  notes: string | null;
  assigned: string | null;
  editing?: boolean;
};

const OTHER = "__other__";
const newKey = () => Math.random().toString(36).slice(2, 10);

const defaultRows = (): SlotRow[] =>
  ROSTER_ROLES.map((r) => ({
    key: newKey(),
    role: r.role,
    camera: r.camera ?? null,
    notes: r.defaultNotes ?? null,
    assigned: null,
  }));

function BuildRosterPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [service, setService] = useState<ServiceType>("sunday_morning");
  const [date, setDate] = useState<string>(toDateOnly(nextServiceDate("sunday_morning")));
  const [rows, setRows] = useState<SlotRow[]>(defaultRows);
  const [publishing, setPublishing] = useState(false);
  const [extraId, setExtraId] = useState<string | null>(null);

  const extrasQ = useQuery({
    queryKey: ["roster-extra-services"],
    queryFn: async () => {
      const { data } = await supabase
        .from("extra_services")
        .select("*")
        .is("deleted_at", null)
        .gte("service_date", toDateOnly(new Date()))
        .order("service_date");
      return data ?? [];
    },
  });
  const extras = extrasQ.data ?? [];
  const activeExtra = extras.find((e: any) => e.id === extraId);

  const membersQ = useQuery({
    queryKey: ["roster-members"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });

  const availQ = useQuery({
    queryKey: ["roster-avail", date, service],
    queryFn: async () => {
      const { data } = await supabase
        .from("availability")
        .select("user_id, status")
        .eq("service_date", date)
        .eq("service_type", service);
      return data ?? [];
    },
  });

  const existingQ = useQuery({
    queryKey: ["existing-roster", date, service],
    queryFn: async () => {
      const { data } = await supabase
        .from("roster").select("*").eq("service_date", date).eq("service_type", service);
      return data ?? [];
    },
  });

  // Hydrate the editable table from what's already saved for this service/date.
  useEffect(() => {
    const data = existingQ.data;
    if (!data) return;
    if (data.length === 0) {
      setRows(defaultRows());
      return;
    }
    setRows(
      data.map((r: any) => ({
        key: newKey(),
        role: r.role,
        camera: r.camera ?? null,
        notes: r.notes ?? null,
        assigned: r.assigned_user_id ?? null,
      })),
    );
  }, [existingQ.data]);

  useRealtimeInvalidate({
    table: "availability",
    filter: `service_date=eq.${date}`,
    queryKeys: [["roster-avail", date, service]],
  });

  const status: "draft" | "published" | "empty" = useMemo(() => {
    const saved = existingQ.data ?? [];
    if (saved.length === 0) return "empty";
    return saved.every((r: any) => r.status === "published") ? "published" : "draft";
  }, [existingQ.data]);

  const availableIds = new Set(
    (availQ.data ?? []).filter((a: any) => a.status === "available").map((a: any) => a.user_id),
  );
  const availableMembers = useMemo(
    () => (membersQ.data ?? []).filter((m: any) => availableIds.has(m.id)),
    [membersQ.data, availQ.data],
  );
  const memberName = (id: string | null) =>
    (membersQ.data ?? []).find((m: any) => m.id === id)?.full_name ?? null;

  const assignedCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) if (r.assigned) c[r.assigned] = (c[r.assigned] ?? 0) + 1;
    return c;
  }, [rows]);

  const patchRow = (key: string, patch: Partial<SlotRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { key: newKey(), role: ROLE_OPTIONS[0], camera: null, notes: null, assigned: null, editing: true },
    ]);

  const deleteRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const buildRows = (rosterStatus: "draft" | "published") =>
    rows
      .filter((r) => r.assigned)
      .map((r) => ({
        service_date: date,
        service_type: service,
        role: r.role,
        camera: r.camera,
        assigned_user_id: r.assigned,
        notes: r.notes,
        created_by: user?.id ?? null,
        extra_service_id: extraId,
        status: rosterStatus,
        published_at: rosterStatus === "published" ? new Date().toISOString() : null,
      }));

  const saveDraft = async () => {
    const payload = buildRows("draft");
    if (payload.length === 0) { toast.error("Assign at least one role"); return; }
    await supabase.from("roster").delete().eq("service_date", date).eq("service_type", service);
    const { error } = await supabase.from("roster").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.info("Draft saved. Click 'Build & Publish Roster' when ready to make it viewable by everyone.");
    qc.invalidateQueries({ queryKey: ["existing-roster", date, service] });
    qc.invalidateQueries({ queryKey: ["all-upcoming-roster"] });
  };

  const publishRoster = async () => {
    const payload = buildRows("published");
    if (payload.length === 0) { toast.error("Assign at least one role"); return; }
    setPublishing(true);
    try {
      await supabase.from("roster").delete().eq("service_date", date).eq("service_type", service);
      const { error } = await supabase.from("roster").insert(payload);
      if (error) throw error;
      try {
        const assignedUsers = Array.from(new Set(payload.map((r) => r.assigned_user_id).filter(Boolean))) as string[];
        if (assignedUsers.length > 0) {
          await supabase.from("notifications").insert(assignedUsers.map((uid) => ({
            user_id: uid,
            title: "You're on the roster",
            body: `${serviceLabel(service)} · ${formatServiceDate(date)}`,
            kind: "roster",
          })));
        }
      } catch (notifErr) {
        console.warn("Notification dispatch skipped:", notifErr);
      }
      toast.success("🚀 Roster updated & published — viewable by everyone in the app!");
      qc.invalidateQueries({ queryKey: ["all-upcoming-roster"] });
      qc.invalidateQueries({ queryKey: ["upcoming-roster-me"] });
      qc.invalidateQueries({ queryKey: ["existing-roster", date, service] });
      qc.invalidateQueries({ queryKey: ["roster-locks"] });
      qc.invalidateQueries({ queryKey: ["unread-roster"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Publish failed");
    }
    setPublishing(false);
  };

  const autoAssign = () => {
    const pool = [...availableMembers];
    const load: Record<string, number> = {};
    pool.forEach((m: any) => (load[m.id] = 0));
    setRows((prev) =>
      prev.map((r) => {
        if (r.assigned) return r;
        const cand = pool.sort((a: any, b: any) => load[a.id] - load[b.id])[0];
        if (!cand) return r;
        load[cand.id]++;
        return { ...r, assigned: cand.id };
      }),
    );
    toast.success("Suggested a fair assignment. Click 'Build & Publish Roster' to save.");
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Build Roster</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build assignments and publish them live for everyone in the app.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs">Service</Label>
            <Select value={service} onValueChange={(v) => { setService(v as any); setDate(toDateOnly(nextServiceDate(v as ServiceType))); }}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs">Extra service (optional)</Label>
            <Select
              value={extraId ?? "none"}
              onValueChange={(v) => {
                if (v === "none") { setExtraId(null); return; }
                const ex = extras.find((e: any) => e.id === v);
                setExtraId(v);
                if (ex?.service_date) setDate(ex.service_date);
              }}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Regular service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Regular service</SelectItem>
                {extras.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {formatServiceDate(e.service_date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs">Date · {formatServiceDate(date)}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button variant="outline" onClick={autoAssign} className="min-h-11"><Sparkles className="mr-2 h-4 w-4" /> Auto</Button>

          <Button variant="outline" onClick={saveDraft} className="min-h-11" title="Save draft hidden from regular members">
            <Save className="mr-2 h-4 w-4" /> Save as Draft
          </Button>
          <Button
            onClick={publishRoster}
            disabled={publishing}
            className="col-span-2 min-h-11 bg-gradient-primary shadow-elegant sm:col-span-1"
            title="Save and publish this roster live for everyone in the app"
          >
            <Send className="mr-2 h-4 w-4" /> {publishing ? "Updating Roster…" : "Build & Publish Roster"}
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="hidden min-h-11 sm:inline-flex"><Printer className="mr-2 h-4 w-4" /> Print</Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="Status" value={<StatusBadge status={status} />} />
        <Card className="shadow-card"><CardContent className="p-4 text-sm"><span className="text-muted-foreground">Available: </span><span className="font-bold text-success">{availableMembers.length}</span></CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4 text-sm"><span className="text-muted-foreground">Roles: </span><span className="font-bold">{rows.length}</span></CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4 text-sm"><span className="text-muted-foreground">Assigned: </span><span className="font-bold text-primary">{rows.filter((r) => r.assigned).length}</span></CardContent></Card>
      </div>

      {status === "draft" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm text-warning shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <FileEdit className="h-4 w-4 shrink-0" />
            <span>This roster is currently saved as a <strong>Draft</strong> and is hidden from team members.</span>
          </div>
          <Button
            size="sm"
            onClick={publishRoster}
            disabled={publishing}
            className="h-8 bg-warning font-semibold text-warning-foreground hover:bg-warning/90"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" /> Publish to Everyone Now
          </Button>
        </div>
      )}

      <Card className="shadow-card overflow-hidden">
        <CardHeader className="bg-gradient-subtle border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base sm:text-xl">
              {activeExtra ? activeExtra.name : serviceLabel(service)} · {formatServiceDate(date)}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addRow} className="min-h-10">
              <Plus className="mr-2 h-4 w-4" /> Add row
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>Frame / Notes</TableHead>
                  <TableHead className="w-56 sm:w-64">Assign Member</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key} className="align-middle">
                    <TableCell>
                      {r.editing ? (
                        <OptionField options={ROLE_OPTIONS} value={r.role} onChange={(v) => patchRow(r.key, { role: v ?? "" })} placeholder="Role" />
                      ) : (
                        <Badge className="bg-primary/12 text-primary hover:bg-primary/12 font-semibold">{r.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.editing ? (
                        <OptionField options={CAMERA_OPTIONS} value={r.camera} onChange={(v) => patchRow(r.key, { camera: v })} placeholder="Camera" allowEmpty />
                      ) : r.camera && r.camera !== "—" ? (
                        <Badge className="bg-warning/15 text-warning hover:bg-warning/15 font-semibold">{r.camera}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.editing ? (
                        <OptionField options={FRAME_OPTIONS} value={r.notes} onChange={(v) => patchRow(r.key, { notes: v })} placeholder="Frame / notes" allowEmpty />
                      ) : (
                        <span className="text-sm text-muted-foreground">{r.notes ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.assigned ?? "__unassigned__"}
                        onValueChange={(v) => patchRow(r.key, { assigned: v === "__unassigned__" ? null : v })}
                      >
                        <SelectTrigger className={cn("w-full min-h-10", r.assigned ? "font-medium" : "text-muted-foreground")}>
                          <SelectValue placeholder="— Select volunteer —">
                            {r.assigned ? (
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-semibold text-foreground truncate">{memberName(r.assigned)}</span>
                                {assignedCount[r.assigned] > 1 && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/30 text-primary shrink-0">
                                    {assignedCount[r.assigned]} roles
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">— Unassigned —</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unassigned__">— Unassigned —</SelectItem>
                          {availableMembers.map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.full_name} {assignedCount[m.id] ? `· ${assignedCount[m.id]} role(s)` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={r.editing ? "Finish editing details" : "Edit role / camera / notes"}
                          aria-label={r.editing ? "Done" : "Edit details"}
                          onClick={() => patchRow(r.key, { editing: !r.editing })}
                        >
                          {r.editing ? <Check className="h-4 w-4 text-success" /> : <Pencil className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete row"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteRow(r.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No rows yet — use “Add row” to build this roster.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Select from preset options, or choose “Other…” to type a custom value. */
function OptionField({
  options, value, onChange, placeholder, allowEmpty,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  allowEmpty?: boolean;
}) {
  const isCustom = !!value && !options.includes(value);
  const [custom, setCustom] = useState(isCustom);

  return (
    <div className="space-y-1">
      <Select
        value={custom ? OTHER : (value ?? "")}
        onValueChange={(v) => {
          if (v === OTHER) { setCustom(true); onChange(""); return; }
          setCustom(false);
          onChange(v === "—" && allowEmpty ? null : v);
        }}
      >
        <SelectTrigger className="min-w-32"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          <SelectItem value={OTHER}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <Input
          autoFocus
          placeholder={`Type ${placeholder.toLowerCase()}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center justify-between p-4 text-sm">
        <span className="text-muted-foreground">{label}</span>
        {value}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "draft" | "published" | "empty" }) {
  if (status === "published") return <Badge className="bg-success/15 text-success hover:bg-success/15"><CheckCircle2 className="mr-1 h-3 w-3" /> Published</Badge>;
  if (status === "draft") return <Badge className="bg-warning/15 text-warning hover:bg-warning/15"><FileEdit className="mr-1 h-3 w-3" /> Draft</Badge>;
  return <Badge variant="outline">Empty</Badge>;
}
