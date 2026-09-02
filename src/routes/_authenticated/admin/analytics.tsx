import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { Trophy, TrendingUp } from "lucide-react";

import { ensureCurrentAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "admin" } as any });
    try {
      await ensureCurrentAdmin();
    } catch {
      // ignore
    }
  },
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const q = useQuery({
    queryKey: ["attendance-analytics"],
    queryFn: async () => {
      const { data: att } = await supabase.from("attendance").select("*, profiles:user_id(full_name)");
      const { data: members } = await supabase.from("profiles").select("id, full_name").eq("is_active", true);
      return { att: att ?? [], members: members ?? [] };
    },
  });

  const att = q.data?.att ?? [];
  const members = q.data?.members ?? [];

  // Overall status pie
  const statusCounts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
  att.forEach((a: any) => (statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1));
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ["oklch(0.68 0.16 150)", "oklch(0.55 0.24 27)", "oklch(0.78 0.17 80)", "oklch(0.55 0.14 260)"];

  // Per-member attendance %
  const perMember = members.map((m: any) => {
    const mine = att.filter((a: any) => a.user_id === m.id);
    const pct = mine.length ? Math.round((mine.filter((a: any) => a.status === "present" || a.status === "late").length / mine.length) * 100) : 0;
    return { name: m.full_name, pct, total: mine.length };
  }).sort((a, b) => b.pct - a.pct);

  const barData = perMember.slice(0, 12).map((m) => ({ name: m.name.split(" ")[0], pct: m.pct }));

  // Weekly trend (last 12 weeks)
  const weekMap: Record<string, { present: number; total: number }> = {};
  for (const a of att) {
    const d = new Date(a.service_date);
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().slice(0, 10);
    weekMap[key] = weekMap[key] ?? { present: 0, total: 0 };
    weekMap[key].total++;
    if (a.status === "present" || a.status === "late") weekMap[key].present++;
  }
  const trend = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([k, v]) => ({ week: k.slice(5), rate: v.total ? Math.round((v.present / v.total) * 100) : 0 }));

  const top = perMember.filter((m) => m.total > 0).slice(0, 3);
  const bottom = perMember.filter((m) => m.total > 0).slice(-3).reverse();

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Attendance insight and volunteer leaderboards.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-1">
          <CardHeader><CardTitle>Overall status</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle>Attendance % by member</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="pct" fill="oklch(0.55 0.24 27)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-3">
          <CardHeader><CardTitle>Weekly trend</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="oklch(0.55 0.24 27)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Top Attendance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {top.length === 0 && <div className="text-sm text-muted-foreground">No attendance data yet.</div>}
            {top.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-primary-foreground font-bold">{i + 1}</div>
                  <div className="font-medium">{m.name}</div>
                </div>
                <Badge className="bg-success/15 text-success hover:bg-success/15">{m.pct}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-destructive" /> Needs Encouragement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {bottom.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
            {bottom.map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <div className="font-medium">{m.name}</div>
                <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">{m.pct}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}