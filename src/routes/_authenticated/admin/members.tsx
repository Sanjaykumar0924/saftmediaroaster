import { SENIORITY_OPTIONS, seniorityClass, seniorityLabel } from "@/lib/saft";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  adminCreateMember, adminSeedPreloaded, adminDeleteMember, adminResetPassword, adminUpdateMember,
  adminSetAdminRole, getMemberRoles,
} from "@/lib/admin.functions";
import { saSetSuperAdminRole } from "@/lib/super-admin.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PlusCircle, UserPlus, Search, Sparkles, Trash2, MoreVertical, KeyRound, Camera, PencilLine, ShieldCheck, Crown } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";


export const Route = createFileRoute("/_authenticated/admin/members")({
  beforeLoad: async () => {
    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user ?? (await supabase.auth.getUser()).data.user;
    if (!user) throw redirect({ to: "/auth", search: { mode: "admin" } as any });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const stillNotAdmin = !(userRoles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
      if (stillNotAdmin) throw redirect({ to: "/dashboard" });
    }
  },
  component: MembersPage,
});

function MembersPage() {
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const [search, setSearch] = useState("");
  const [seeding, setSeeding] = useState(false);
  const seedFn = useServerFn(adminSeedPreloaded);
  const deleteFn = useServerFn(adminDeleteMember);
  const updateFn = useServerFn(adminUpdateMember);
  const adminRoleFn = useServerFn(adminSetAdminRole);
  const superRoleFn = useServerFn(saSetSuperAdminRole);
  const fetchRolesFn = useServerFn(getMemberRoles);

  const q = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      return data ?? [];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["member-roles"],
    queryFn: async () => {
      const map = await fetchRolesFn();
      return map as Record<string, string[]>;
    },
  });
  const rolesOf = (id: string): string[] => rolesQ.data?.[id] ?? [];

  const setAdmin = async (m: any, make: boolean) => {
    try {
      await adminRoleFn({ data: { user_id: m.id, make_admin: make } });
      toast.success(make ? `${m.full_name} is now an admin` : `Admin access removed from ${m.full_name}`);
      qc.invalidateQueries({ queryKey: ["member-roles"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const setSuper = async (m: any, make: boolean) => {
    try {
      await superRoleFn({ data: { user_id: m.id, make_super_admin: make } });
      toast.success(make ? `${m.full_name} is now a super admin` : `Super admin access removed from ${m.full_name}`);
      qc.invalidateQueries({ queryKey: ["member-roles"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  useRealtimeInvalidate({
    table: "profiles",
    queryKeys: [["all-profiles"], ["roster-members"]],
  });


  const rows = (q.data ?? []).filter((m: any) =>
    !search.trim() ||
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.username?.toLowerCase().includes(search.toLowerCase()),
  );

  const seedMembers = async () => {
    setSeeding(true);
    try {
      const res = await seedFn();
      if (res.created > 0) toast.success(`Added ${res.created} preloaded members (password: <username>1234)`);
      else toast.message("All preloaded members already exist");
    } catch (e: any) { toast.error(e?.message ?? "Failed to seed"); }
    setSeeding(false);
    qc.invalidateQueries({ queryKey: ["all-profiles"] });
  };

  const toggleActive = async (m: any) => {
    try {
      await updateFn({ data: { user_id: m.id, is_active: !m.is_active } });
      toast.success(`${m.full_name} ${!m.is_active ? "activated" : "deactivated"}`);
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the SAFT Media Team roster.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={seedMembers} disabled={seeding} className="min-h-11">
            <Sparkles className="mr-2 h-4 w-4" /> {seeding ? "Adding…" : "Seed Preloaded"}
          </Button>
          <AddMemberDialog onCreated={() => qc.invalidateQueries({ queryKey: ["all-profiles"] })} />
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Team ({rows.length})</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…" className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden md:table-cell">Username</TableHead>
                  <TableHead className="hidden lg:table-cell">Level</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          {m.photo_url && <AvatarImage src={m.photo_url} alt={m.full_name} />}
                          <AvatarFallback className="bg-primary text-primary-foreground">{m.full_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{m.full_name}</div>
                          <div className="truncate text-xs text-muted-foreground md:hidden">@{m.username}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {m.seniority && (
                              <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold lg:hidden", seniorityClass(m.seniority))}>
                                {seniorityLabel(m.seniority)}
                              </span>
                            )}
                            {rolesOf(m.id).includes("super_admin") && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                <Crown className="h-3 w-3" /> Super Admin
                              </span>
                            )}
                            {rolesOf(m.id).includes("admin") && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                <ShieldCheck className="h-3 w-3" /> Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">@{m.username}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {m.seniority ? (
                        <Badge className={cn("font-semibold hover:opacity-100", seniorityClass(m.seniority))}>{seniorityLabel(m.seniority)}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{m.phone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><Switch checked={!!m.is_active} onCheckedChange={() => toggleActive(m)} /></TableCell>
                    <TableCell className="text-right">
                      <MemberActions
                        member={m}
                        onChange={() => qc.invalidateQueries({ queryKey: ["all-profiles"] })}
                        deleteFn={deleteFn}
                        canManageRoles={isAdmin || isSuperAdmin}
                        roles={rolesOf(m.id)}
                        isSelf={m.id === user?.id}
                        onSetAdmin={setAdmin}
                        onSetSuper={setSuper}
                      />
                    </TableCell>

                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No members yet. Click "Seed Preloaded" to add the SAFT team.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberActions({
  member, onChange, deleteFn, canManageRoles, roles, isSelf, onSetAdmin, onSetSuper,
}: {
  member: any; onChange: () => void; deleteFn: any;
  canManageRoles?: boolean; roles?: string[]; isSelf?: boolean;
  onSetAdmin?: (m: any, make: boolean) => void; onSetSuper?: (m: any, make: boolean) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const isAdminRole = (roles ?? []).includes("admin");
  const isSuperRole = (roles ?? []).includes("super_admin");
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions"><MoreVertical className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}><PencilLine className="mr-2 h-4 w-4" /> Edit / Upload photo</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPwOpen(true)}><KeyRound className="mr-2 h-4 w-4" /> Reset password</DropdownMenuItem>
          {canManageRoles && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSetAdmin?.(member, !isAdminRole)}>
                <ShieldCheck className="mr-2 h-4 w-4" /> {isAdminRole ? "Remove admin access" : "Make admin"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isSuperRole && isSelf}
                onClick={() => {
                  if (isSuperRole && !confirm(`Remove super admin access from ${member.full_name}?`)) return;
                  onSetSuper?.(member, !isSuperRole);
                }}
              >
                <Crown className="mr-2 h-4 w-4" /> {isSuperRole ? "Revoke super admin" : "Make super admin"}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDelOpen(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>


      <EditMemberDialog open={editOpen} onOpenChange={setEditOpen} member={member} onSaved={onChange} />
      <ResetPasswordDialog open={pwOpen} onOpenChange={setPwOpen} member={member} />

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {member.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes their login and profile. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await deleteFn({ data: { user_id: member.id } });
                  toast.success("Member deleted");
                  onChange();
                } catch (e: any) { toast.error(e?.message ?? "Failed"); }
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditMemberDialog({ open, onOpenChange, member, onSaved }: any) {
  const updateFn = useServerFn(adminUpdateMember);
  const [fullName, setFullName] = useState(member.full_name ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [seniority, setSeniority] = useState<string>(member.seniority ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploading(true);
    try {
      const path = `${member.id}/avatar-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      await updateFn({ data: { user_id: member.id, photo_url: signed?.signedUrl ?? null } });
      toast.success("Photo updated");
      onSaved();
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    setUploading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFn({ data: { user_id: member.id, full_name: fullName, phone: phone || null, seniority: seniority || null } });
      toast.success("Member updated");
      onSaved();
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {member.full_name}</DialogTitle>
          <DialogDescription>Update details and profile photo.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 py-2">
          <Avatar className="h-16 w-16">
            {member.photo_url && <AvatarImage src={member.photo_url} alt={member.full_name} />}
            <AvatarFallback className="bg-primary text-primary-foreground">{member.full_name?.[0]}</AvatarFallback>
          </Avatar>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Camera className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Upload photo"}
          </Button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div>
              <Label>Level</Label>
              <Select value={seniority || undefined} onValueChange={setSeniority}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {SENIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="bg-gradient-primary">{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ open, onOpenChange, member }: any) {
  const resetFn = useServerFn(adminResetPassword);
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) { toast.error("At least 6 characters"); return; }
    setSaving(true);
    try {
      await resetFn({ data: { user_id: member.id, new_password: pw } });
      toast.success(`Password reset for ${member.full_name}`);
      setPw("");
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    setSaving(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {member.full_name}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>New password</Label>
            <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter new password" autoFocus />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="bg-gradient-primary">
              <KeyRound className="mr-2 h-4 w-4" /> {saving ? "Updating…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({ onCreated }: { onCreated: () => void }) {
  const createFn = useServerFn(adminCreateMember);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [seniority, setSeniority] = useState<string>("newbie");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || password.length < 6) { toast.error("Username + 6-char password required"); return; }
    setSaving(true);
    try {
      await createFn({ data: {
        username, password, full_name: fullName || username,
        phone: phone || undefined, seniority: seniority || undefined,
      } });
      setOpen(false);
      setFullName(""); setUsername(""); setPassword(""); setPhone(""); setSeniority("newbie");
      toast.success("Member added");
      onCreated();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-11 bg-gradient-primary shadow-elegant"><UserPlus className="mr-2 h-4 w-4" /> Add Member</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>Create a login for a new SAFT media volunteer.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
            <div><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
          </div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div>
              <Label>Level</Label>
              <Select value={seniority} onValueChange={setSeniority}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {SENIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="min-h-11 bg-gradient-primary" disabled={saving}>
              <PlusCircle className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
