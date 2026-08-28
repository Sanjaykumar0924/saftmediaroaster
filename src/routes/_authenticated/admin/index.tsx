import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SERVICES, formatServiceDate, nextServiceDate, nextUpcomingService, serviceLabel, toDateOnly } from "@/lib/saft";
import { Users, CheckCircle2, XCircle, HelpCircle, CalendarClock, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "admin" } as any });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminOverview,
});

function AdminOverview() {
  const next = nextUpcomingService();
  const nextDate = toDateOnly(nextServiceDate(next.service));

  const membersQ = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      return data ?? [];
    },
  });

  const availQ = useQuery({
    queryKey: ["admin-avail", nextDate],
    queryFn: async () => {
      const dates = SERVICES.map((s) => toDateOnly(nextServiceDate(s.id)));
      const { data } = await supabase
        .from("availability")
        .select("user_id, service_type, status, service_date, unavailable_reason, responsible, responsible_reason")
        .in("service_date", dates);
      return data ?? [];
    },
  });

  const attendQ = useQuery({
    queryKey: ["admin-attend-month"],
    queryFn: async () => {
      const start = new Date(); start.setDate(1);
      const { data } = await supabase.from("attendance").select("status").gte("service_date", toDateOnly(start));
      return data ?? [];
    },
  });

  const members = membersQ.data ?? [];
  const activeMembers = members.filter((m: any) => m.is_active);
  type AvailInfo = { status: "available" | "unavailable" | "pending"; reason?: string | null; responsible?: boolean | null; responsibleReason?: string | null };
  const availMap = new Map<string, AvailInfo>();
  for (const a of availQ.data ?? []) {
    availMap.set(`${a.user_id}__${a.service_date}__${a.service_type}`, {
      status: a.status as any,
      reason: (a as any).unavailable_reason,
      responsible: (a as any).responsible,
      responsibleReason: (a as any).responsible_reason,
    });
  }

  const nextDateStr = toDateOnly(nextServiceDate(next.service));
  const availToday = activeMembers.filter((m: any) => availMap.get(`${m.id}__${nextDateStr}__${next.service}`)?.status === "available").length;
  const unavailToday = activeMembers.filter((m: any) => availMap.get(`${m.id}__${nextDateStr}__${next.service}`)?.status === "unavailable").length;
  const att = attendQ.data ?? [];
  const attPct = att.length ? Math.round((att.filter((a) => a.status === "present" || a.status === "late").length / att.length) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <div className="text-sm text-muted-foreground">Admin</div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Team Overview</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Users} label="Total Members" value={String(activeMembers.length)} />
        <Stat icon={CheckCircle2} label={`Available (${SERVICES.find(s=>s.id===next.service)?.short})`} value={String(availToday)} tone="success" />
        <Stat icon={XCircle} label="Unavailable" value={String(unavailToday)} tone="danger" />
        <Stat icon={Trophy} label="Attendance %" value={`${attPct}%`} />
        <Stat icon={CalendarClock} label="Next Service" value={serviceLabel(next.service)} sub={formatServiceDate(next.date)} accent />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Service Availability</CardTitle>
          <div className="text-sm text-muted-foreground">Next occurrence of each service</div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                {SERVICES.map((s) => (
                  <TableHead key={s.id}>
                    {s.label}
                    <div className="text-xs font-normal text-muted-foreground">{formatServiceDate(nextServiceDate(s.id))}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeMembers.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.full_name}</TableCell>
                  {SERVICES.map((s) => {
                    const info = availMap.get(`${m.id}__${toDateOnly(nextServiceDate(s.id))}__${s.id}`);
                    return (
                      <TableCell key={s.id}>
                        <AvailBadge status={info?.status ?? "pending"} />
                        {info?.status === "unavailable" && info.reason && (
                          <div className="mt-1 text-[11px] text-muted-foreground">{info.reason}</div>
                        )}
                        {info?.status === "available" && info.responsible === true && (
                          <div className="mt-1 text-[11px] font-semibold text-primary">★ Responsible</div>
                        )}
                        {info?.status === "available" && info.responsible === false && (
                          <div className="mt-1 text-[11px] text-muted-foreground">Not responsible{info.responsibleReason ? ` · ${info.responsibleReason}` : ""}</div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {activeMembers.length === 0 && (
                <TableRow><TableCell colSpan={SERVICES.length + 1} className="text-center text-muted-foreground py-8">No members yet. Add some in Members.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AvailBadge({ status }: { status: string }) {
  if (status === "available") return <Badge className="bg-success/15 text-success hover:bg-success/15"><CheckCircle2 className="mr-1 h-3 w-3" /> Available</Badge>;
  if (status === "unavailable") return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15"><XCircle className="mr-1 h-3 w-3" /> Unavailable</Badge>;
  return <Badge variant="outline" className="text-muted-foreground"><HelpCircle className="mr-1 h-3 w-3" /> No response</Badge>;
}

function Stat({ icon: Icon, label, value, sub, tone, accent }: { icon: any; label: string; value: string; sub?: string; tone?: "success" | "danger"; accent?: boolean }) {
  const toneCls = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-primary";
  return (
    <div className={`rounded-2xl border border-border p-5 shadow-card ${accent ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className={`text-xs font-medium uppercase tracking-wider ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
        <Icon className={`h-4 w-4 ${accent ? "text-primary-foreground/80" : toneCls}`} />
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
      {sub && <div className={`mt-1 text-xs ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}