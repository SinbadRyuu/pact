// /indicators/:slug: full description, how to install, screenshots and changelog.
import { useEffect, useState } from "react";
import {
  ApiError,
  AppLink,
  api,
  buttonLabel,
  download,
  formatCount,
  formatDate,
  type IndicatorDetail,
  PLATFORM_LABEL,
  unlockHref,
  usePageMeta,
} from "./api";
import { LockIcon, PlatformArt } from "./icons";
import { RiskWarning } from "./RiskWarning";
import { INDICATORS_SEO } from "./seo";
import "./indicators.css";

export function IndicatorDetailPage({ slug }: { slug: string }) {
  const [ind, setInd] = useState<IndicatorDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState("loading");
    api<IndicatorDetail>("GET", `/${encodeURIComponent(slug)}`)
      .then((d) => {
        setInd(d);
        setState("ready");
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
  }, [slug]);

  const seo = ind ? INDICATORS_SEO.detail(ind) : INDICATORS_SEO.list;
  usePageMeta(seo.title, seo.description, ind?.image);

  const onGet = async () => {
    if (!ind) return;
    setBusy(true);
    try {
      const n = await download(ind.slug);
      if (n !== null) setInd({ ...ind, downloadCount: n });
    } finally {
      setBusy(false);
    }
  };

  if (state !== "ready" || !ind) {
    return (
      <main className="ind" id="main">
        <AppLink to="/indicators" className="ind-back">
          ← All indicators
        </AppLink>
        {state === "loading" ? (
          <div className="ind-detail ind-card--skeleton" aria-busy="true" style={{ height: 420 }} />
        ) : (
          <p className="ind-empty" role="alert">
            {state === "missing" ? "We couldn't find that indicator. It may have been renamed." : "Something went wrong loading this indicator."}
          </p>
        )}
      </main>
    );
  }

  const paragraphs = (ind.longDescription ?? ind.description).split(/\n\s*\n/).filter(Boolean);

  return (
    <main className="ind" id="main">
      <AppLink to="/indicators" className="ind-back">
        ← All indicators
      </AppLink>

      <article className="ind-detail">
        <header className="ind-detail__hero">
          <div className="ind-detail__media">
            {ind.image ? <img src={ind.image} alt={`${ind.name} on a chart`} /> : <PlatformArt platform={ind.platform} />}
          </div>
          <div className="ind-detail__intro">
            <div className="ind-detail__tags">
              <span className={`ind-badge ind-badge--${ind.platform} ind-badge--inline`}>{PLATFORM_LABEL[ind.platform]}</span>
              {ind.accessLevel === "members" ? (
                <span className={`ind-members ind-members--inline ${ind.locked ? "is-locked" : ""}`}>
                  {ind.locked ? <LockIcon /> : null}
                  Members
                </span>
              ) : (
                <span className="ind-free">Free</span>
              )}
            </div>
            <h1 className="ind-detail__title">{ind.name}</h1>
            <p className="ind-detail__lead">{ind.description}</p>
            <dl className="ind-meta ind-meta--row">
              <div>
                <dt>Version</dt>
                <dd>v{ind.version}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>
                  <time dateTime={ind.updatedAt}>{formatDate(ind.updatedAt)}</time>
                </dd>
              </div>
              <div>
                <dt>{ind.action === "tradingview" ? "Opens" : "Downloads"}</dt>
                <dd>{formatCount(ind.downloadCount)}</dd>
              </div>
            </dl>
            {ind.locked ? (
              <div className="ind-lockbox">
                <p>
                  <LockIcon />{" "}
                  {ind.lockReason === "subscribe" ? "This indicator is for subscribers." : "This indicator is free for members. Sign in or create a free account to get it."}
                </p>
                <a className="ind-btn ind-btn--primary ind-btn--block" href={unlockHref(ind)}>
                  {buttonLabel(ind)}
                </a>
              </div>
            ) : (
              <button className="ind-btn ind-btn--primary ind-btn--block ind-btn--glow" type="button" onClick={onGet} disabled={busy}>
                {busy ? "Opening…" : buttonLabel(ind)}
              </button>
            )}
          </div>
        </header>

        <section className="ind-section" aria-labelledby="ind-about">
          <h2 id="ind-about">About</h2>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section className="ind-section" aria-labelledby="ind-install">
          <h2 id="ind-install">How to install</h2>
          <ol className="ind-install">
            {ind.installSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>

        {ind.screenshots.length ? (
          <section className="ind-section" aria-labelledby="ind-shots">
            <h2 id="ind-shots">Screenshots</h2>
            <ul className="ind-shots">
              {ind.screenshots.map((src, i) => (
                <li key={src}>
                  <a href={src} target="_blank" rel="noopener noreferrer">
                    <img src={src} alt={`${ind.name} screenshot ${i + 1}`} loading="lazy" decoding="async" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {ind.changelog.length ? (
          <section className="ind-section" aria-labelledby="ind-changes">
            <h2 id="ind-changes">Changelog</h2>
            <ol className="ind-changelog">
              {ind.changelog.map((c) => (
                <li key={`${c.version}-${c.date}`}>
                  <div className="ind-changelog__head">
                    <strong>v{c.version}</strong>
                    <time dateTime={c.date}>{formatDate(c.date)}</time>
                  </div>
                  <ul>
                    {c.changes.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>

      <RiskWarning />
    </main>
  );
}

export default IndicatorDetailPage;
