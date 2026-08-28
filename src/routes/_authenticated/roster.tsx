import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMemberDirectory } from "@/lib/directory.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatServiceDate, serviceLabel, toDateOnly } from "@/lib/saft";
import { Printer, CalendarClock, Clock, History, Radio, CalendarDays, Download } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { toast } from "sonner";


type RosterRow = {
  id: string;
  service_date: string;
  service_type: string;
  role: string;
  camera: string | null;
  assigned_user_id: string | null;
  notes: string | null;
  status: string;
  profiles?: { full_name: string; username: string } | null;
};

export const Route = createFileRoute("/_authenticated/roster")({
  component: RosterViewPage,
});

function RosterViewPage() {
  const fetchDirectory = useServerFn(getMemberDirectory);
  const q = useQuery({
    queryKey: ["all-upcoming-roster"],
    queryFn: async () => {
      const past = toDateOnly(new Date(Date.now() - 93 * 24 * 60 * 60 * 1000));

      const { data: rosterRows, error: rosterError } = await supabase
        .from("roster")
        .select("*")
        .eq("status", "published")
        .gte("service_date", past)
        .order("service_date", { ascending: true });
      if (rosterError) throw rosterError;

      const rows = (rosterRows ?? []) as RosterRow[];
      const userIds = Array.from(new Set(rows.map((r) => r.assigned_user_id).filter(Boolean))) as string[];
      if (userIds.length === 0) return rows;

      const profiles = await fetchDirectory({ data: { ids: userIds } });
      const profileById = new Map(profiles.map((p) => [p.id, { full_name: p.full_name ?? "", username: p.username ?? "" }]));
      return rows.map((r) => ({ ...r, profiles: r.assigned_user_id ? (profileById.get(r.assigned_user_id) ?? null) : null }));
    },
  });

  useRealtimeInvalidate({
    table: "roster",
    queryKeys: [["all-upcoming-roster"], ["upcoming-roster-me"]],
    onChange: (payload) => {
      const row = payload.new ?? payload.old;
      if (row?.status === "published" && payload.eventType === "INSERT") {
        toast.success(`📢 New roster published for ${serviceLabel(row.service_type)}`);
      }
    },
  });

  const today = toDateOnly(new Date());
  const weekEnd = toDateOnly(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const rows = q.data ?? [];
  const groups = {
    current: groupByService(rows.filter((r: any) => r.service_date >= today && r.service_date <= weekEnd)),
    upcoming: groupByService(rows.filter((r: any) => r.service_date > weekEnd)),
    previous: groupByService(rows.filter((r: any) => r.service_date < today)),
  };

  return (
    <div className="space-y-6 animate-fade-up print:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
            <Radio className="h-3 w-3 animate-pulse" /> Live · syncs instantly
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Roster</h1>
          <p className="mt-1 text-sm text-muted-foreground">Published assignments appear here instantly after admin publishing.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadRosterCsv(rows)}>
            <Download className="mr-2 h-4 w-4" /> Excel / CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
          <TabsTrigger value="current" className="w-full min-h-10 justify-center gap-1.5 whitespace-nowrap px-2 py-2 text-xs sm:text-sm">
            <Clock className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Current Week</span><span className="sm:hidden">Week</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="w-full min-h-10 justify-center gap-1.5 whitespace-nowrap px-2 py-2 text-xs sm:text-sm">
            <CalendarClock className="h-4 w-4 shrink-0" /> Upcoming
          </TabsTrigger>
          <TabsTrigger value="previous" className="w-full min-h-10 justify-center gap-1.5 whitespace-nowrap px-2 py-2 text-xs sm:text-sm">
            <History className="h-4 w-4 shrink-0" /> Previous
          </TabsTrigger>
          <TabsTrigger value="archive" className="w-full min-h-10 justify-center gap-1.5 whitespace-nowrap px-2 py-2 text-xs sm:text-sm">
            <CalendarDays className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">3 Months After Previous</span><span className="sm:hidden">3 Months</span>
          </TabsTrigger>
        </TabsList>


        <TabsContent value="current" className="mt-4 space-y-4">
          <RosterList grouped={groups.current} loading={q.isLoading} emptyMsg="No roster published for this week yet." />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4 space-y-4">
          <RosterList grouped={groups.upcoming} loading={q.isLoading} emptyMsg="No upcoming rosters published." />
        </TabsContent>
        <TabsContent value="previous" className="mt-4 space-y-4">
          <RosterList grouped={groups.previous} loading={q.isLoading} emptyMsg="No previous rosters." />
        </TabsContent>
        <TabsContent value="archive" className="mt-4 space-y-4">
          <RosterArchiveCalendar rows={rows} loading={q.isLoading} />
        </TabsContent>
      </Tabs>

    </div>
  );
}

/** Download every published assignment (name + role) as a CSV Excel can open. */
function downloadRosterCsv(rows: any[]) {
  if (rows.length === 0) { toast.error("Nothing to download yet"); return; }
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Date", "Service", "Role", "Camera", "Name", "Username", "Frame / Notes"];
  const body = [...rows]
    .sort((a, b) => a.service_date.localeCompare(b.service_date))
    .map((r) => [
      formatServiceDate(r.service_date),
      serviceLabel(r.service_type),
      r.role,
      r.camera ?? "",
      r.profiles?.full_name ?? "Unassigned",
      r.profiles?.username ?? "",
      r.notes ?? "",
    ]);
  const csv = [header, ...body].map((line) => line.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `saft-roster-${toDateOnly(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Roster downloaded");
}

function groupByService(rows: any[]) {
  const g: Record<string, any[]> = {};
  for (const r of rows) {
    const k = `${r.service_date}__${r.service_type}`;
    (g[k] ??= []).push(r);
  }
  return g;
}

function RosterList({ grouped, loading, emptyMsg }: { grouped: Record<string, any[]>; loading: boolean; emptyMsg: string }) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading roster…</div>;
  const keys = Object.keys(grouped);
  if (keys.length === 0)
    return (
      <Card className="shadow-card">
        <CardContent className="p-10 text-center text-muted-foreground">{emptyMsg}</CardContent>
      </Card>
    );
  return (
    <>
      {keys.map((key) => {
        const rows = grouped[key];
        const [date, service] = key.split("__");
        return (
          <Card key={key} className="shadow-card overflow-hidden">
            <CardHeader className="border-b bg-gradient-subtle">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-primary">{formatServiceDate(date)}</div>
                  <CardTitle className="truncate text-lg sm:text-2xl">{serviceLabel(service as any)}</CardTitle>
                </div>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{rows.length} assignments</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Camera</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead className="hidden md:table-cell">Frame / Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.role}</TableCell>
                        <TableCell><Badge variant="outline">{r.camera ?? "—"}</Badge></TableCell>
                        <TableCell>{r.profiles?.full_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{r.notes ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

/** Last 3 months of rosters on a calendar — updated days are highlighted red. */
function RosterArchiveCalendar({ rows, loading }: { rows: any[]; loading: boolean }) {
  const today = toDateOnly(new Date());
  const past = rows.filter((r) => r.service_date < today);

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of past) m.set(r.service_date, [...(m.get(r.service_date) ?? []), r]);
    return m;
  }, [rows]);

  const dates = useMemo(
    () => Array.from(byDate.keys()).sort().reverse(),
    [byDate],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const active = selected && byDate.has(selected) ? selected : dates[0] ?? null;
  const activeRows = active ? byDate.get(active) ?? [] : [];

  const markedDays = useMemo(
    () => dates.map((d) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd); }),
    [dates],
  );

  if (loading) return <div className="text-sm text-muted-foreground">Loading archive…</div>;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  return (
    <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
      <Card className="shadow-card">
        <CardHeader className="border-b bg-gradient-subtle">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-primary" /> Last 3 months
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <Calendar
            mode="single"
            selected={active ? new Date(Number(active.slice(0, 4)), Number(active.slice(5, 7)) - 1, Number(active.slice(8, 10))) : undefined}
            onSelect={(d) => { if (d) setSelected(toDateOnly(d)); }}
            fromDate={threeMonthsAgo}
            toDate={new Date()}
            modifiers={{ hasRoster: markedDays }}
            modifiersClassNames={{ hasRoster: "bg-destructive/15 font-bold text-destructive rounded-md" }}
            className="pointer-events-auto p-1"
          />
          <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-destructive align-middle" />
            Days with a roster. Rosters older than 3 months are cleared automatically.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {active ? (
          <Card className="shadow-card overflow-hidden">
            <CardHeader className="border-b bg-gradient-subtle">
              <CardTitle className="text-base sm:text-xl">{formatServiceDate(active)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Camera</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead className="hidden md:table-cell">Frame / Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRows.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">{serviceLabel(r.service_type)}</TableCell>
                        <TableCell>
                          <Badge className="bg-primary/12 font-semibold text-primary hover:bg-primary/12">{r.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.camera && r.camera !== "—"
                            ? <Badge className="bg-warning/15 font-semibold text-warning hover:bg-warning/15">{r.camera}</Badge>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {r.profiles?.full_name
                            ? <Badge className="bg-success/15 font-semibold text-success hover:bg-success/15">{r.profiles.full_name}</Badge>
                            : <span className="text-muted-foreground">Unassigned</span>}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{r.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardContent className="p-10 text-center text-muted-foreground">
              No rosters in the last 3 months.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
