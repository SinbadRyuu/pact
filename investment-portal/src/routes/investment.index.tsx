import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calculators } from "@/components/Calculators";
import { Button } from "@/components/ui/button";
import { EnquiryForm } from "@/components/EnquiryForm";
import { InvestmentMedia } from "@/components/InvestmentMedia";
import { Progress } from "@/components/ui/progress";
import cover from "@/assets/investment-portal-hero.jpg";
import banner from "@/assets/investment-portal-banner.jpg";
import { useInvestmentUser } from "@/components/investment/user";
import { callOccurrence, callState, weekStart, type Occurrence } from "@/lib/schedule";
import { addWeeks, format } from "date-fns";
import { ArrowUpRight, BookOpen, CalendarClock, Calculator, CheckCircle2, Circle, Compass, Landmark, MessageSquare, ShieldCheck, Sparkles, Trophy } from "lucide-react";

export const Route = createFileRoute("/investment/")({
  head: () => ({ meta: [{ title: "VT Investment — Education & Tools" }, { name: "description", content: "Investment education, calculators and categories from VT Impact." }, { property: "og:title", content: "VT Investment — Education & Tools" }, { property: "og:description", content: "Investment education, calculators and categories from VT Impact." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: InvestmentHome,
});

function useJourney(userId: string) {
  const key = `vt-investment-progress-${userId}`;
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { setDone([]); } }, [key]);
  const toggle = (slug: string) => setDone((d) => { const next = d.includes(slug) ? d.filter((s) => s !== slug) : [...d, slug]; localStorage.setItem(key, JSON.stringify(next)); return next; });
  return { done, toggle };
}

function useNextCall() {
  return useQuery({
    queryKey: ["investment-next-call"],
    queryFn: async () => {
      const { data } = await supabase.from("schedule_events").select("*").eq("audience", "client").order("starts_at");
      const now = new Date();
      const items: Occurrence[] = [];
      for (const c of data ?? []) for (const w of [0, 1]) { const o = callOccurrence(c, addWeeks(weekStart(now), w)); if (o) items.push(o); }
      return items.filter((o) => callState(o, now) !== "Ended" && callState(o, now) !== "Cancelled").sort((a, b) => +a.start - +b.start)[0] ?? null;
    },
  });
}

const sections = [
  { id: "journey", label: "Journey", icon: Compass },
  { id: "tools", label: "Tools", icon: Calculator },
  { id: "markets", label: "Markets", icon: Sparkles },
  { id: "support", label: "Support", icon: MessageSquare },
];

function InvestmentHome() {
  const user = useInvestmentUser();
  const { data: pages = [] } = useQuery({
    queryKey: ["content-pages"],
    queryFn: async () => (await supabase.from("content_pages").select("*").order("sort")).data ?? [],
  });
  const { data: next } = useNextCall();
  const { done, toggle } = useJourney(user.id);
  const home = pages.find((p) => p.kind === "site" && p.slug === "investment-home");
  const modules = pages.filter((p) => p.kind === "module");
  const cats = pages.filter((p) => p.kind === "category" && p.slug !== "tax-accounting");
  const completed = modules.filter((m) => done.includes(m.slug)).length;
  const pct = modules.length ? Math.round((completed / modules.length) * 100) : 0;
  const nextModule = useMemo(() => modules.find((m) => !done.includes(m.slug)) ?? modules[0], [modules, done]);
  const name = (user.email ?? "").split("@")[0];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-xl border border-primary/30 shadow-brand">
        <img src={cover} alt="Investment planning and financial markets" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col justify-center">
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><ShieldCheck size={14} /> Private member area</p>
            <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Welcome back, <span className="text-gold">{name}</span></h1>
            <p className="mt-3 max-w-lg text-muted-foreground">{home?.summary || "Learn. Plan. Grow. Your investment journey, in one place."}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {nextModule && <Button asChild size="lg"><Link to="/investment/module/$slug" params={{ slug: nextModule.slug }}>{completed ? "Continue learning" : "Start learning"} <ArrowUpRight /></Link></Button>}
              <Button asChild size="lg" variant="outline"><Link to="/investment/schedule">Live calls <CalendarClock /></Link></Button>
            </div>
            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[{ k: "Modules", v: modules.length }, { k: "Markets", v: cats.length }, { k: "Progress", v: `${pct}%` }].map((s) => (
                <div key={s.k} className="rounded-lg border border-border bg-card/70 p-3 backdrop-blur"><dt className="text-xs text-muted-foreground">{s.k}</dt><dd className="mt-1 font-display text-2xl font-semibold">{s.v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-primary/40 bg-card/90 p-5 backdrop-blur">
            <img src={banner} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
            <p className="text-xs uppercase text-primary">Next live call</p>
            {next ? <>
              <h2 className="mt-2 text-xl font-semibold">{next.call.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{format(next.start, "EEEE d MMM · HH:mm")}</p>
              <span className="mt-3 inline-flex rounded-full bg-brand px-3 py-1 text-xs font-semibold text-primary-foreground">{callState(next, new Date())}</span>
            </> : <p className="mt-2 text-sm text-muted-foreground">No calls booked yet.</p>}
            <Button asChild variant="outline" className="mt-5 w-full"><Link to="/investment/schedule">View schedule</Link></Button>
            {home?.video_url && <div className="mt-5 overflow-hidden rounded-md"><InvestmentMedia value={home.video_url} title="VT Investment introduction" type="video" className="w-full" /></div>}
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <nav aria-label="Investment sections" className="sticky top-[4.5rem] z-20 -mx-1 flex gap-2 overflow-x-auto rounded-lg border border-border bg-background/90 p-1.5 backdrop-blur">
        {sections.map((s) => <a key={s.id} href={`#${s.id}`} className="flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"><s.icon size={15} className="text-primary" />{s.label}</a>)}
      </nav>

      {/* Journey */}
      <section id="journey" className="scroll-mt-36">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs uppercase text-primary">Learning journey</p><h2 className="mt-1 text-2xl font-semibold">Your roadmap</h2></div>
          <div className="w-full max-w-xs"><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>{completed} of {modules.length} complete</span><span>{pct}%</span></div><Progress value={pct} /></div>
        </div>
        {pct === 100 && modules.length > 0 && <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/40 bg-card p-4 shadow-brand"><Trophy className="text-primary" /><p className="text-sm">Journey complete — great work. Keep exploring the markets below.</p></div>}
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m, i) => {
            const isDone = done.includes(m.slug);
            return (
              <li key={m.slug} className={`group relative flex gap-4 rounded-lg border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary ${isDone ? "border-primary/50" : "border-border"}`}>
                <button type="button" onClick={() => toggle(m.slug)} aria-label={isDone ? `Mark ${m.title} incomplete` : `Mark ${m.title} complete`} className="mt-0.5 shrink-0 text-primary">{isDone ? <CheckCircle2 size={22} /> : <Circle size={22} className="text-muted-foreground" />}</button>
                <Link to="/investment/module/$slug" params={{ slug: m.slug }} className="min-w-0 flex-1">
                  <span className="font-mono text-xs text-primary">STEP {String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-1 block font-display font-semibold">{m.title}</span>
                  <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{m.summary}</span>
                </Link>
                <BookOpen size={16} className="shrink-0 text-muted-foreground group-hover:text-primary" />
              </li>
            );
          })}
        </ol>
      </section>

      {/* Tools */}
      <section id="tools" className="scroll-mt-36">
        <p className="text-xs uppercase text-primary">Planning tools</p>
        <h2 className="mb-5 mt-1 text-2xl font-semibold">Model your growth</h2>
        <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6"><Calculators userId={user.id} /></div>
      </section>

      {/* Markets */}
      <section id="markets" className="scroll-mt-36">
        <p className="text-xs uppercase text-primary">Explore investments</p>
        <h2 className="mb-5 mt-1 text-2xl font-semibold">Markets &amp; asset classes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c, i) => (
            <Link key={c.slug} to="/investment/explore/$slug" params={{ slug: c.slug }} className={`group relative isolate flex min-h-52 flex-col justify-end overflow-hidden rounded-xl border border-border p-5 transition hover:border-primary hover:shadow-brand ${i === 0 ? "lg:col-span-2" : ""}`}>
              {c.image_url ? <InvestmentMedia value={c.image_url} title={c.title} className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 -z-20 bg-brand opacity-30" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-transparent" />
              <span className="font-display text-lg font-semibold">{c.title}</span>
              <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.summary}</span>
              <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">Explore <ArrowUpRight size={14} /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* Support */}
      <section id="support" className="grid scroll-mt-36 gap-6 lg:grid-cols-2">
        <div className="flex flex-col justify-between rounded-xl border border-primary/30 bg-card p-6">
          <div><Landmark className="text-primary" /><h2 className="mt-3 text-xl font-semibold">Tax &amp; Accounting</h2><p className="mt-2 text-sm text-muted-foreground">Tax guidance and direct access to accountants.</p></div>
          <Button asChild className="mt-6 self-start"><Link to="/investment/explore/$slug" params={{ slug: "tax-accounting" }}>Explore <ArrowUpRight /></Link></Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-6"><h2 className="mb-4 text-xl font-semibold">Ask the team</h2><EnquiryForm category="investment" /></div>
      </section>
      <p className="text-center text-xs text-muted-foreground">Educational content only. Capital is at risk.</p>
    </div>
  );
}
