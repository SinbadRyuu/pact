// Trade Room: New Signal
//
// Laid out as a 4-column grid:
//   Send to channel (full width)
//   Direction | Pair / Currency | Entry (single or zone) [-]
//   TP1 * | TP2 (opt) | TP3 (opt) | TP4 (opt)
//   TP5 (opt) | TP6 (opt) | Stop loss * |
//   Notes (full width)
//   Attach Chart Analysis
//   Post Signal + "Posting broadcasts immediately…"
//   [x] Auto-manage this signal from live market prices
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { signalsDeps } from "./adapters";
import { Icon } from "./icons";
import { DEFAULT_PAIRS, MAX_TAKE_PROFITS, checkDraft, emptyDraft, type Channel, type FieldErrors, type SignalDraft } from "./signal";
import "./signals.css";

export interface NewSignalFormProps {
  /** Called after a successful post, e.g. to refresh the signal list. */
  onPosted?: (id: string) => void;
  /** Shows a close button in the header when the form sits in a dialog. */
  onClose?: () => void;
  /** Channel to pick first. Defaults to the first one the person can post to. */
  defaultChannelId?: string;
}

export function NewSignalForm({ onPosted, onClose, defaultChannelId }: NewSignalFormProps) {
  const deps = signalsDeps();
  const pairs = deps.pairs ?? DEFAULT_PAIRS;
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SignalDraft>(() => emptyDraft(defaultChannelId ?? "", pairs[0]?.symbol ?? "XAUUSD"));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const entryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    deps
      .loadChannels()
      .then((list) => {
        if (!live) return;
        setChannels(list);
        setDraft((d) => (d.channelId || !list[0] ? d : { ...d, channelId: list[0].id }));
      })
      .catch((e: unknown) => live && setLoadError(e instanceof Error ? e.message : "Could not load channels"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Thumbnail for the attached chart.
  useEffect(() => {
    if (!draft.chart) return setPreview(null);
    const url = URL.createObjectURL(draft.chart);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.chart]);

  const check = useMemo(() => checkDraft(draft), [draft]);
  const errors: FieldErrors = touched ? check.errors : {};
  const channel = channels?.find((c) => c.id === draft.channelId);

  const set = <K extends keyof SignalDraft>(key: K, value: SignalDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setTp = (i: number, value: string) =>
    setDraft((d) => ({ ...d, takeProfits: d.takeProfits.map((tp, j) => (j === i ? value : tp)) }));

  // The "-" button beside Entry: turns a single price into a zone, or a zone back into a single price.
  const toggleZone = () => {
    const parts = draft.entry.split(/\s*-\s*/);
    if (parts.length > 1) set("entry", parts[0]);
    else set("entry", `${draft.entry.trim()} - `);
    requestAnimationFrame(() => {
      const el = entryRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setPostError(null);
    if (!check.signal || busy) {
      const first = Object.keys(check.errors)[0];
      if (first) document.getElementById(id(first))?.focus();
      return;
    }
    setBusy(true);
    try {
      const chartUrl = draft.chart && deps.uploadChart ? await deps.uploadChart(draft.chart) : null;
      const { id: newId } = await deps.publish({ ...check.signal, chartUrl });
      deps.notify?.(`Signal posted to ${channel?.name ?? "the channel"}`);
      // Keep the channel, direction and pair for the next one; clear the prices.
      setDraft((d) => ({ ...emptyDraft(d.channelId, d.pair), direction: d.direction, autoManage: d.autoManage }));
      setTouched(false);
      if (fileRef.current) fileRef.current.value = "";
      onPosted?.(newId);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Could not post the signal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (key: keyof FieldErrors) =>
    errors[key] ? (
      <span className="sg-field__error" id={id(`${key}-err`)}>
        {errors[key]}
      </span>
    ) : null;
  const errProps = (key: keyof FieldErrors) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": id(`${key}-err`) } : {};

  return (
    <form className="sg sg-form" onSubmit={submit} noValidate aria-labelledby={id("title")}>
      <header className="sg-form__head">
        <h2 className="sg-form__title" id={id("title")}>
          <Icon name="bolt" size={18} className="sg-form__bolt" />
          New Signal
        </h2>
        <div className="sg-form__head-actions">
          {deps.openChannelChat && (
            <button type="button" className="sg-link" onClick={() => draft.channelId && deps.openChannelChat?.(draft.channelId)}>
              <Icon name="chat" size={16} />
              Channel Chat
            </button>
          )}
          {onClose && (
            <button type="button" className="sg-icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="sg-grid">
        {/* Send to channel */}
        <label className="sg-field sg-span-4" htmlFor={id("channelId")}>
          <span className="sg-field__label">Send to channel</span>
          <span className="sg-select sg-select--channel">
            {channel?.iconUrl ? (
              <img className="sg-select__icon" src={channel.iconUrl} alt="" />
            ) : (
              <span className="sg-select__icon sg-select__icon--dot" aria-hidden="true" />
            )}
            <select
              id={id("channelId")}
              value={draft.channelId}
              onChange={(e) => set("channelId", e.target.value)}
              disabled={!channels}
              {...errProps("channelId")}
            >
              {!channels && <option value="">{loadError ?? "Loading channels…"}</option>}
              {channels?.length === 0 && <option value="">No channels you can post to</option>}
              {channels?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.toUpperCase()}
                </option>
              ))}
            </select>
            <Icon name="chevron" className="sg-select__chevron" />
          </span>
          {fieldError("channelId")}
        </label>

        {/* Direction */}
        <label className="sg-field" htmlFor={id("direction")}>
          <span className="sg-field__label">Direction</span>
          <span className="sg-select">
            <select id={id("direction")} value={draft.direction} onChange={(e) => set("direction", e.target.value as SignalDraft["direction"])}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <Icon name="chevron" className="sg-select__chevron" />
          </span>
        </label>

        {/* Pair */}
        <label className="sg-field" htmlFor={id("pair")}>
          <span className="sg-field__label">Pair / Currency</span>
          <span className="sg-select">
            <select id={id("pair")} value={draft.pair} onChange={(e) => set("pair", e.target.value)} {...errProps("pair")}>
              {pairs.map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {p.symbol}
                </option>
              ))}
            </select>
            <Icon name="chevron" className="sg-select__chevron" />
          </span>
          {fieldError("pair")}
        </label>

        {/* Entry */}
        <div className="sg-field sg-span-2">
          <label className="sg-field__label" htmlFor={id("entry")}>
            Entry (single or zone) <span className="sg-req" aria-hidden="true">*</span>
          </label>
          <div className="sg-entry">
            <input
              ref={entryRef}
              id={id("entry")}
              className="sg-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="4115.5 or 4115.5 - 4112"
              value={draft.entry}
              onChange={(e) => set("entry", e.target.value)}
              required
              {...errProps("entry")}
            />
            <button
              type="button"
              className="sg-zone-btn"
              onClick={toggleZone}
              aria-label={draft.entry.includes("-") ? "Use a single entry price" : "Use an entry zone"}
              title={draft.entry.includes("-") ? "Single price" : "Entry zone"}
            >
              -
            </button>
          </div>
          {fieldError("entry")}
        </div>

        {/* TP1 to TP4, then TP5, TP6 and Stop loss */}
        {Array.from({ length: MAX_TAKE_PROFITS }, (_, i) => {
          const key = `tp${i + 1}` as const;
          const required = i === 0;
          return (
            <div className="sg-field" key={key}>
              <label className="sg-field__label" htmlFor={id(key)}>
                TP{i + 1}{" "}
                {required ? (
                  <span className="sg-req" aria-hidden="true">
                    *
                  </span>
                ) : (
                  <span className="sg-opt">(opt)</span>
                )}
              </label>
              <input
                id={id(key)}
                className="sg-input"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder={`TP${i + 1}`}
                value={draft.takeProfits[i]}
                onChange={(e) => setTp(i, e.target.value)}
                required={required}
                {...errProps(key)}
              />
              {fieldError(key)}
            </div>
          );
        })}

        <div className="sg-field">
          <label className="sg-field__label" htmlFor={id("stopLoss")}>
            Stop loss <span className="sg-req" aria-hidden="true">*</span>
          </label>
          <input
            id={id("stopLoss")}
            className="sg-input"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            placeholder="Stop loss"
            value={draft.stopLoss}
            onChange={(e) => set("stopLoss", e.target.value)}
            required
            {...errProps("stopLoss")}
          />
          {fieldError("stopLoss")}
        </div>

        {/* Notes */}
        <label className="sg-field sg-span-4 sg-field--notes" htmlFor={id("notes")}>
          <span className="sg-field__label">Notes</span>
          <input
            id={id("notes")}
            className="sg-input"
            type="text"
            placeholder="Notes (optional)"
            maxLength={500}
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      </div>

      {/* Attach chart */}
      {deps.uploadChart && (
        <div className="sg-attach">
          <input
            ref={fileRef}
            id={id("chart")}
            className="sg-visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => set("chart", e.target.files?.[0] ?? null)}
          />
          {draft.chart ? (
            <span className="sg-attach__file">
              {preview && <img src={preview} alt="" className="sg-attach__thumb" />}
              <span className="sg-attach__name">{draft.chart.name}</span>
              <button
                type="button"
                className="sg-icon-btn"
                aria-label="Remove chart"
                onClick={() => {
                  set("chart", null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <Icon name="x" size={14} />
              </button>
            </span>
          ) : (
            <label htmlFor={id("chart")} className="sg-attach__btn">
              <Icon name="chart" size={16} />
              Attach Chart Analysis
            </label>
          )}
        </div>
      )}

      {/* Post */}
      <div className="sg-post">
        <button type="submit" className="sg-post__btn" disabled={busy || !channels?.length}>
          {busy ? "Posting…" : "Post Signal"}
        </button>
        <p className="sg-post__hint">Posting broadcasts immediately, app push to every member.</p>
      </div>

      {check.warnings.length > 0 && (
        <ul className="sg-warnings" aria-live="polite">
          {check.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {postError && (
        <p className="sg-post__error" role="alert">
          {postError}
        </p>
      )}

      {/* Auto-manage */}
      <div className="sg-auto">
        <input
          id={id("auto")}
          className="sg-check"
          type="checkbox"
          checked={draft.autoManage}
          onChange={(e) => set("autoManage", e.target.checked)}
          aria-describedby={id("auto-desc")}
        />
        <div>
          <label htmlFor={id("auto")} className="sg-auto__label">
            <Icon name="robot" size={15} className="sg-auto__robot" />
            Auto-manage this signal from live market prices: marks TP hits and closes on your stop
          </label>
          <p className="sg-auto__desc" id={id("auto-desc")}>
            Using the default plan (TP hits + your stop only). Want SL → breakeven or trailing? Create a strategy in the{" "}
            {deps.backOfficeHref ? (
              <a href={deps.backOfficeHref} className="sg-link sg-link--inline">
                Back office dashboard
              </a>
            ) : (
              "Back office dashboard"
            )}
            .
          </p>
        </div>
      </div>
    </form>
  );
}
