// Charts for Power Rankings, plain SVG (no chart library). Colours are validated for the dark surface:
// line = site cyan; gains #2ec98f and losses #e8406f (CVD ΔE 10.2). Gains/losses are also told apart by direction
// from the zero line, so colour is never the only cue. Text always uses text colours, never the series colour.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { EquityPoint, MonthStat } from "../shared/types";
import { monthLabel, pct, pips, shortDate } from "./format";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (ym: string) => MONTH_NAMES[Number(ym.slice(5, 7)) - 1];

/** Rounded tick values covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 10;
    max += 10;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

const compact = (v: number) =>
  Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)}K` : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(v);

/** Tracks an element's width so charts draw at real pixels (crisp 1px gridlines, readable text). */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Mini equity curve for podium cards. Decorative: the card states the numbers. */
export function Sparkline({ points, width = 140, height = 40 }: { points: EquityPoint[]; width?: number; height?: number }) {
  if (points.length < 2) return <div className="pr-spark pr-spark--empty" style={{ height }} aria-hidden="true" />;
  const vals = [0, ...points.map((p) => p.v)];
  const lo = Math.min(...vals),
    hi = Math.max(...vals);
  const pad = 4;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo || 1)) * (height - pad * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  return (
    <svg className="pr-spark" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      {lo < 0 && hi > 0 ? <line x1={0} x2={width} y1={y(0)} y2={y(0)} className="pr-grid" /> : null}
      <path d={`${d}L${x(points.length - 1)},${y(Math.max(lo, 0))}L${x(0)},${y(Math.max(lo, 0))}Z`} className="pr-area" />
      <path d={d} className="pr-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Cumulative pips over the period, with a crosshair + tooltip (pointer, touch and arrow keys). */
export function EquityChart({ points, tz, total, height = 240 }: { points: EquityPoint[]; tz: string; total: number; height?: number }) {
  const [wrap, width] = useWidth<HTMLDivElement>(640);
  const [active, setActive] = useState<number | null>(null);
  const m = { top: 14, right: 16, bottom: 26, left: 48 };
  const series = points;
  const { ticks, x, y } = useMemo(() => {
    const vals = [0, ...series.map((p) => p.v)];
    const t = niceTicks(Math.min(...vals), Math.max(...vals));
    const lo = t[0],
      hi = t[t.length - 1];
    const iw = width - m.left - m.right,
      ih = height - m.top - m.bottom;
    return {
      ticks: t,
      // Trades are evenly spaced (one step per closed trade) so a busy day doesn't squash the curve.
      x: (i: number) => m.left + (series.length <= 1 ? iw / 2 : (i / (series.length - 1)) * iw),
      y: (v: number) => m.top + (1 - (v - lo) / (hi - lo || 1)) * ih,
    };
  }, [series, width, height]);

  if (!series.length) return <p className="pr-empty">No closed trades in this period.</p>;

  const d = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const rel = ((clientX - r.left) / r.width) * width;
    const i = Math.round(((rel - m.left) / (width - m.left - m.right)) * (series.length - 1));
    setActive(Math.max(0, Math.min(series.length - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(series.length - 1, (a ?? series.length - 1) + (e.key === "ArrowRight" ? 1 : -1))));
    }
    if (e.key === "Escape") setActive(null);
  };
  const a = active !== null ? series[active] : null;
  const last = series[series.length - 1];
  const tipLeft = active !== null ? Math.min(Math.max(x(active), 70), width - 70) : 0;

  return (
    <div className="pr-chart" ref={wrap}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Cumulative pips: ${total} trades, finishing at ${pips(last.v)}. Use the arrow keys to step through the curve.`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={(e: PointerEvent<SVGSVGElement>) => pick(e.clientX, e.currentTarget)}
        onPointerDown={(e: PointerEvent<SVGSVGElement>) => pick(e.clientX, e.currentTarget)}
        // Touch lifts fire pointerleave; keep the readout up on phones until they tap elsewhere (blur).
        onPointerLeave={(e: PointerEvent<SVGSVGElement>) => e.pointerType === "mouse" && setActive(null)}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? "pr-axis" : "pr-grid"} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="pr-tick">
              {compact(t)}
            </text>
          </g>
        ))}
        <text x={m.left} y={height - 6} className="pr-tick">
          {shortDate(new Date(series[0].t).toISOString(), tz)}
        </text>
        <text x={width - m.right} y={height - 6} textAnchor="end" className="pr-tick">
          {shortDate(new Date(last.t).toISOString(), tz)}
        </text>
        <path d={`${d}L${x(series.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} className="pr-area" />
        <path d={d} className="pr-line" />
        {active === null ? (
          <>
            <circle cx={x(series.length - 1)} cy={y(last.v)} r={4} className="pr-dot" />
            <text x={x(series.length - 1) - 8} y={y(last.v) - 10} textAnchor="end" className="pr-endlabel">
              {pips(last.v)}
            </text>
          </>
        ) : (
          <>
            <line x1={x(active)} x2={x(active)} y1={m.top} y2={height - m.bottom} className="pr-crosshair" />
            <circle cx={x(active)} cy={y(a!.v)} r={4.5} className="pr-dot" />
          </>
        )}
      </svg>
      {a ? (
        <div className="pr-tooltip" style={{ left: tipLeft }} role="status">
          <strong>{pips(a.v)}</strong>
          <span>
            Trade {a.n} of {total} · {shortDate(new Date(a.t).toISOString(), tz)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Pips per month as columns from a zero line, with each month's win rate in its own row underneath (not a 2nd axis). */
export function MonthlyChart({ months, height = 200 }: { months: MonthStat[]; height?: number }) {
  const [wrap, boxW] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  // Open scrolled to the latest months when the chart is wider than the screen.
  useEffect(() => {
    if (wrap.current) wrap.current.scrollLeft = wrap.current.scrollWidth;
  }, [months.length, wrap]);
  if (!months.length) return <p className="pr-empty">No closed trades in this period.</p>;

  const slot = Math.max(44, (boxW - 48) / months.length);
  const width = Math.max(boxW, 48 + slot * months.length);
  const m = { top: 18, bottom: 34, left: 48 };
  const vals = [0, ...months.map((x) => x.pips)];
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 3);
  const lo = ticks[0],
    hi = ticks[ticks.length - 1];
  const y = (v: number) => m.top + (1 - (v - lo) / (hi - lo || 1)) * (height - m.top - m.bottom);
  const bar = Math.min(24, slot * 0.55);
  const r = 4;

  /** Column with a 4px rounded data end and a square base on the zero line. */
  const col = (cx: number, v: number) => {
    const x0 = cx - bar / 2,
      x1 = cx + bar / 2,
      y0 = y(0),
      y1 = y(v);
    const h = Math.abs(y1 - y0);
    const rr = Math.min(r, h / 2, bar / 2);
    if (h < 0.5) return `M${x0},${y0}H${x1}`;
    return v >= 0
      ? `M${x0},${y0}V${y1 + rr}Q${x0},${y1} ${x0 + rr},${y1}H${x1 - rr}Q${x1},${y1} ${x1},${y1 + rr}V${y0}Z`
      : `M${x0},${y0}V${y1 - rr}Q${x0},${y1} ${x0 + rr},${y1}H${x1 - rr}Q${x1},${y1} ${x1},${y1 - rr}V${y0}Z`;
  };
  const labelAll = months.length <= 8; // label every cap only when there's room; otherwise the tooltip carries values

  return (
    <div className="pr-chart pr-chart--scroll" ref={wrap}>
      <svg width={width} height={height} role="img" aria-label={`Net pips per month for ${months.length} months. Values in the table below.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width} y1={y(t)} y2={y(t)} className={t === 0 ? "pr-axis" : "pr-grid"} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="pr-tick">
              {compact(t)}
            </text>
          </g>
        ))}
        {months.map((mo, i) => {
          const cx = m.left + slot * i + slot / 2;
          return (
            <g
              key={mo.month}
              className={`pr-col ${hover === i ? "is-hover" : ""}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${monthLabel(mo.month, true)}: ${pips(mo.pips)} pips, ${mo.trades} trades, ${pct(mo.winRate)} win rate`}
            >
              <rect x={cx - slot / 2} y={m.top} width={slot} height={height - m.top - m.bottom} className="pr-hit" />
              <path d={col(cx, mo.pips)} className={mo.pips >= 0 ? "pr-bar-pos" : "pr-bar-neg"} />
              {labelAll || hover === i ? (
                <text x={cx} y={mo.pips >= 0 ? y(mo.pips) - 6 : y(mo.pips) + 14} textAnchor="middle" className="pr-caplabel">
                  {pips(mo.pips)}
                </text>
              ) : null}
              <text x={cx} y={height - 20} textAnchor="middle" className="pr-tick">
                {monthName(mo.month)}
              </text>
              {i === 0 || mo.month.endsWith("-01") ? (
                <text x={cx} y={height - 6} textAnchor="middle" className="pr-tick pr-tick--year">
                  {mo.month.slice(0, 4)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="pr-winrow" style={{ width, gridTemplateColumns: `48px repeat(${months.length}, ${slot}px)` }} aria-hidden="true">
        <span className="pr-winrow__label">Win %</span>
        {months.map((mo, i) => (
          <span key={mo.month} className={`pr-winrow__cell ${hover === i ? "is-hover" : ""}`}>
            <span className="pr-winrow__meter" style={{ width: `${mo.winRate}%` }} />
            <span className="pr-winrow__val">{Math.round(mo.winRate)}</span>
          </span>
        ))}
      </div>
      {hover !== null ? (
        <div className="pr-tooltip pr-tooltip--static" role="status">
          <strong>{pips(months[hover].pips)} pips</strong>
          <span>
            {monthLabel(months[hover].month, true)} · {months[hover].trades} trades · {pct(months[hover].winRate)} win rate
          </span>
        </div>
      ) : null}
    </div>
  );
}
