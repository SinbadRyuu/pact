// One card in the /indicators grid.
import { useState } from "react";
import { AppLink, buttonLabel, download, formatCount, formatDate, type IndicatorSummary, PLATFORM_LABEL, unlockHref } from "./api";
import { LockIcon, PlatformArt } from "./icons";

export function IndicatorCard({ ind }: { ind: IndicatorSummary }) {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(ind.downloadCount);
  const href = `/indicators/${ind.slug}`;

  const onGet = async () => {
    setBusy(true);
    try {
      const n = await download(ind.slug);
      if (n !== null) setCount(n);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="ind-card">
      <AppLink to={href} className="ind-card__media" aria-label={`${ind.name} details`}>
        {ind.image ? (
          <img src={ind.image} alt="" loading="lazy" decoding="async" />
        ) : (
          <PlatformArt platform={ind.platform} />
        )}
        <span className={`ind-badge ind-badge--${ind.platform}`}>{PLATFORM_LABEL[ind.platform]}</span>
        {ind.accessLevel === "members" ? (
          <span className={`ind-members ${ind.locked ? "is-locked" : ""}`}>
            {ind.locked ? <LockIcon /> : null}
            Members
          </span>
        ) : null}
      </AppLink>
      <div className="ind-card__body">
        <h2 className="ind-card__title">
          <AppLink to={href}>{ind.name}</AppLink>
        </h2>
        <p className="ind-card__desc">{ind.description}</p>
        <dl className="ind-meta">
          <div>
            <dt>Version</dt>
            <dd>v{ind.version}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>
              <time dateTime={ind.updatedAt}>{formatDate(ind.updatedAt)}</time>
            </dd>
          </div>
          <div>
            <dt>{ind.action === "tradingview" ? "Opens" : "Downloads"}</dt>
            <dd>{formatCount(count)}</dd>
          </div>
        </dl>
        <div className="ind-card__actions">
          {ind.locked ? (
            <a className="ind-btn ind-btn--locked" href={unlockHref(ind)}>
              <LockIcon /> {buttonLabel(ind)}
            </a>
          ) : (
            <button className="ind-btn ind-btn--primary" type="button" onClick={onGet} disabled={busy}>
              {busy ? "Opening…" : buttonLabel(ind)}
            </button>
          )}
          <AppLink to={href} className="ind-btn ind-btn--ghost">
            Details
          </AppLink>
        </div>
      </div>
    </article>
  );
}
