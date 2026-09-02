import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatServiceDate, nextUpcomingService, serviceLabel, servicesByNextDate, toDateOnly } from "@/lib/saft";
import { CalendarClock, Sparkles, Trophy, CheckCircle2, XCircle, HelpCircle, Clock } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();

  const next = nextUpcomingService();

  const attendanceQ = useQuery({
    queryKey: ["attendance-me-month", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date(); start.setDate(1);
      const { data } = await supabase
        .from("attendance")
        .select("status, service_date")
        .eq("user_id", user!.id)
        .gte("service_date", toDateOnly(start));
      return data ?? [];
    },
  });

  const upcomingRosterQ = useQuery({
    queryKey: ["upcoming-roster-me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = toDateOnly(new Date());
      const { data } = await supabase
        .from("roster")
        .select("*")
        .eq("assigned_user_id", user!.id)
        .gte("service_date", today)
        .order("service_date", { ascending: true })
        .limit(5);
      return data ?? [];
    },
  });

  const availabilityQ = useQuery({
    queryKey: ["my-avail-upcoming", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const rows = await Promise.all(
        servicesByNextDate().map(async (s) => {
          const d = toDateOnly(s.nextDate);
          const { data } = await supabase
            .from("availability")
            .select("status")
            .eq("user_id", user!.id)
            .eq("service_date", d)
            .eq("service_type", s.id)
            .maybeSingle();
          return { service: s.id, date: d, status: (data?.status ?? "pending") as "available" | "unavailable" | "pending" };
        }),
      );
      return rows;
    },
  });

  const att = attendanceQ.data ?? [];
  const pct = att.length ? Math.round((att.filter((a) => a.status === "present" || a.status === "late").length / att.length) * 100) : 0;

  useRealtimeInvalidate({
    table: "roster",
    filter: user ? `assigned_user_id=eq.${user.id}` : undefined,
    queryKeys: [["upcoming-roster-me", user?.id], ["all-upcoming-roster"]],
    onChange: (payload) => {
      if (payload.eventType === "INSERT" && payload.new?.status === "published" && payload.new?.assigned_user_id === user?.id) {
        toast.success(`📢 You've been assigned for ${serviceLabel(payload.new.service_type)}`);
      }

    },
  });
  useRealtimeInvalidate({
    table: "availability",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    queryKeys: [["my-avail-upcoming", user?.id], ["availability-next", user?.id]],
  });

  return (
    <div className="space-y-6 animate-fade-up sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Welcome back</span>
            {isAdmin && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </span>
            )}
          </div>
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Hello {profile?.full_name?.split(" ")[0] ?? "there"} 👋
          </h1>
        </div>
        <div className="hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-card sm:block">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Today</div>
          <div className="text-lg font-semibold">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={CalendarClock} label="Next service" value={serviceLabel(next.service)} sub={formatServiceDate(next.date)} accent />
        <StatCard icon={Trophy} label="This month attendance" value={`${pct}%`} sub={`${att.length} recorded`} />
        <StatCard icon={Sparkles} label="Upcoming assignments" value={String(upcomingRosterQ.data?.length ?? 0)} sub="Rostered services" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle>My work &amp; assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingRosterQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (upcomingRosterQ.data ?? []).length === 0 ? (
              <div className="rounded-xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                You're not on any upcoming roster yet.
              </div>
            ) : (
              <div className="space-y-3">
                {(upcomingRosterQ.data ?? []).map((r: any) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-4">
                    <div className="min-w-0">
                      <div className="font-semibold">{serviceLabel(r.service_type)}</div>
                      <div className="text-xs text-muted-foreground">{formatServiceDate(r.service_date)}</div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{r.role}</Badge>
                      {r.camera && (
                        <Badge className="bg-warning/15 text-warning hover:bg-warning/15">{r.camera}</Badge>
                      )}
                      {r.notes && (
                        <Badge variant="outline" className="font-normal text-muted-foreground">{r.notes}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>


        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(availabilityQ.data ?? []).map((row) => {
              const Icon = row.status === "available" ? CheckCircle2 : row.status === "unavailable" ? XCircle : HelpCircle;
              const tone = row.status === "available" ? "text-success" : row.status === "unavailable" ? "text-destructive" : "text-muted-foreground";
              return (
                <div key={row.service} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <div className="text-sm font-semibold">{serviceLabel(row.service as any)}</div>
                    <div className="text-xs text-muted-foreground">{formatServiceDate(row.date)}</div>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 text-sm font-medium ${tone}`}>
                    <Icon className="h-4 w-4" />
                    {row.status[0].toUpperCase() + row.status.slice(1)}
                  </div>
                </div>
              );
            })}
            <a href="/availability" className="mt-2 block text-center text-xs font-medium text-primary hover:underline">
              Update availability →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border p-6 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant ${accent ? "bg-gradient-primary text-primary-foreground" : "bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className={`text-xs font-medium uppercase tracking-wider ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
        <Icon className={`h-5 w-5 ${accent ? "text-primary-foreground/80" : "text-primary"}`} />
      </div>
      <div className="mt-4 text-3xl font-bold">{value}</div>
      <div className={`mt-1 text-sm ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{sub}</div>
    </div>
  );
}

// Silence unused import warning
void Clock;