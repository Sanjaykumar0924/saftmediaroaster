import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cutoffLabel, formatServiceDate, isAvailabilityClosed, serviceLabel, servicesByNextDate, toDateOnly } from "@/lib/saft";
import type { ServiceType } from "@/lib/saft";
import { CheckCircle2, XCircle, HelpCircle, CalendarDays, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/availability")({
  component: AvailabilityPage,
});

type Row = {
  service: ServiceType;
  date: string;
  status: "available" | "unavailable" | "pending";
  unavailable_reason: string | null;
  responsible: boolean | null;
  responsible_reason: string | null;
};

const REASONS = [
  "Out of town",
  "Work commitment",
  "Family obligation",
  "Health / not well",
  "Studies / exam",
  "Other",
];

function AvailabilityPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["availability-next", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const rows = await Promise.all(
        servicesByNextDate().map(async (s) => {
          const d = toDateOnly(s.nextDate);
          const { data } = await supabase
            .from("availability")
            .select("status, unavailable_reason, responsible, responsible_reason")
            .eq("user_id", user!.id)
            .eq("service_date", d)
            .eq("service_type", s.id)
            .maybeSingle();
          return {
            service: s.id,
            date: d,
            status: (data?.status ?? "pending") as Row["status"],
            unavailable_reason: (data as any)?.unavailable_reason ?? null,
            responsible: (data as any)?.responsible ?? null,
            responsible_reason: (data as any)?.responsible_reason ?? null,
          };
        }),
      );
      return rows;
    },
  });


  // Services this member has been PUBLISHED on — their response is locked while that stands.
  const lockQ = useQuery({
    queryKey: ["roster-locks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = toDateOnly(new Date());
      const { data } = await supabase
        .from("roster")
        .select("service_date, service_type, extra_service_id")
        .eq("assigned_user_id", user!.id)
        .eq("status", "published")
        .gte("service_date", today);
      return data ?? [];
    },
  });

  const lockedFixed = useMemo(
    () => new Set((lockQ.data ?? []).filter((r: any) => !r.extra_service_id).map((r: any) => `${r.service_date}|${r.service_type}`)),
    [lockQ.data],
  );

  useRealtimeInvalidate({
    table: "availability",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    queryKeys: [["availability-next", user?.id], ["my-avail-upcoming", user?.id]],
  });
  useRealtimeInvalidate({
    table: "roster",
    filter: user ? `assigned_user_id=eq.${user.id}` : undefined,
    queryKeys: [["roster-locks", user?.id]],
  });

  const save = async (row: Row, patch: Partial<Row>) => {
    if (isAvailabilityClosed(row.service, row.date) && !isAdmin && !isSuperAdmin) {
      toast.error(`Responses closed after ${cutoffLabel(row.service)}`);
      return;
    }
    const next = { ...row, ...patch };
    qc.setQueryData<Row[]>(["availability-next", user?.id], (prev) =>
      (prev ?? []).map((r) => (r.service === row.service ? next : r)),
    );
    const { error } = await supabase.from("availability").upsert(
      {
        user_id: user!.id,
        service_date: row.date,
        service_type: row.service,
        status: next.status,
        unavailable_reason: next.status === "unavailable" ? next.unavailable_reason : null,
        responsible: next.status === "available" ? next.responsible : null,
        responsible_reason: next.status === "available" && next.responsible === false ? next.responsible_reason : null,
      },
      { onConflict: "user_id,service_date,service_type" },
    );
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["availability-next", user?.id] });
    } else {
      qc.invalidateQueries({ queryKey: ["my-avail-upcoming"] });
      qc.invalidateQueries({ queryKey: ["admin-avail"] });
    }
  };

  /** Take back a response entirely — allowed unless the member is on a published roster. */
  const revoke = async (row: Row) => {
    const { error } = await supabase
      .from("availability")
      .delete()
      .eq("user_id", user!.id)
      .eq("service_date", row.date)
      .eq("service_type", row.service);
    if (error) { toast.error(error.message); return; }
    toast.success("Response revoked");
    qc.invalidateQueries({ queryKey: ["availability-next", user?.id] });
    qc.invalidateQueries({ queryKey: ["my-avail-upcoming"] });
    qc.invalidateQueries({ queryKey: ["admin-avail"] });
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Let the team know when you can serve — and if you'll be taking responsibility.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((row) => (
          <ServiceCard
            key={row.service}
            row={row}
            onSave={save}
            onRevoke={revoke}
            rostered={lockedFixed.has(`${row.date}|${row.service}`)}
          />
        ))}
      </div>

      <ExtraServices rosteredIds={new Set((lockQ.data ?? []).map((r: any) => r.extra_service_id).filter(Boolean))} />
    </div>
  );
}


/** Admin-created services beyond the fixed Sunday/Tuesday ones. */
function ExtraServices({ rosteredIds }: { rosteredIds: Set<string> }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const servicesQ = useQuery({
    queryKey: ["extra-services"],
    queryFn: async () => {
      const today = toDateOnly(new Date());
      const { data, error } = await supabase
        .from("extra_services").select("*").is("deleted_at", null).gte("service_date", today).order("service_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const myQ = useQuery({
    queryKey: ["extra-availability", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extra_service_availability")
        .select("extra_service_id, status, unavailable_reason")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const mine = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of myQ.data ?? []) m.set(r.extra_service_id, r);
    return m;
  }, [myQ.data]);

  const respond = async (serviceId: string, status: "available" | "unavailable", reason?: string) => {
    if (status === "unavailable" && !reason?.trim()) { toast.error("Please choose a reason first"); return; }
    const { error } = await supabase.from("extra_service_availability").upsert(
      {
        extra_service_id: serviceId,
        user_id: user!.id,
        status,
        unavailable_reason: status === "unavailable" ? reason!.trim() : null,
      },
      { onConflict: "extra_service_id,user_id" },
    );
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["extra-availability", user?.id] });
    qc.invalidateQueries({ queryKey: ["admin-avail"] });
  };

  const revoke = async (serviceId: string) => {
    const { error } = await supabase
      .from("extra_service_availability")
      .delete()
      .eq("extra_service_id", serviceId)
      .eq("user_id", user!.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Response revoked");
    qc.invalidateQueries({ queryKey: ["extra-availability", user?.id] });
    qc.invalidateQueries({ queryKey: ["admin-avail"] });
  };

  const services = servicesQ.data ?? [];


  const removeService = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Member responses for it will be removed too.`)) return;
    await supabase.from("roster").update({ extra_service_id: null } as any).eq("extra_service_id", id);
    await supabase.from("extra_service_availability").delete().eq("extra_service_id", id);
    const { error } = await supabase.from("extra_services").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Service deleted");
    qc.invalidateQueries({ queryKey: ["extra-services"] });
    qc.invalidateQueries({ queryKey: ["extra-availability", user?.id] });
    qc.invalidateQueries({ queryKey: ["admin-avail"] });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Other services</h2>
          <p className="text-sm text-muted-foreground">Special services beyond Sunday & Tuesday.</p>
        </div>
        {isAdmin && <AddExtraServiceDialog onCreated={() => qc.invalidateQueries({ queryKey: ["extra-services"] })} />}
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other services scheduled right now.</p>
      ) : (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s: any) => (
            <ExtraServiceCard
              key={s.id}
              service={s}
              row={mine.get(s.id)}
              onRespond={respond}
              onRevoke={revoke}
              rostered={rosteredIds.has(s.id)}
              onDelete={isAdmin ? removeService : undefined}
            />

          ))}
        </div>
      )}

    </section>
  );
}

function ExtraServiceCard({ service, row, onRespond, onRevoke, rostered, onDelete }: any) {
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState(row?.unavailable_reason ?? "");
  const [custom, setCustom] = useState("");
  const status = row?.status ?? "pending";
  const locked = Boolean(rostered);

  return (
    <Card className="overflow-hidden shadow-card transition-smooth hover:shadow-elegant">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <CalendarDays className="h-3.5 w-3.5" /> {formatServiceDate(service.service_date)}
          </span>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete service"
              className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(service.id, service.name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardTitle className="text-xl sm:text-2xl">{service.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusPill status={status} />
        {locked && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm font-medium text-primary">
            Published assignment — availability is locked until this assignment is removed.
          </div>
        )}
        <div className={cn("flex flex-col gap-3", locked && "pointer-events-none opacity-50")}>
          <Button
            size="lg"
            disabled={locked}
            onClick={() => { setAskReason(false); onRespond(service.id, "available"); }}
            className={cn(
              "min-h-14 w-full rounded-2xl text-base font-semibold",
              status === "available"
                ? "bg-success text-white hover:bg-success/90"
                : "bg-success/10 text-success hover:bg-success/20",
            )}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" /> Available
          </Button>
          <Button
            size="lg"
            disabled={locked}
            onClick={() => { if (status !== "unavailable") setAskReason(true); }}
            className={cn(
              "min-h-14 w-full rounded-2xl text-base font-semibold",
              status === "unavailable"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-destructive/10 text-destructive hover:bg-destructive/20",
            )}
          >
            <XCircle className="mr-2 h-5 w-5" /> Not Available
          </Button>
        </div>
        {row && !locked && (
          <Button variant="outline" className="w-full" onClick={() => onRevoke(service.id)}>
            Revoke my response
          </Button>
        )}
        {(askReason || status === "unavailable") && !locked && (
          <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-destructive">Reason (required)</Label>
            <Select
              value={reason || undefined}
              onValueChange={(v) => { setReason(v); if (v !== "Other") { onRespond(service.id, "unavailable", v); setAskReason(false); } }}
            >
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {reason === "Other" && (
              <div className="flex gap-2">
                <Input placeholder="Please specify" value={custom} onChange={(e) => setCustom(e.target.value)} />
                <Button size="sm" onClick={() => { onRespond(service.id, "unavailable", custom); setAskReason(false); }}>Save</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function AddExtraServiceDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(toDateOnly(new Date()));
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Service name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("extra_services").insert({
      name: name.trim(), service_date: date, created_by: user?.id ?? null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Service added — members can now respond");
    setName("");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-11 bg-gradient-primary shadow-elegant">
          <CalendarPlus className="mr-2 h-4 w-4" /> New service
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a service</DialogTitle>
          <DialogDescription>Appears instantly on every member's availability page.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Service name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Prayer / Convention" /></div>
          <div>
            <Label>Date · {formatServiceDate(date)}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
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

function ServiceCard({
  row,
  onSave,
  onRevoke,
  rostered,
}: {
  row: Row;
  onSave: (row: Row, patch: Partial<Row>) => void;
  onRevoke?: (row: Row) => void;
  rostered?: boolean;
}) {
  const { isAdmin, isSuperAdmin } = useAuth();
  const locked = Boolean(rostered);
  const closed = (isAvailabilityClosed(row.service, row.date) && !isAdmin && !isSuperAdmin) || locked;
  const [reason, setReason] = useState(row.unavailable_reason ?? "");
  const [customReason, setCustomReason] = useState(
    row.unavailable_reason && !REASONS.includes(row.unavailable_reason) ? row.unavailable_reason : "",
  );
  const [respReason, setRespReason] = useState(row.responsible_reason ?? "");
  // Reason must be picked BEFORE a member can be marked unavailable.
  const [askReason, setAskReason] = useState(false);

  useEffect(() => {
    setReason(row.unavailable_reason ?? "");
    setCustomReason(row.unavailable_reason && !REASONS.includes(row.unavailable_reason) ? row.unavailable_reason : "");
    setRespReason(row.responsible_reason ?? "");
  }, [row.unavailable_reason, row.responsible_reason]);

  const showReasonPanel = askReason || row.status === "unavailable";

  const commitUnavailable = (text: string) => {
    const clean = text.trim();
    if (!clean) {
      toast.error("Please choose a reason first");
      return;
    }
    onSave(row, { status: "unavailable", unavailable_reason: clean });
    setAskReason(false);
  };

  return (
    <Card className="overflow-hidden shadow-card transition-smooth hover:shadow-elegant">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatServiceDate(row.date)}
          </span>
        </div>
        <CardTitle className="text-xl sm:text-2xl">{serviceLabel(row.service)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusPill status={row.status} />
        {locked ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-medium text-primary">
            You're on the published roster for this service — availability is locked. It unlocks if the
            assignment is removed.
          </div>
        ) : closed ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm font-medium text-warning">
            Closed — responses shut after {cutoffLabel(row.service)}. Your saved answer stays as it is.
          </div>
        ) : null}
        <div className={cn("flex flex-col gap-3", closed && "pointer-events-none opacity-50")}>
          <Button
            size="lg"
            disabled={closed}
            onClick={() => { setAskReason(false); onSave(row, { status: "available" }); }}
            className={cn(
              "min-h-14 w-full rounded-2xl text-base font-semibold transition-all",
              row.status === "available"
                ? "bg-success text-white shadow-lg shadow-success/30 hover:bg-success/90 scale-[1.02]"
                : "bg-success/10 text-success hover:bg-success/20",
            )}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" /> Available
          </Button>
          <Button
            size="lg"
            disabled={closed}
            onClick={() => {
              if (row.status === "unavailable") return;
              setAskReason(true);
              toast.info("Select a reason to confirm you're not available");
            }}
            className={cn(
              "min-h-14 w-full rounded-2xl text-base font-semibold transition-all",
              row.status === "unavailable"
                ? "bg-destructive text-white shadow-lg shadow-destructive/30 hover:bg-destructive/90 scale-[1.02]"
                : "bg-destructive/10 text-destructive hover:bg-destructive/20",
            )}
          >
            <XCircle className="mr-2 h-5 w-5" /> Not Available
          </Button>
        </div>

        {showReasonPanel && (
          <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-destructive">
              Reason (required{row.status !== "unavailable" ? " to confirm" : ""})
            </Label>
            <Select
              value={reason || undefined}
              onValueChange={(v) => {
                setReason(v);
                if (v !== "Other") commitUnavailable(v);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {reason === "Other" && (
              <div className="flex gap-2">
                <Input
                  placeholder="Please specify"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
                <Button size="sm" onClick={() => commitUnavailable(customReason)}>Save</Button>
              </div>
            )}
            {row.status !== "unavailable" && (
              <Button variant="ghost" size="sm" className="h-8 w-full" onClick={() => setAskReason(false)}>
                Cancel
              </Button>
            )}
          </div>
        )}


        {row.status === "available" && (
          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-primary">
              Can you take responsibility?
            </Label>
            <RadioGroup
              value={row.responsible === null ? "" : row.responsible ? "yes" : "no"}
              onValueChange={(v) => onSave(row, { responsible: v === "yes" })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="yes" id={`resp-yes-${row.service}`} />
                <span>Yes, I can</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="no" id={`resp-no-${row.service}`} />
                <span>No</span>
              </label>
            </RadioGroup>
            {row.responsible === false && (
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Why not? (optional)"
                  value={respReason}
                  onChange={(e) => setRespReason(e.target.value)}
                  onBlur={() => respReason !== (row.responsible_reason ?? "") && onSave(row, { responsible_reason: respReason.trim() || null })}
                />
              </div>
            )}
          </div>
        )}

        {!locked && row.status !== "pending" && onRevoke && (
          <Button variant="outline" className="w-full" onClick={() => onRevoke(row)}>
            Revoke my response
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: Row["status"] }) {
  const cfg = {
    available: { label: "You're marked available", cls: "bg-success/10 text-success", Icon: CheckCircle2 },
    unavailable: { label: "You're marked unavailable", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
    pending: { label: "Awaiting your response", cls: "bg-muted text-muted-foreground", Icon: HelpCircle },
  }[status];
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", cfg.cls)}>
      <cfg.Icon className="h-3.5 w-3.5" /> {cfg.label}
    </div>
  );
}
