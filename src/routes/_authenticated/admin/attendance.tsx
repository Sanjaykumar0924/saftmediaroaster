import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SERVICES, formatServiceDate, nextServiceDate, serviceLabel, toDateOnly } from "@/lib/saft";
import type { ServiceType } from "@/lib/saft";
import { CheckCircle2, XCircle, Clock, ShieldQuestion, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "admin" } as any });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin")) throw redirect({ to: "/dashboard" });
  },
  component: AttendancePage,
});

type Status = "present" | "absent" | "late" | "excused";

function AttendancePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [service, setService] = useState<ServiceType>("sunday_morning");
  const [date, setDate] = useState<string>(toDateOnly(nextServiceDate(service)));
  const [state, setState] = useState<Record<string, Status>>({});
  const [showAll, setShowAll] = useState(false);

  const membersQ = useQuery({
    queryKey: ["attend-members"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("is_active", true).order("full_name")).data ?? [],
  });

  // Who is on the roster for this exact service? Only these people get marked.
  const rosterQ = useQuery({
    queryKey: ["attend-roster", date, service],
    queryFn: async () => {
      const { data } = await supabase
        .from("roster")
        .select("assigned_user_id, role, camera")
        .eq("service_date", date)
        .eq("service_type", service);
      return (data ?? []).filter((r: any) => r.assigned_user_id);
    },
  });

  const existingQ = useQuery({
    queryKey: ["attend-existing", date, service],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("service_date", date).eq("service_type", service);
      const map: Record<string, Status> = {};
      for (const r of data ?? []) map[r.user_id] = r.status as Status;
      setState(map);
      return data ?? [];
    },
  });

  const rosterRows = rosterQ.data ?? [];
  const assignmentByUser = new Map<string, string[]>();
  for (const r of rosterRows as any[]) {
    const label = [r.role, r.camera].filter(Boolean).join(" · ");
    const list = assignmentByUser.get(r.assigned_user_id) ?? [];
    if (label) list.push(label);
    assignmentByUser.set(r.assigned_user_id, list);
  }

  const allMembers = (membersQ.data ?? []) as any[];
  const rows = showAll ? allMembers : allMembers.filter((m) => assignmentByUser.has(m.id));

  const save = async () => {
    // Only save marks for people currently listed — never touch other members' records.
    const visible = new Set(rows.map((m) => m.id));
    const rowsToSave = Object.entries(state)
      .filter(([user_id]) => visible.has(user_id))
      .map(([user_id, status]) => ({
        user_id, status, service_date: date, service_type: service, marked_by: user?.id ?? null,
      }));
    if (rowsToSave.length === 0) { toast.error("Mark at least one member"); return; }
    const { error } = await supabase.from("attendance").upsert(rowsToSave, { onConflict: "user_id,service_date,service_type" });
    if (error) { toast.error(error.message); return; }
    toast.success("Attendance saved");
    qc.invalidateQueries({ queryKey: ["admin-attend-month"] });
    qc.invalidateQueries({ queryKey: ["attendance-me-month"] });
    qc.invalidateQueries({ queryKey: ["attendance-analytics"] });
  };


  const CFG: { key: Status; label: string; Icon: any; cls: string }[] = [
    { key: "present", label: "Present", Icon: CheckCircle2, cls: "bg-success text-white hover:bg-success/90" },
    { key: "late", label: "Late", Icon: Clock, cls: "bg-warning text-black hover:bg-warning/90" },
    { key: "excused", label: "Excused", Icon: ShieldQuestion, cls: "bg-secondary text-secondary-foreground hover:bg-secondary/90" },
    { key: "absent", label: "Absent", Icon: XCircle, cls: "bg-destructive text-white hover:bg-destructive/90" },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="mt-1 text-muted-foreground">Mark who showed up after each service.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Service</Label>
            <Select value={service} onValueChange={(v) => { setService(v as any); setDate(toDateOnly(nextServiceDate(v as ServiceType))); }}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{SERVICES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={save} className="bg-gradient-primary shadow-elegant"><Save className="mr-2 h-4 w-4" /> Save Attendance</Button>
        </div>
      </div>

      <Card className="shadow-card overflow-hidden">
        <CardHeader className="bg-gradient-subtle border-b">
          <CardTitle>{serviceLabel(service)} · {formatServiceDate(date)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Member</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(membersQ.data ?? []).map((m: any) => {
                const st = state[m.id];
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.full_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {CFG.map((o) => (
                          <Button
                            key={o.key}
                            size="sm"
                            variant="outline"
                            className={cn(st === o.key && o.cls)}
                            onClick={() => setState({ ...state, [m.id]: o.key })}
                          >
                            <o.Icon className="mr-1.5 h-3.5 w-3.5" /> {o.label}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {existingQ.data && existingQ.data.length > 0 && (
        <p className="text-xs text-muted-foreground">Already recorded: {existingQ.data.length} entries. Saving updates existing rows.</p>
      )}
    </div>
  );
}