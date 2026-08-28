import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ListChecks, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatServiceDate } from "@/lib/saft";
import { useAuth } from "@/lib/auth";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import { submitChecklistReport } from "@/lib/checklist.functions";

export const Route = createFileRoute("/_authenticated/checklist")({
  component: MemberChecklistPage,
  head: () => ({
    meta: [
      { title: "My MPZ Checklists — SAFT Media Team" },
      { name: "description", content: "Checklists shared with you for carrying equipment to MPZ and back." },
    ],
  }),
});

function MemberChecklistPage() {
  const { user } = useAuth();
  const [serviceId, setServiceId] = useState<string | null>(null);

  const sharesQ = useQuery({
    queryKey: ["my-checklists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: shares, error } = await supabase
        .from("checklist_shares")
        .select("service_id, created_at")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((shares ?? []).map((s: any) => s.service_id)));
      if (ids.length === 0) return [];
      const { data: services } = await supabase
        .from("mpc_services").select("*").in("id", ids).order("service_date", { ascending: false });
      return services ?? [];
    },
  });

  const services = sharesQ.data ?? [];
  const active = serviceId ?? services[0]?.id ?? null;
  const activeService = services.find((s: any) => s.id === active);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <ListChecks className="h-6 w-6 text-primary" /> My Checklists
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tick each item as you carry it to MPZ, then tick it back in when it returns to SAFT Church.
        </p>
      </div>

      {services.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            {sharesQ.isLoading ? "Loading…" : "No checklist has been shared with you yet."}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow-card">
            <CardHeader className="border-b bg-gradient-subtle">
              <CardTitle className="text-base">Shared with me</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {services.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => setServiceId(s.id)}
                    className={cn(
                      "min-h-11 rounded-xl border px-3 py-2 text-left text-sm transition-smooth",
                      s.id === active
                        ? "border-primary bg-primary/10 font-semibold text-primary shadow-elegant"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <div className="font-semibold">{formatServiceDate(s.service_date)}</div>
                    <div className="text-xs text-muted-foreground">{s.name}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {active && (
            <ChecklistBoard
              key={active}
              serviceId={active}
              footer={({ going, back, allBack }) => (
                <ReportActions
                  serviceId={active}
                  serviceLabel={activeService?.name ?? ""}
                  going={going}
                  back={back}
                  allBack={allBack}
                />
              )}
            />
          )}
        </>
      )}
    </div>
  );
}

function ReportActions({
  serviceId, serviceLabel, going, back, allBack,
}: {
  serviceId: string; serviceLabel: string; going: number; back: number; allBack: boolean;
}) {
  const qc = useQueryClient();
  const reportFn = useServerFn(submitChecklistReport);
  const [issueOpen, setIssueOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (kind: "safe" | "issue") => {
    setBusy(true);
    try {
      await reportFn({ data: { service_id: serviceId, kind, comment: kind === "issue" ? comment : undefined } });
      toast.success(kind === "safe" ? "Admins notified — everything returned safely" : "Issue sent to all admins");
      setIssueOpen(false);
      setComment("");
      qc.invalidateQueries({ queryKey: ["checklist-reports", serviceId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send");
    }
    setBusy(false);
  };

  return (
    <Card className="shadow-card">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{serviceLabel}</div>
          <div className="text-xs text-muted-foreground">{back} of {going} carried items returned</div>
          {allBack && (
            <Badge className="mt-1 bg-success/15 font-semibold text-success hover:bg-success/15">
              Ready to confirm safe return
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11 border-destructive/40 text-destructive hover:text-destructive"
            onClick={() => setIssueOpen(true)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" /> Report an issue
          </Button>
          <Button
            className="min-h-11 bg-gradient-primary shadow-elegant"
            disabled={busy || !allBack}
            onClick={() => send("safe")}
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> All returned safely
          </Button>
        </div>
      </CardContent>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
            <DialogDescription>Missing or damaged equipment? This message goes to every admin.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="e.g. Cam 2 HDMI cable is missing after the MPZ service"
          />
          <DialogFooter>
            <Button
              className="min-h-11 bg-gradient-primary"
              disabled={busy || !comment.trim()}
              onClick={() => send("issue")}
            >
              {busy ? "Sending…" : "Send to admins"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
