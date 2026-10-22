import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CalendarClock, Landmark, LayoutDashboard, Menu, X } from "lucide-react";
import { ImpactMark } from "@/components/investment/ImpactMark";
import { InvestmentSplash } from "@/components/investment/InvestmentSplash";
import { InvestmentUserContext } from "@/components/investment/user";
import banner from "@/assets/investment-portal-banner.jpg";

export const DISCLAIMER_VERSION = "v1";
const ENTERED_KEY = "vt-investment-entered";

export const Route = createFileRoute("/investment")({
  head: () => ({ meta: [{ title: "VT Investment — VT Impact" }, { name: "description", content: "Investment education, calculators and growth tools." }, { property: "og:title", content: "VT Investment — VT Impact" }, { property: "og:description", content: "Financial education and wealth-building tools." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: InvestmentPortalLayout,
});

function useSessionUser() {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ user: data.session?.user ?? null, ready: true }));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setState({ user: session?.user ?? null, ready: true }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

function InvestmentPortalLayout() {
  const navigate = useNavigate();
  const { user, ready } = useSessionUser();
  const [entered, setEntered] = useState<boolean | null>(null);
  useEffect(() => { try { setEntered(sessionStorage.getItem(ENTERED_KEY) === "1"); } catch { setEntered(false); } }, []);
  // Signed-out visitors are sent through the member area, whose guard takes them to sign in.
  useEffect(() => { if (ready && !user) navigate({ to: "/home" }); }, [ready, user, navigate]);

  function enter() {
    try { sessionStorage.setItem(ENTERED_KEY, "1"); } catch { /* private mode */ }
    setEntered(true);
  }

  if (!ready || !user || entered === null) return <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  if (!entered) return <InvestmentSplash email={user.email} onEnter={enter} />;
  return <InvestmentUserContext.Provider value={user}><PortalShell user={user} /></InvestmentUserContext.Provider>;
}

type NavPage = { slug: string; title: string };

const navLink = "flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground";
const navActive = { className: "bg-secondary text-primary" };

function PortalNav({ modules, cats, onNavigate }: { modules: NavPage[]; cats: NavPage[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Investment navigation" className="flex min-w-0 flex-col gap-1 text-sm">
      <Link to="/investment" activeOptions={{ exact: true }} onClick={onNavigate} className={navLink} activeProps={navActive}><LayoutDashboard size={15} /> Overview</Link>
      <Link to="/investment/schedule" onClick={onNavigate} className={navLink} activeProps={navActive}><CalendarClock size={15} /> Schedule</Link>
      {modules.length > 0 && <p className="mb-1 mt-4 px-3 text-xs font-medium uppercase text-muted-foreground">Education</p>}
      {modules.map((m, i) => (
        <Link key={m.slug} to="/investment/module/$slug" params={{ slug: m.slug }} onClick={onNavigate} className={navLink} activeProps={navActive}>{i + 1}. {m.title}</Link>
      ))}
      {cats.length > 0 && <p className="mb-1 mt-4 px-3 text-xs font-medium uppercase text-muted-foreground">Explore</p>}
      {cats.map((c) => (
        <Link key={c.slug} to="/investment/explore/$slug" params={{ slug: c.slug }} onClick={onNavigate} className={navLink} activeProps={navActive}>{c.title}</Link>
      ))}
      <Link to="/investment/explore/$slug" params={{ slug: "tax-accounting" }} onClick={onNavigate} className={`${navLink} mt-4`} activeProps={navActive}><Landmark size={15} /> Tax &amp; Accounting</Link>
    </nav>
  );
}

function PortalShell({ user }: { user: User }) {
  const qc = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: acked, isLoading } = useQuery({
    queryKey: ["disclaimer", user.id, DISCLAIMER_VERSION],
    queryFn: async () => {
      const { data, error } = await supabase.from("disclaimer_acknowledgements").select("id").eq("user_id", user.id).eq("version", DISCLAIMER_VERSION).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const { data: pages = [] } = useQuery({
    queryKey: ["content-pages"],
    queryFn: async () => (await supabase.from("content_pages").select("*").order("sort")).data ?? [],
  });

  async function agree() {
    if (!checked || saving) return;
    setSaving(true);
    const { error } = await supabase.from("disclaimer_acknowledgements").insert({ user_id: user.id, version: DISCLAIMER_VERSION });
    setSaving(false);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["disclaimer"] });
  }

  const modules = pages.filter((p) => p.kind === "module");
  const cats = pages.filter((p) => p.kind === "category" && p.slug !== "tax-accounting");

  return (
    <div className="relative isolate min-h-dvh bg-background text-foreground">
      <img src={banner} alt="" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 w-full object-cover opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <header className="sticky top-0 z-30 border-b border-primary/15 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-4 sm:px-6">
          <Link to="/" aria-label="All portals" className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft size={16} /><span className="hidden sm:inline">All portals</span></Link>
          <Link to="/investment" className="flex min-w-0 items-center gap-2"><ImpactMark className="h-6 w-8 shrink-0" /><span className="truncate font-display font-semibold">VT Investment</span></Link>
          {acked && (
            <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} className="ml-auto rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
        {acked && menuOpen && <div className="max-h-[70dvh] overflow-y-auto border-t border-border px-4 py-3 md:hidden"><PortalNav modules={modules} cats={cats} onNavigate={() => setMenuOpen(false)} /></div>}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : !acked ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-primary/25 bg-card/60 p-6 backdrop-blur sm:p-8">
            <h2 className="font-display text-2xl font-semibold">Investment disclaimer</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Content is provided for general educational and informational purposes.</li>
              <li>Content does not constitute personalised financial, tax or investment advice.</li>
              <li>All investments involve risk, including potential loss of capital.</li>
              <li>Historical performance does not guarantee future returns.</li>
              <li>Consider your circumstances and seek suitably qualified professional advice where appropriate.</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">This acknowledgement does not replace regulatory authorisation or other applicable legal requirements.</p>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} /> I have read and understood the disclaimer.
            </label>
            <Button className="mt-6 rounded-full px-8 shadow-brand" disabled={!checked || saving} onClick={agree}>{saving ? "Saving…" : "Agree & continue"}</Button>
          </div>
        ) : (
          <div className="grid items-start gap-6 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="hidden md:sticky md:top-24 md:block md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto md:border-r md:border-border md:pr-4">
              <PortalNav modules={modules} cats={cats} />
            </aside>
            <div className="min-w-0"><Outlet /></div>
          </div>
        )}
      </main>
    </div>
  );
}
