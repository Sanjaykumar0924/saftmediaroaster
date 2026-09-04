import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, CalendarCheck2, ClipboardList, Users, BarChart3,
  ShieldCheck, LogOut, Bell, ChevronDown, UserCircle2, Megaphone, ListChecks,
  Menu, Settings, CheckCheck, Boxes, MessagesSquare, Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface NavItem { to: string; label: string; icon: any; admin?: boolean; memberOnly?: boolean; badge?: "messages" | "checklist" | "roster" | "shares" }

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: "roster" },
  { to: "/admin/attendance", label: "Attendance", icon: Megaphone, admin: true },
  { to: "/availability", label: "Availability", icon: CalendarCheck2 },
  { to: "/checklist", label: "My Checklists", icon: CheckCheck, memberOnly: true, badge: "shares" },
  { to: "/messages", label: "Messages", icon: MessagesSquare, badge: "messages" },
  { to: "/roster", label: "Roster", icon: ClipboardList, badge: "roster" },
  { to: "/admin", label: "Admin Overview", icon: ShieldCheck, admin: true },
  { to: "/admin/roster", label: "Build Roster", icon: ListChecks, admin: true },
  { to: "/admin/equipment", label: "Database", icon: Boxes, admin: true },

  { to: "/admin/checklist", label: "Checklist", icon: ListChecks, admin: true, badge: "checklist" },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, admin: true },
  { to: "/admin/members", label: "Members", icon: Users, admin: true },
  { to: "/settings", label: "Settings", icon: Settings },
];


const SEEN_KEY = (kind: string, uid: string) => `saft:lastSeen:${kind}:${uid}`;
const readSeen = (kind: string, uid?: string) => {
  if (!uid || typeof window === "undefined") return null;
  return window.localStorage.getItem(SEEN_KEY(kind, uid));
};

/** Unread counters for the sidebar: new team messages, and new checklist reports for admins. */
function useMenuBadges() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const messagesQ = useQuery({
    queryKey: ["unread-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = readSeen("messages", user!.id);
      let q = supabase.from("messages").select("id, sender_id", { count: "exact", head: false }).limit(50);
      if (since) q = q.gt("created_at", since);
      const { data } = await q;
      return (data ?? []).filter((m: any) => m.sender_id !== user!.id).length;
    },
  });

  const checklistQ = useQuery({
    queryKey: ["unread-checklist", user?.id],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const since = readSeen("checklist", user!.id);
      let q = supabase.from("checklist_reports").select("id").limit(50);
      if (since) q = q.gt("created_at", since);
      const { data } = await q;
      return (data ?? []).length;
    },
  });

  // Checklists an admin shared with this user (members and fellow admins alike).
  const sharesQ = useQuery({
    queryKey: ["unread-shares", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = readSeen("shares", user!.id);
      let q = supabase
        .from("checklist_shares")
        .select("id")
        .eq("recipient_id", user!.id)
        .limit(50);
      if (since) q = q.gt("created_at", since);
      const { data } = await q;
      return (data ?? []).length;
    },
  });

  // Newly published rosters where THIS member is actually assigned, and that the member hasn't looked at yet.
  const rosterQ = useQuery({
    queryKey: ["unread-roster", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = readSeen("roster", user!.id);
      if (!since) {
        // First visit on this device: establish a baseline instead of flagging every old roster.
        window.localStorage.setItem(SEEN_KEY("roster", user!.id), new Date().toISOString());
        return 0;
      }
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("roster")
        .select("published_at, service_date")
        .eq("status", "published")
        .eq("assigned_user_id", user!.id)
        .not("published_at", "is", null)
        .gte("service_date", today)
        .gt("published_at", since)
        .limit(100);
      // one badge count per published service date the member is assigned to
      return new Set((data ?? []).map((r: any) => r.service_date)).size;
    },
  });


  useRealtimeInvalidate({ table: "messages", queryKeys: [["unread-messages", user?.id]] });
  useRealtimeInvalidate({
    table: "checklist_reports",
    queryKeys: [["unread-checklist", user?.id]],
    onChange: () => {
      if (isAdmin) toast("📋 Checklist update from a member");
    },
  });
  useRealtimeInvalidate({ table: "roster", queryKeys: [["unread-roster", user?.id]] });
  useRealtimeInvalidate({
    table: "checklist_shares",
    filter: user ? `recipient_id=eq.${user.id}` : undefined,
    queryKeys: [["unread-shares", user?.id], ["my-checklists", user?.id]],
    onChange: (payload) => {
      if (payload.eventType === "INSERT") toast("📋 A checklist was shared with you");
    },
  });

  // Visiting a page clears its badge.
  useEffect(() => {
    if (!user) return;
    const kind = pathname.startsWith("/messages")
      ? "messages"
      : pathname.startsWith("/admin/checklist")
        ? "checklist"
        : pathname.startsWith("/checklist")
          ? "shares"
          : pathname.startsWith("/roster") || pathname.startsWith("/dashboard")
            ? "roster"
            : null;
    if (!kind) return;
    // small delay so the badge is visible for a moment before it clears
    const t = window.setTimeout(() => {
      window.localStorage.setItem(SEEN_KEY(kind, user.id), new Date().toISOString());
      qc.invalidateQueries({ queryKey: [`unread-${kind}`, user.id] });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [pathname, user?.id]);


  return {
    messages: messagesQ.data ?? 0,
    // Admins see member reports plus checklists shared with them on the same tab.
    checklist: (checklistQ.data ?? 0) + (isAdmin ? sharesQ.data ?? 0 : 0),
    roster: rosterQ.data ?? 0,
    shares: sharesQ.data ?? 0,
  };

}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((n) => (n.admin ? isAdmin : true) && (n.memberOnly ? !isAdmin : true));
  const [mobileOpen, setMobileOpen] = useState(false);
  const badges = useMenuBadges();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-1 px-3">
      {items.map((item) => {
        const active = pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to));
        const count = item.badge ? badges[item.badge] : 0;
        return (
          <Link
            key={item.to}
            to={item.to as any}
            onClick={onClick}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-smooth",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-elegant"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {count > 0 && !active && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );


  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-6 py-6">
          <BrandLogo variant="on-dark" logo="login" showSubtitle={false} title="Media" />
        </div>
        <ScrollArea className="flex-1">
          <NavList />
        </ScrollArea>
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-xl bg-sidebar-accent p-3 text-xs text-sidebar-foreground/80">
            <div className="font-semibold text-sidebar-foreground">Serving with Excellence</div>
            <div className="mt-1 text-sidebar-foreground/60">SAFT Church · Media Team</div>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              {/* Mobile hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
                  <SheetHeader className="px-6 pt-6">
                    <SheetTitle className="text-left">
                      <BrandLogo variant="on-dark" logo="login" showSubtitle={false} title="Media" />
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <NavList onClick={() => setMobileOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>

              {isAdmin && (
                <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary md:inline-flex">
                  {isSuperAdmin ? "Super Admin" : "Admin"}
                </span>
              )}
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 pl-1 pr-2 sm:pl-2 sm:pr-3">
                    <Avatar className="h-8 w-8">
                      {profile?.photo_url && <AvatarImage src={profile.photo_url} alt={profile.full_name} />}
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {(profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{profile?.full_name ?? "Member"}</span>
                    <ChevronDown className="hidden h-3 w-3 opacity-60 sm:inline" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm font-semibold">{profile?.full_name}</div>
                    <div className="text-xs text-muted-foreground">@{profile?.username}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                    <UserCircle2 className="mr-2 h-4 w-4" /> My Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

function NotificationBell() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useRealtimeInvalidate({
    table: "notifications",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    queryKeys: [["notifications", user?.id]],
    onChange: (payload) => {
      if (payload.eventType === "INSERT" && payload.new?.title) {
        toast(`🔔 ${payload.new.title}`, { description: payload.new.body ?? undefined });
      }
    },
  });

  const items = q.data ?? [];
  const unread = items.filter((n: any) => !n.read).length;

  // Clicking a notification marks it read and jumps to the page it refers to.
  const openNotification = async (n: any) => {
    setOpen(false);
    if (!n.read && user) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    }
    navigate({ to: notificationTarget(n.kind, isAdmin) });
  };

  const markAllRead = async () => {
    setOpen(false);
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const clearAll = async () => {
    if (!user || items.length === 0) return;
    setOpen(false);
    const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
    if (error) {
      toast.error("Could not clear notifications");
      return;
    }
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    toast.success("Notifications cleared");
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[92vw] max-w-sm p-0 sm:w-96">
        <div className="flex items-center justify-between gap-1 border-b p-3">
          <div className="text-sm font-semibold">Notifications</div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0} className="h-8 px-2">
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={items.length === 0}
              className="h-8 px-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear all
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            <ul className="divide-y">
              {items.map((n: any) => (
                <li key={n.id} className={cn(!n.read && "bg-primary/5")}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className="w-full p-3 text-left transition-smooth hover:bg-muted/60"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{n.title}</div>
                        {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
                      </div>
                      <div className="shrink-0 text-[10px] text-muted-foreground">
                        {safeAgo(n.created_at)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/** Where a notification should take the user when tapped. */
function notificationTarget(kind: string | null | undefined, isAdmin: boolean): string {
  switch (kind) {
    case "checklist":
      return isAdmin ? "/admin/checklist" : "/checklist";
    case "roster":
      return "/roster";
    case "availability":
      return "/availability";
    case "message":
    case "announcement":
      return "/messages";
    case "member":
      return isAdmin ? "/admin/members" : "/settings";
    default:
      return "/dashboard";
  }
}

function safeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}
