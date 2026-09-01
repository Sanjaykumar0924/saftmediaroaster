import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { SERVICES, formatDayMonthYear, serviceLabel, toDateOnly } from "@/lib/saft";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { Trophy, TrendingDown, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "admin" } as any });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin")) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Attendance Analytics · SAFT Media" },
      { name: "description", content: "Member-wise attendance rates, service breakdowns and trends for the SAFT media team." },
      { property: "og:title", content: "Attendance Analytics · SAFT Media" },
      { property: "og:description", content: "Member-wise attendance rates, service breakdowns and trends for the SAFT media team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

type ServiceFilter = "all" | "sunday_morning" | "sunday_evening" | "tuesday_evening" | "other";
type RangeKey = "week" | "month" | "year" | "all" | "custom";

const STATUSES = ["present", "absent", "late", "excused"] as const;
type Status = (typeof STATUSES)[number];

const COLORS: Record<Status, string> = {
  present: "oklch(0.68 0.16 150)",
  absent: "oklch(0.55 0.24 27)",
  late: "oklch(0.78 0.17 80)",
  excused: "oklch(0.55 0.14 260)",
};

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

function rangeStart(key: RangeKey): string | null {
  if (key === "all" || key === "custom") return null;
  const d = new Date();
  if (key === "week") d.setDate(d.getDate() - 7);
  if (key === "month") d.setMonth(d.getMonth() - 1);
  if (key === "year") d.setFullYear(d.getFullYear() - 1);
  return toDateOnly(d);
}

function AnalyticsPage() {
  const [service, setService] = useState<ServiceFilter>("all");
  const [range, setRange] = useState<RangeKey>("month");
  const [from, setFrom] = useState(toDateOnly(new Date()));
  const [to, setTo] = useState(toDateOnly(new Date()));

  const q = useQuery({
    queryKey: ["analytics-attendance"],
    queryFn: async () => {
      // Separate queries — joining profiles through attendance is blocked by RLS.
      const [{ data: att, error: e1 }, { data: members, error: e2 }] = await Promise.all([
        supabase.from("attendance").select("user_id, service_date, service_type, status"),
        supabase.from("profiles").select("id, full_name, is_active"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { att: att ?? [], members: members ?? [] };
    },
  });

  useRealtimeInvalidate({ table: "attendance", queryKeys: [["analytics-attendance"]] });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of q.data?.members ?? []) m.set(p.id, (p as any).full_name ?? "Unknown");
    return m;
  }, [q.data?.members]);

  const rows = useMemo(() => {
    const start = range === "custom" ? from : rangeStart(range);
    const end = range === "custom" ? to : null;
    return (q.data?.att ?? []).filter((a: any) => {
      if (service !== "all") {
        const known = SERVICES.some((s) => s.id === a.service_type);
        if (service === "other" ? known : a.service_type !== service) return false;
      }
      if (start && a.service_date < start) return false;
      if (end && a.service_date > end) return false;
      return true;
    });
  }, [q.data?.att, service, range, from, to]);

  // Overall status split
  const statusCounts = useMemo(() => {
    const c: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const a of rows as any[]) if (a.status in c) c[a.status as Status]++;
    return c;
  }, [rows]);
  const total = rows.length;
  const pieData = STATUSES.map((s) => ({ name: s, value: statusCounts[s] })).filter((d) => d.value > 0);
  const overallRate = pct(statusCounts.present + statusCounts.late, total);

  // Member-wise table
  const perMember = useMemo(() => {
    const map = new Map<string, { name: string; total: number } & Record<Status, number>>();
    for (const a of rows as any[]) {
      const key = a.user_id;
      if (!map.has(key)) {
        map.set(key, { name: nameById.get(key) ?? "Unknown", total: 0, present: 0, absent: 0, late: 0, excused: 0 });
      }
      const rec = map.get(key)!;
      rec.total++;
      if (a.status in COLORS) rec[a.status as Status]++;
    }
    return [...map.values()]
      .map((r) => ({ ...r, rate: pct(r.present + r.late, r.total) }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [rows, nameById]);

  const barData = perMember.slice(0, 12).map((m) => ({ name: m.name.split(" ")[0], rate: m.rate }));
  const top = perMember.filter((m) => m.total > 0).slice(0, 5);
  const lowest = [...perMember.filter((m) => m.total > 0)].reverse().slice(0, 5);

  // Member-by-service breakdown (rate per service type)
  const serviceKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of rows as any[]) set.add(a.service_type);
    return [...set].sort();
  }, [rows]);

  const memberByService = useMemo(() => {
    const map = new Map<string, Record<string, { p: number; t: number }>>();
    for (const a of rows as any[]) {
      const rec = map.get(a.user_id) ?? {};
      const cell = rec[a.service_type] ?? { p: 0, t: 0 };
      cell.t++;
      if (a.status === "present" || a.status === "late") cell.p++;
      rec[a.service_type] = cell;
      map.set(a.user_id, rec);
    }
    return [...map.entries()]
      .map(([id, rec]) => ({ name: nameById.get(id) ?? "Unknown", rec }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, nameById]);

  // Weekly + monthly trend
  const trend = (mode: "week" | "month") => {
    const buckets: Record<string, { p: number; t: number }> = {};
    for (const a of rows as any[]) {
      const d = new Date(a.service_date);
      let key: string;
      if (mode === "week") {
        d.setDate(d.getDate() - d.getDay());
        key = toDateOnly(d);
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      buckets[key] = buckets[key] ?? { p: 0, t: 0 };
      buckets[key].t++;
      if (a.status === "present" || a.status === "late") buckets[key].p++;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => ({ label: mode === "week" ? formatDayMonthYear(k).slice(0, 6) : k, rate: pct(v.p, v.t) }));
  };
  const weekly = useMemo(() => trend("week"), [rows]);
  const monthly = useMemo(() => trend("month"), [rows]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Live attendance insight from the database — filter by service and period.
        </p>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          <Tabs value={service} onValueChange={(v) => setService(v as ServiceFilter)}>
            <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sunday_morning">Sun AM</TabsTrigger>
              <TabsTrigger value="sunday_evening">Sun PM</TabsTrigger>
              <TabsTrigger value="tuesday_evening">Tue PM</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-end gap-2">
            {(["week", "month", "year", "all", "custom"] as RangeKey[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "outline"}
                onClick={() => setRange(r)}
                className="min-h-10 capitalize"
              >
                {r === "week" ? "Last week" : r === "month" ? "Last month" : r === "year" ? "Last year" : r === "all" ? "All time" : "Custom"}
              </Button>
            ))}
            {range === "custom" && (
              <div className="flex flex-wrap items-end gap-2">
                <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Records" value={String(total)} />
        <StatCard label="Attendance rate" value={`${overallRate}%`} />
        <StatCard label="Members tracked" value={String(perMember.length)} />
        <StatCard label="Absences" value={String(statusCounts.absent)} />
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading attendance…</p>}
      {q.error && <p className="text-sm text-destructive">Could not load attendance: {(q.error as any).message}</p>}
      {!q.isLoading && total === 0 && (
        <p className="text-sm text-muted-foreground">No attendance records for this filter yet.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-1">
          <CardHeader><CardTitle>Status split</CardTitle></CardHeader>
          <CardContent className="h-64">
            {pieData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {pieData.map((d) => <Cell key={d.name} fill={COLORS[d.name as Status]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle>Attendance % by member</CardTitle></CardHeader>
          <CardContent className="h-64">
            {barData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="rate" name="Rate" fill="oklch(0.55 0.24 27)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-3">
          <CardHeader><CardTitle>Weekly trend</CardTitle></CardHeader>
          <CardContent className="h-64">
            {weekly.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rate" name="Rate" stroke="oklch(0.55 0.24 27)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-3">
          <CardHeader><CardTitle>Monthly trend</CardTitle></CardHeader>
          <CardContent className="h-64">
            {monthly.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="rate" name="Rate" fill="oklch(0.68 0.16 150)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Member-wise table */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Member-wise attendance</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Late</TableHead>
                <TableHead className="text-right">Excused</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perMember.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">No records.</TableCell></TableRow>
              )}
              {perMember.map((m) => (
                <TableRow key={m.name}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-right">{m.total}</TableCell>
                  <TableCell className="text-right">{m.present}</TableCell>
                  <TableCell className="text-right">{m.absent}</TableCell>
                  <TableCell className="text-right">{m.late}</TableCell>
                  <TableCell className="text-right">{m.excused}</TableCell>
                  <TableCell className="text-right font-semibold">{m.rate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Member by service */}
      <Card className="shadow-card">
        <CardHeader><CardTitle>Member attendance by service</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {serviceKeys.map((k) => (
                  <TableHead key={k} className="text-right">{SERVICES.some((s) => s.id === k) ? serviceLabel(k as any) : k}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberByService.length === 0 && (
                <TableRow><TableCell colSpan={serviceKeys.length + 1} className="text-muted-foreground">No records.</TableCell></TableRow>
              )}
              {memberByService.map((m) => (
                <TableRow key={m.name}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  {serviceKeys.map((k) => {
                    const cell = m.rec[k];
                    return (
                      <TableCell key={k} className="text-right">
                        {cell ? `${pct(cell.p, cell.t)}% (${cell.t})` : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Top attendance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {top.length === 0 && <div className="text-sm text-muted-foreground">No attendance data yet.</div>}
            {top.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-primary-foreground font-bold">{i + 1}</div>
                  <div className="font-medium">{m.name}</div>
                </div>
                <Badge className="bg-success/15 text-success hover:bg-success/15">{m.rate}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" /> Needs encouragement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {lowest.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
            {lowest.map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <div className="font-medium">{m.name}</div>
                <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">{m.rate}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="pt-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="grid h-full place-items-center text-sm text-muted-foreground">No data for this filter.</div>;
}
