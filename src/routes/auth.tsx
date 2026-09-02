import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandLogo } from "@/components/BrandLogo";
import { usernameToEmail } from "@/lib/saft";

import { useServerFn } from "@tanstack/react-start";
import { claimAdminRole } from "@/lib/account.functions";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, ShieldCheck, User } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["member", "admin"]).catch("member"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading, isAdmin } = useAuth();
  const [tab, setTab] = useState<"member" | "admin">(mode);

  useEffect(() => setTab(mode), [mode]);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [session, loading, isAdmin, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-hero">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, oklch(0.55 0.24 27 / 0.4), transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.55 0.24 27 / 0.3), transparent 50%)" }} />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <button onClick={() => navigate({ to: "/" })} className="mb-6 inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground">
          <ArrowLeft className="h-4 w-4" /> Back home
        </button>
        <div className="mb-6 flex justify-center">
          <BrandLogo variant="on-dark" size="lg" logo="church" />
        </div>
        <div className="glass rounded-3xl border border-primary-foreground/10 p-8 shadow-elegant">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="member"><User className="mr-2 h-4 w-4" /> Member</TabsTrigger>
              <TabsTrigger value="admin"><ShieldCheck className="mr-2 h-4 w-4" /> Admin</TabsTrigger>
            </TabsList>
            <TabsContent value="member" className="mt-6">
              <MemberLogin />
            </TabsContent>
            <TabsContent value="admin" className="mt-6">
              <AdminAuth />
            </TabsContent>
          </Tabs>
        </div>
        <p className="mt-6 text-center text-xs text-primary-foreground/60">
          Serving God with Excellence through Media.
        </p>
      </div>
    </div>
  );
}

function MemberLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("Invalid username or password");
    } else {
      toast.success(`Welcome back, ${username}!`);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Team Member Login</h2>
        <p className="text-sm text-muted-foreground">Access your dashboard</p>
      </div>
      <div>
        <Label htmlFor="m-user">Username</Label>
        <Input id="m-user" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Sanjay" required />
      </div>
      <div>
        <Label htmlFor="m-pass">Password</Label>
        <Input id="m-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full bg-gradient-primary shadow-elegant" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Don't have an account? Ask an admin to create one for you.
      </p>
    </form>
  );
}

function AdminAuth() {
  const [tab, setTab] = useState<"signin" | "register">("signin");
  return (
    <div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className="mt-6">
          <AdminSignIn />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <AdminRegister />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminSignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error) {
      setLoading(false);
      toast.error("Invalid credentials");
      return;
    }
    setLoading(false);
    toast.success("Welcome, admin");
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Admin Sign In</h2>
        <p className="text-sm text-muted-foreground">Admin dashboard access</p>
      </div>
      <div>
        <Label>Admin Username</Label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div>
        <Label>Password</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full bg-gradient-primary shadow-elegant" disabled={loading}>
        {loading ? "Signing in…" : "Sign in as Admin"}
      </Button>
    </form>
  );
}



function AdminRegister() {
  const claimFn = useServerFn(claimAdminRole);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim(), full_name: fullName.trim() || username.trim() } },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    // Sign in to obtain session so we can grant admin role under RLS
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !data.user) {
      setLoading(false);
      toast.error(signInErr?.message ?? "Sign-in failed after registration");
      return;
    }
    try {
      await claimFn({ data: { access_key: accessKey.trim() } });
      toast.success("Admin account created!");
    } catch (roleErr: any) {
      toast.error(roleErr?.message ?? "Could not grant admin role");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Register as Admin</h2>
        <p className="text-sm text-muted-foreground">Requires the SAFT admin access key</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Sanjay K." />
        </div>
        <div>
          <Label>Username</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label>Password</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div>
        <Label>Admin Access Key</Label>
        <Input type="password" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder="Enter access key" required />
      </div>
      <Button type="submit" className="w-full bg-gradient-primary shadow-elegant" disabled={loading}>
        {loading ? "Creating…" : "Create Admin Account"}
      </Button>
    </form>
  );
}