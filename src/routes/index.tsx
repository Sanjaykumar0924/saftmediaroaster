import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Calendar, Users, ShieldCheck, Sparkles, Radio, Video, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { SERVICES, nextServiceDate, formatServiceDate } from "@/lib/saft";

export const Route = createFileRoute("/")({
  component: Landing,
});

/** Deterministic 12-hour clock so SSR and browser output match exactly. */
function formatClock(d: Date) {
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <BrandLogo />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a>
            <a href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</a>
            <a href="#stats" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Team</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" search={{ mode: "member" } as any}>
              <Button variant="outline" size="sm">Member Login</Button>
            </Link>
            <Link to="/auth" search={{ mode: "admin" } as any}>
              <Button size="sm" className="bg-gradient-primary shadow-elegant">Admin Access</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, oklch(0.55 0.24 27 / 0.4), transparent 50%), radial-gradient(circle at 80% 60%, oklch(0.55 0.24 27 / 0.3), transparent 50%)" }} />
        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Media Team Management System
            </div>
            <h1 className="mt-6 text-5xl font-black tracking-tight text-primary-foreground md:text-7xl">
              SAFT Church
              <span className="block bg-gradient-to-r from-primary via-primary-glow to-primary-foreground bg-clip-text text-transparent">
                Media Team Portal
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-primary-foreground/80 md:text-xl">
              Serving God with Excellence through Media. Manage availability, publish rosters, track attendance, and celebrate every volunteer — all in one professional dashboard.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/auth" search={{ mode: "member" } as any}>
                <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-elegant text-base h-12 px-8">
                  Member Login <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth" search={{ mode: "admin" } as any}>
                <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 h-12 px-8">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Admin Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-16 md:grid-cols-2 md:items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <div className="h-px w-8 bg-primary" /> About the team
            </div>
            <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              Every camera. Every mix. Every moment — captured with excellence.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              The SAFT Media Team is a family of volunteers dedicated to bringing the worship experience beyond the sanctuary. From live camera direction and audio engineering to streaming and drone work, we serve every service with intentionality and craft.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Camera, title: "Cinematic Cameras", desc: "Multi-angle live worship coverage" },
              { icon: Radio, title: "Live Streaming", desc: "Broadcast reach beyond walls" },
              { icon: Mic2, title: "Pro Audio", desc: "Studio-grade sound engineering" },
              { icon: Video, title: "Drone & 4K", desc: "Aerial and ultra-high-def frames" },
            ].map((f) => (
              <div key={f.title} className="glass rounded-2xl p-6 shadow-card transition-smooth hover:shadow-elegant">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="font-semibold">{f.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Services */}
      <section id="services" className="border-y border-border bg-gradient-subtle">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="flex items-end justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Calendar className="h-4 w-4" /> Upcoming Services
              </div>
              <h2 className="mt-2 text-4xl font-bold tracking-tight">Next on the schedule</h2>
            </div>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {SERVICES.map((s) => {
              const d = nextServiceDate(s.id);
              return (
                <div key={s.id} className="group relative overflow-hidden rounded-2xl bg-card p-8 shadow-card transition-smooth hover:-translate-y-1 hover:shadow-elegant">
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition-smooth group-hover:bg-primary/20" />
                  <div className="relative">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{s.short}</div>
                    <div className="mt-2 text-2xl font-bold">{s.label}</div>
                    <div className="mt-6 text-sm text-muted-foreground">Next service</div>
                    <div className="text-xl font-semibold">{formatServiceDate(d)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatClock(d)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-6 md:grid-cols-4">
          {[
            { label: "Active Volunteers", value: "12+" },
            { label: "Services Weekly", value: "3" },
            { label: "Camera Angles", value: "4" },
            { label: "Years Serving", value: "10+" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-8 shadow-card">
              <div className="text-4xl font-black text-primary md:text-5xl">{s.value}</div>
              <div className="mt-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-12 text-center shadow-elegant">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 50% 0%, oklch(0.55 0.24 27 / 0.5), transparent 60%)" }} />
          <div className="relative">
            <Users className="mx-auto h-10 w-10 text-primary-foreground/80" />
            <h3 className="mt-4 text-3xl font-bold text-primary-foreground md:text-4xl">Ready to serve this Sunday?</h3>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">Log in to update your availability, view the roster, and see your assignments.</p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/auth" search={{ mode: "member" } as any}>
                <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8 shadow-elegant">Member Login</Button>
              </Link>
              <Link to="/auth" search={{ mode: "admin" } as any}>
                <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 h-12 px-8">
                  Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <BrandLogo size="sm" />
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} SAFT Church Media Team · Serving God with Excellence</p>
        </div>
      </footer>
    </div>
  );
}
