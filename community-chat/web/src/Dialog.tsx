import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/** A modal built on <dialog>, so focus trapping, Escape and the backdrop come from the browser. */
export function Dialog({ open, title, onClose, children, size = "md" }: { open: boolean; title: string; onClose: () => void; children: ReactNode; size?: "sm" | "md" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`cc-dialog cc-dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className="cc-dialog__inner">
          <header className="cc-dialog__head">
            <h2 id={titleId} className="cc-dialog__title">
              {title}
            </h2>
            <button type="button" className="cc-icon-button" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onCancel} size="sm">
      <div className="cc-dialog__body">{children}</div>
      {error ? (
        <p className="cc-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="cc-dialog__actions">
        <button type="button" className="cc-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="cc-button cc-button--danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
