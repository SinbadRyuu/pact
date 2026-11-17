// Ready-made links for the three new pages, for a nav that doesn't already map over a list.
// Uses the site's tokens; inherits font and colour from the nav it sits in.
import type { ComponentType, ReactNode } from "react";
import { isActive, isNew, NEW_NAV_ITEMS } from "./nav";
import "./nav.css";

type LinkLike = ComponentType<{ to: string; className?: string; children: ReactNode; "aria-current"?: "page" }>;

export function NewNavLinks({ pathname, Link, compact = false }: { pathname: string; Link?: LinkLike; compact?: boolean }) {
  return (
    <>
      {NEW_NAV_ITEMS.map((item) => {
        const active = isActive(item, pathname);
        const body = (
          <>
            <svg className="vnav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span>{compact ? item.shortLabel : item.label}</span>
            {isNew(item) ? <span className="vnav-new">New</span> : null}
          </>
        );
        const cls = `vnav-link ${active ? "is-active" : ""}`;
        return Link ? (
          <Link key={item.href} to={item.href} className={cls} aria-current={active ? "page" : undefined}>
            {body}
          </Link>
        ) : (
          <a key={item.href} href={item.href} className={cls} aria-current={active ? "page" : undefined}>
            {body}
          </a>
        );
      })}
    </>
  );
}
