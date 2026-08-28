import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { MessagesSquare, Send, Trash2, Lock, LockOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { getMemberDirectory } from "@/lib/directory.functions";
import { seniorityClass, seniorityLabel } from "@/lib/saft";


export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Team Messages — SAFT Media Team" },
      { name: "description", content: "Group chat for SAFT Media Team members and admins." },
    ],
  }),
});

function MessagesPage() {
  const qc = useQueryClient();
  const { user, profile, isAdmin } = useAuth();
  const dirFn = useServerFn(getMemberDirectory);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const settingsQ = useQuery({
    queryKey: ["chat-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("chat_settings").select("*").maybeSingle();
      return data;
    },
  });

  const dirQ = useQuery({ queryKey: ["chat-directory"], queryFn: () => dirFn({ data: {} }) });

  const messagesQ = useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages").select("*").order("created_at", { ascending: true }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  useRealtimeInvalidate({ table: "messages", queryKeys: [["messages"]] });

  const people = useMemo(
    () => new Map((dirQ.data ?? []).map((p: any) => [p.id, p])),
    [dirQ.data],
  );

  const messages = messagesQ.data ?? [];
  const locked = settingsQ.data ? !settingsQ.data.members_can_send : false;
  const canSend = isAdmin || !locked;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!body.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      sender_name: profile?.full_name ?? profile?.username ?? "Member",
      body: body.trim(),
    } as any);
    setSending(false);
    if (error) { toast.error(locked ? "Only admins can post right now" : error.message); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const toggleLock = async (membersCanSend: boolean) => {
    const { error } = await supabase.from("chat_settings").update({ members_can_send: membersCanSend } as any).eq("id", true);
    if (error) { toast.error(error.message); return; }
    toast.success(membersCanSend ? "Everyone can post" : "Announcements only — admins can post");
    qc.invalidateQueries({ queryKey: ["chat-settings"] });
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <MessagesSquare className="h-6 w-6 text-primary" /> Messages
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One group for the whole media team — members and admins together.
          </p>
          <p className="mt-1 text-xs font-medium text-warning">
            Chat clears automatically every week — messages older than 7 days are removed.
          </p>
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-card">
            {locked ? <Lock className="h-4 w-4 text-warning" /> : <LockOpen className="h-4 w-4 text-success" />}
            <span className="text-xs font-medium">Members can post</span>
            <Switch checked={!locked} onCheckedChange={toggleLock} />
          </div>
        ) : (
          locked && (
            <Badge className="bg-warning/15 font-semibold text-warning hover:bg-warning/15">
              <Lock className="mr-1 h-3 w-3" /> Announcements only
            </Badge>
          )
        )}
      </div>

      <Card className="shadow-card overflow-hidden">
        <CardHeader className="border-b bg-gradient-subtle py-3">
          <CardTitle className="text-sm font-semibold">Media Team group</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 bg-muted/20 p-3 sm:p-4">
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {messages.map((m: any) => {
              const mine = m.sender_id === user?.id;
              const p: any = people.get(m.sender_id);
              const name = p?.full_name ?? m.sender_name ?? "Member";
              return (
                <div key={m.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                  <Avatar className="h-8 w-8 shrink-0">
                    {p?.photo_url && <AvatarImage src={p.photo_url} alt={name} />}
                    <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">
                      {name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "group max-w-[80%] rounded-2xl px-3 py-2 shadow-card",
                      mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card",
                    )}
                  >
                    {!mine && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-primary">{name}</span>
                        {seniorityLabel(p?.seniority) && (
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", seniorityClass(p?.seniority))}>
                            {seniorityLabel(p?.seniority)}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
                    <div className={cn("mt-1 flex items-center gap-2 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      {(mine || isAdmin) && (
                        <button
                          onClick={() => remove(m.id)}
                          aria-label="Delete message"
                          className="opacity-100 transition-smooth sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hello 👋</p>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={1}
              disabled={!canSend}
              placeholder={canSend ? "Write a message…" : "Only admins can post right now"}
              className="min-h-11 resize-none border-0 shadow-none focus-visible:ring-0"
            />
            <Button
              onClick={send}
              disabled={sending || !body.trim() || !canSend}
              className="min-h-11 bg-gradient-primary shadow-elegant"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
