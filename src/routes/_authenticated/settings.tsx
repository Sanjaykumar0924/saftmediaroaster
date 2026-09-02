import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { getAdminAccessKey, setAdminAccessKey } from "@/lib/app-settings";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, Camera, Save, ShieldAlert, Trash2 } from "lucide-react";
import { usernameToEmail } from "@/lib/saft";
import { changeMyUsername, changeMyPassword } from "@/lib/account.functions";
import { adminWipeTestData } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter current password"),
    next: z.string().min(6, "At least 6 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function SettingsPage() {
  const { profile, refresh, isAdmin } = useAuth();

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update your password, phone, and profile photo.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard profile={profile} onSaved={refresh} />
        <PasswordCard profile={profile} />
        {isAdmin && <AdminKeyCard />}
        {isAdmin && <DangerZoneCard />}
      </div>
    </div>
  );
}

function DangerZoneCard() {
  const [rosters, setRosters] = useState(true);
  const [checklists, setChecklists] = useState(true);
  const [attendance, setAttendance] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const wipe = async () => {
    if (!rosters && !checklists && !attendance) { toast.error("Select at least one type of data"); return; }
    if (confirm.trim().toUpperCase() !== "ERASE") { toast.error('Type ERASE to confirm'); return; }
    setBusy(true);
    try {
      const res: any = await adminWipeTestData({ data: { rosters, checklists, attendance } });
      toast.success(
        `Erased ${res.rosters ?? 0} roster entries, ${res.services ?? 0} MPZ services and ${res.attendance ?? 0} attendance records`,
      );
      setConfirm("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not erase data");
    }
    setBusy(false);
  };

  return (
    <Card className="border-destructive/40 shadow-card lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" /> Danger Zone — Erase test data
        </CardTitle>
        <CardDescription>
          Permanently delete every roster you made for testing, all checklist / MPZ service data and attendance
          records. Members, teams, equipment and messages are not touched. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" checked={rosters} onChange={(e) => setRosters(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <span className="block text-sm font-medium">All rosters</span>
            <span className="block text-xs text-muted-foreground">Every draft and published roster assignment.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" checked={checklists} onChange={(e) => setChecklists(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <span className="block text-sm font-medium">All checklists &amp; MPZ services</span>
            <span className="block text-xs text-muted-foreground">Services, ticked items, member reports and shares.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" checked={attendance} onChange={(e) => setAttendance(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <span className="block text-sm font-medium">All attendance records</span>
            <span className="block text-xs text-muted-foreground">Every present / absent / late / excused mark and analytics history.</span>
          </span>
        </label>
        <div className="space-y-2">
          <Label htmlFor="wipe-confirm">Type ERASE to confirm</Label>
          <Input id="wipe-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ERASE" className="min-h-11" autoComplete="off" />
        </div>
        <Button variant="destructive" onClick={wipe} disabled={busy} className="min-h-11 w-full sm:w-auto">
          <Trash2 className="mr-2 h-4 w-4" /> {busy ? "Erasing…" : "Erase selected data"}
        </Button>
      </CardContent>
    </Card>
  );
}


function AdminKeyCard() {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    getAdminAccessKey().then(setValue);
  }, []);

  const save = async () => {
    if (value.trim().length < 6) { toast.error("Access key must be at least 6 characters"); return; }
    setSaving(true);
    try {
      await setAdminAccessKey(value);
      toast.success("Admin access key updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update key");
    }
    setSaving(false);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Admin Access Key</CardTitle>
        <CardDescription>Required when a new admin account is registered. Share it only with trusted leaders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Access key</Label>
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-11 font-mono"
            autoComplete="off"
          />
        </div>
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShow((s) => !s)}>
            {show ? <><EyeOff className="mr-2 h-4 w-4" /> Hide</> : <><Eye className="mr-2 h-4 w-4" /> Show</>}
          </Button>
          <Button onClick={save} disabled={saving} className="min-h-11 bg-gradient-primary">
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save key"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function ProfileCard({ profile, onSaved }: { profile: any; onSaved: () => Promise<void> }) {
  const [phone, setPhone] = useState<string>(profile?.phone ?? "");
  const [username, setUsername] = useState<string>(profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhone(profile?.phone ?? "");
    setUsername(profile?.username ?? "");
  }, [profile?.id, profile?.phone, profile?.username]);

  const savePhone = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ phone: phone || null }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Phone updated"); await onSaved(); }
  };

  const saveUsername = async () => {
    const next = username.trim().toLowerCase();
    if (!next || next === (profile?.username ?? "").toLowerCase()) { toast.error("Enter a new username"); return; }
    setSavingUser(true);
    try {
      await changeMyUsername({ data: { username: next } });
      toast.success(`Username changed to ${next}. Use it next time you sign in.`);
      await onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change username");
    }
    setSavingUser(false);
  };

  const uploadPhoto = async (file: File) => {
    if (!profile?.id) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? null;
      const { error: pErr } = await supabase.from("profiles").update({ photo_url: url }).eq("id", profile.id);
      if (pErr) throw pErr;
      toast.success("Photo updated");
      await onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    }
    setUploading(false);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Only phone and profile photo can be changed. Contact an admin for name changes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {profile?.photo_url && <AvatarImage src={profile.photo_url} alt={profile.full_name} />}
            <AvatarFallback className="bg-primary text-lg text-primary-foreground">
              {(profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2">
            <div className="truncate font-semibold">{profile?.full_name}</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="min-h-10">
              <Camera className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Change photo"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Full name</Label>
          <Input value={profile?.full_name ?? ""} disabled className="opacity-70" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="flex gap-2">
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="min-h-11"
              autoComplete="off"
            />
            <Button variant="outline" onClick={saveUsername} disabled={savingUser} className="min-h-11 shrink-0">
              {savingUser ? "Saving…" : "Update"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">You'll sign in with this username from next time.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0123" className="min-h-11" />
        </div>
        <Button onClick={savePhone} disabled={saving} className="min-h-11 bg-gradient-primary">
          <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PasswordCard({ profile }: { profile: any }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse({ current, next, confirm });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!profile?.username) { toast.error("Missing profile"); return; }
    setSaving(true);
    // Verify current password by re-signing in
    const email = usernameToEmail(profile.username);
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (signErr) { toast.error("Current password is incorrect"); setSaving(false); return; }
    try {
      await changeMyPassword({ data: { new_password: next } });
      toast.success("Password updated");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update password");
    }
    setSaving(false);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Change Password</CardTitle>
        <CardDescription>Any password you like — e.g. your name and a number. Minimum 6 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <PwField label="Current password" value={current} onChange={setCurrent} show={show} />
          <PwField label="New password" value={next} onChange={setNext} show={show} />
          <PwField label="Confirm new password" value={confirm} onChange={setConfirm} show={show} />
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShow((s) => !s)}>
              {show ? <><EyeOff className="mr-2 h-4 w-4" /> Hide</> : <><Eye className="mr-2 h-4 w-4" /> Show</>}
            </Button>
            <Button type="submit" disabled={saving} className="min-h-11 bg-gradient-primary">
              <ShieldAlert className="mr-2 h-4 w-4" /> {saving ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PwField({ label, value, onChange, show }: { label: string; value: string; onChange: (v: string) => void; show: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11" autoComplete="new-password" />
    </div>
  );
}
