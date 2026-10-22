import { Link } from "@tanstack/react-router";
import { ArrowRight, TrendingUp } from "lucide-react";

// Landing-page card. If the Affiliates card's markup differs, copy that card instead and keep this icon, copy and link.
export function InvestmentPortalCard() {
  return (
    <section className="rounded-3xl border border-primary/25 bg-card/40 px-6 py-10 text-center backdrop-blur">
      <TrendingUp className="mx-auto h-12 w-12 text-primary" strokeWidth={1.75} />
      <h2 className="mt-4 font-display text-2xl font-semibold">Impact Investment</h2>
      <p className="mt-2 text-muted-foreground">Learn, plan and grow your wealth, all in one place.</p>
      <Link to="/investment" className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary px-8 py-3 font-medium transition hover:bg-primary/10 hover:shadow-brand">
        Enter portal <ArrowRight size={16} />
      </Link>
    </section>
  );
}
