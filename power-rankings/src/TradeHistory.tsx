// Full trade history for one provider: paginated on the server, filter by date range and pair, sort, export CSV.
import { useEffect, useState } from "react";
import { TRADE_SORTS, type TradeSort, type TradesResponse } from "../shared/types";
import { apiBase, useJson } from "./api";
import { dateTime, fmtPrice, pips, tone } from "./format";

const STATUS: Record<string, string> = {
  take_profit: "TP hit",
  stop_loss: "Stopped out",
  breakeven: "Breakeven",
  manual_close: "Closed manually",
  active: "Live",
};

const COLS: { key: TradeSort | null; label: string; num?: boolean }[] = [
  { key: "date", label: "Date / time" },
  { key: "pair", label: "Pair" },
  { key: "direction", label: "Direction" },
  { key: null, label: "Entry", num: true },
  { key: null, label: "SL", num: true },
  { key: null, label: "TP hit", num: true },
  { key: "result_pips", label: "Result (pips)", num: true },
  { key: "status", label: "Status" },
];

export function TradeHistory({ slug, pairs, timezone }: { slug: string; pairs: string[]; timezone: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pair, setPair] = useState("");
  const [sort, setSort] = useState<TradeSort>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => setPage(1), [from, to, pair, sort, dir]);

  const qs = new URLSearchParams({ sort, dir, ...(from && { from }), ...(to && { to }), ...(pair && { pair }) });
  const path = `/providers/${encodeURIComponent(slug)}/trades?${qs}&page=${page}&pageSize=${pageSize}`;
  const { data, loading, error } = useJson<TradesResponse>(path);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const csvHref = `${apiBase()}/providers/${encodeURIComponent(slug)}/trades.csv?${qs}`;

  const onSort = (k: TradeSort) => {
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setDir(k === "pair" || k === "status" || k === "direction" ? "asc" : "desc");
    }
  };

  return (
    <section className="pr-section" aria-labelledby="pr-history">
      <div className="pr-section__head">
        <h2 id="pr-history" className="pr-h2">
          Trade history
          <span className="pr-h2__note">Every trade, any date. Use the filters to narrow it down.</span>
        </h2>
        <a className="pr-btn pr-btn--ghost" href={csvHref} download>
          Export CSV
        </a>
      </div>

      <div className="pr-filters">
        <label>
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Pair
          <select value={pair} onChange={(e) => setPair(e.target.value)}>
            <option value="">All pairs</option>
            {pairs.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        {from || to || pair ? (
          <button
            type="button"
            className="pr-linkbtn"
            onClick={() => {
              setFrom("");
              setTo("");
              setPair("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="pr-empty" role="alert">
          Couldn't load trades.
        </p>
      ) : (
        <div className={`pr-tablewrap ${loading ? "is-refreshing" : ""}`} tabIndex={0} role="region" aria-label="Trade history, scrolls sideways">
          <table className="pr-table pr-table--trades">
            <caption className="pr-sr">
              Trade history{data ? `, ${data.total} trades, page ${data.page} of ${pages}` : ""}
            </caption>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.label}
                    scope="col"
                    className={c.num ? "is-num" : ""}
                    aria-sort={c.key && c.key === sort ? (dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {c.key && (TRADE_SORTS as readonly string[]).includes(c.key) ? (
                      <button type="button" onClick={() => onSort(c.key!)}>
                        {c.label}
                        <span className="pr-sorticon" aria-hidden="true">
                          {c.key === sort ? (dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    ) : (
                      <span className="pr-th">{c.label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((t) => (
                <tr key={t.id}>
                  <td className="pr-nowrap">{dateTime(t.closedAt ?? t.openedAt, timezone)}</td>
                  <td>
                    <strong>{t.pair}</strong>
                  </td>
                  <td>
                    <span className={`pr-dir pr-dir--${t.direction}`}>{t.direction}</span>
                  </td>
                  <td className="is-num">
                    {fmtPrice(t.entry)}
                    {t.entryTo !== null ? `–${fmtPrice(t.entryTo)}` : ""}
                  </td>
                  <td className="is-num">{fmtPrice(t.stopLoss)}</td>
                  <td className="is-num">{t.tpHit ? `TP${t.tpHit}` : "–"}</td>
                  <td className={`is-num pr-strong ${tone(t.resultPips)}`}>{t.isOpen ? "–" : pips(t.resultPips)}</td>
                  <td>{t.isOpen ? <span className="pr-livepill">Live</span> : STATUS[t.status] ?? t.status}</td>
                </tr>
              ))}
              {data && !data.rows.length ? (
                <tr>
                  <td colSpan={COLS.length} className="pr-empty">
                    No trades match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > pageSize ? (
        <nav className="pr-pager" aria-label="Trade history pages">
          <button type="button" className="pr-btn pr-btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Newer
          </button>
          <span>
            Page {page} of {pages} · {data.total} trades
          </span>
          <button type="button" className="pr-btn pr-btn--ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Older →
          </button>
        </nav>
      ) : null}
    </section>
  );
}
