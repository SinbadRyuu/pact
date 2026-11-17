// Panel header in the app's style: letter-spaced uppercase title on the left, round "?" on the right that
// opens a short explanation (like "GOLD SIGNALS ?" and "MY INDICATORS ?" on the existing pages).
import { useId, useState, type ReactNode } from "react";

export function PanelHead({ id, title, help, action }: { id: string; title: string; help: ReactNode; action?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  return (
    <>
      <div className="aut-panel__head">
        <h2 id={id} className="aut-panel__title">
          {title}
        </h2>
        <div className="aut-panel__tools">
          {action}
          <button
            type="button"
            className="aut-help"
            aria-expanded={open}
            aria-controls={helpId}
            aria-label={`What is ${title}?`}
            onClick={() => setOpen((o) => !o)}
          >
            ?
          </button>
        </div>
      </div>
      {open ? (
        <div id={helpId} className="aut-panel__help" role="note">
          {help}
        </div>
      ) : null}
    </>
  );
}
