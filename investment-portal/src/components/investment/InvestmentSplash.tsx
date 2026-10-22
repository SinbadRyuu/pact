import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ImpactWordmark } from "@/components/investment/ImpactMark";
import hero from "@/assets/investment-portal-hero.jpg";

export function InvestmentSplash({ email, onEnter }: { email?: string; onEnter: () => void }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-16 text-foreground">
      <img src={hero} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/75 via-background/90 to-background" />
      <Link to="/" className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft size={16} /> All portals</Link>
      <section className="w-full max-w-md rounded-3xl border border-primary/25 bg-card/50 px-6 py-10 text-center backdrop-blur-md">
        <ImpactWordmark />
        <h1 className="mt-8 font-display text-3xl font-semibold">VT Investment</h1>
        <p className="mt-3 text-lg text-muted-foreground">Investment education, planning tools and live calls, in one place.</p>
        <button type="button" onClick={onEnter} className="mt-8 inline-flex items-center gap-3 rounded-full bg-primary px-10 py-4 text-lg font-semibold text-primary-foreground shadow-brand ring-4 ring-primary/20 transition hover:brightness-110">
          Enter portal <ArrowRight size={20} />
        </button>
        {email && <p className="mt-6 text-sm text-muted-foreground">Signed in as <span className="text-foreground">{email}</span></p>}
      </section>
      <p className="mt-6 text-center text-xs text-muted-foreground">Educational content only. Capital is at risk.</p>
    </div>
  );
}
