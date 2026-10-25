// "Add call" for staff with admin.investment.manage. Same fields, rules and endpoint as Enterprise > Admin >
// Investment > Live calls, so a call added here is identical to one added there.
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LIVE_CALLS_KEY, liveCallsDeps, type ApiError } from "./adapters";
import { Icon } from "./icons";

type Field = "title" | "description" | "host" | "date" | "time" | "durationMinutes" | "repeats" | "endsOn" | "joinUrl";
type Errors = Partial<Record<Field, string>>;

const LABELS: Record<Field, string> = {
  title: "Title",
  description: "What the call covers",
  host: "Host",
  date: "Date",
  time: "Start time",
  durationMinutes: "Length",
  repeats: "Repeats",
  endsOn: "Last call",
  joinUrl: "Join link",
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const blankToNull = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

export interface NewCall {
  title: string;
  description: string;
  host: string;
  date: string;
  time: string;
  durationMinutes: number;
  repeats: "weekly" | "none";
  endsOn: string | null;
  joinUrl: string | null;
}

export function readCall(form: FormData): NewCall {
  const repeats = form.get("repeats") === "none" ? "none" : "weekly";
  return {
    title: String(form.get("title") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    host: String(form.get("host") ?? "").trim(),
    date: String(form.get("date") ?? ""),
    time: String(form.get("time") ?? ""),
    durationMinutes: Number(form.get("durationMinutes")),
    repeats,
    endsOn: repeats === "weekly" ? blankToNull(form.get("endsOn")) : null,
    joinUrl: blankToNull(form.get("joinUrl")),
  };
}

/** Mirrors the server's rules so most mistakes show before sending. The server still has the final say. */
export function validateCall(c: NewCall): Errors {
  const e: Errors = {};
  if (!c.title) e.title = "Enter a title";
  else if (c.title.length > 120) e.title = "Use at most 120 characters";
  if (c.host.length > 80) e.host = "Use at most 80 characters";
  if (!DATE.test(c.date)) e.date = "Choose a date";
  if (!TIME.test(c.time)) e.time = "Choose a time";
  if (!Number.isFinite(c.durationMinutes)) e.durationMinutes = "Enter how long the call lasts";
  else if (!Number.isInteger(c.durationMinutes)) e.durationMinutes = "Use whole minutes";
  else if (c.durationMinutes < 5) e.durationMinutes = "Use at least 5 minutes";
  else if (c.durationMinutes > 480) e.durationMinutes = "Use at most 480 minutes";
  if (c.endsOn !== null && !DATE.test(c.endsOn)) e.endsOn = "Choose a date";
  else if (c.endsOn !== null && DATE.test(c.date) && c.endsOn < c.date) e.endsOn = "The last date cannot be before the first call.";
  if (c.joinUrl !== null) {
    if (c.joinUrl.length > 500) e.joinUrl = "Use at most 500 characters";
    else if (!/^https:\/\/\S+$/.test(c.joinUrl)) e.joinUrl = "Enter a full web address starting with https://";
  }
  return e;
}

const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");

export function AddCallDialog({ openWithDate, onClose, onScheduled }: { openWithDate: string | null; onClose: () => void; onScheduled: (ukDate: string) => void }) {
  const deps = liveCallsDeps();
  const qc = useQueryClient();
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [repeats, setRepeats] = useState<"weekly" | "none">("none");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idem = useRef(newKey());
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (openWithDate && !dialog.open) {
      formRef.current?.reset();
      setRepeats("none");
      setErrors({});
      setFormError(null);
      idem.current = newKey();
      dialog.showModal();
    } else if (!openWithDate && dialog.open) dialog.close();
  }, [openWithDate]);

  // A field's message goes as soon as it is edited.
  function clearError(ev: FormEvent<HTMLFormElement>) {
    const name = (ev.target as HTMLInputElement).name as Field;
    if (errors[name]) setErrors(({ [name]: _gone, ...rest }) => rest);
  }

  function focusFirst(e: Errors) {
    const first = (Object.keys(LABELS) as Field[]).find((f) => e[f]);
    if (first) (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    const call = readCall(new FormData(ev.currentTarget));
    const found = validateCall(call);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return focusFirst(found);
    setSaving(true);
    try {
      await deps.post("/admin/investment/calls", call, { idempotencyKey: idem.current });
      await Promise.all([qc.invalidateQueries({ queryKey: LIVE_CALLS_KEY }), qc.invalidateQueries({ queryKey: ["admin", "investment", "calls"] })]);
      deps.notify?.("Live call scheduled");
      onScheduled(call.date);
      onClose();
    } catch (err) {
      const e = err as ApiError;
      const fields = (e.fields ?? {}) as Errors;
      setErrors(fields);
      setFormError(Object.keys(fields).length ? "Check the highlighted fields." : (e.message ?? "The call could not be scheduled. Try again."));
      focusFirst(fields);
    } finally {
      setSaving(false);
    }
  }

  const field = (name: Field) => ({
    id: `${id}-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });
  const errorText = (name: Field) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="lc-field__error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <dialog ref={ref} className="lc-dialog" aria-labelledby={`${id}-heading`} onClose={onClose} onCancel={(e) => saving && e.preventDefault()}>
      <form ref={formRef} className="lc-form" onSubmit={submit} onInput={clearError} onChange={clearError} noValidate>
        <div className="lc-dialog__head">
          <div>
            <p className="lc-eyebrow">Live sessions</p>
            <h2 id={`${id}-heading`}>Add a call</h2>
          </div>
          <button type="button" className="lc-dialog__close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>

        {formError ? (
          <p className="lc-alert" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="lc-field">
          <label htmlFor={`${id}-title`}>{LABELS.title}</label>
          <input {...field("title")} type="text" maxLength={120} required autoComplete="off" />
          {errorText("title")}
        </div>

        <div className="lc-field">
          <label htmlFor={`${id}-description`}>
            {LABELS.description} <span className="lc-optional">(optional)</span>
          </label>
          <textarea {...field("description")} rows={3} maxLength={1000} />
          <p className="lc-field__hint">Keep it to education. Do not promise returns or name things to buy.</p>
          {errorText("description")}
        </div>

        <div className="lc-field">
          <label htmlFor={`${id}-host`}>
            {LABELS.host} <span className="lc-optional">(optional)</span>
          </label>
          <input {...field("host")} type="text" maxLength={80} autoComplete="off" />
          <p className="lc-field__hint">Shown to members as “With …”.</p>
          {errorText("host")}
        </div>

        <div className="lc-form__row">
          <div className="lc-field">
            <label htmlFor={`${id}-date`}>{repeats === "weekly" ? "First call" : LABELS.date}</label>
            <input {...field("date")} type="date" defaultValue={openWithDate ?? undefined} key={openWithDate ?? "none"} required />
            <p className="lc-field__hint">UK date.</p>
            {errorText("date")}
          </div>
          <div className="lc-field">
            <label htmlFor={`${id}-time`}>{LABELS.time}</label>
            <input {...field("time")} type="time" required />
            <p className="lc-field__hint">UK time. Members see their own.</p>
            {errorText("time")}
          </div>
          <div className="lc-field">
            <label htmlFor={`${id}-durationMinutes`}>{LABELS.durationMinutes} (minutes)</label>
            <input {...field("durationMinutes")} type="number" inputMode="numeric" min={5} max={480} step={5} defaultValue={60} required />
            {errorText("durationMinutes")}
          </div>
        </div>

        <div className="lc-form__row">
          <div className="lc-field">
            <label htmlFor={`${id}-repeats`}>{LABELS.repeats}</label>
            <select {...field("repeats")} value={repeats} onChange={(e) => setRepeats(e.target.value === "weekly" ? "weekly" : "none")}>
              <option value="none">Once</option>
              <option value="weekly">Every week</option>
            </select>
            {errorText("repeats")}
          </div>
          {repeats === "weekly" ? (
            <div className="lc-field">
              <label htmlFor={`${id}-endsOn`}>
                {LABELS.endsOn} <span className="lc-optional">(optional)</span>
              </label>
              <input {...field("endsOn")} type="date" />
              <p className="lc-field__hint">Leave empty to keep it running.</p>
              {errorText("endsOn")}
            </div>
          ) : null}
        </div>

        <div className="lc-field">
          <label htmlFor={`${id}-joinUrl`}>
            {LABELS.joinUrl} <span className="lc-optional">(optional)</span>
          </label>
          <input {...field("joinUrl")} type="url" inputMode="url" maxLength={500} className="lc-mono" placeholder="https://" />
          <p className="lc-field__hint">The meeting address, starting with https://. Members only see it from 15 minutes before the start.</p>
          {errorText("joinUrl")}
        </div>

        <div className="lc-dialog__foot">
          <button type="button" className="lc-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="lc-btn lc-btn--add" disabled={saving} aria-busy={saving}>
            {saving ? "Scheduling…" : "Schedule the call"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
