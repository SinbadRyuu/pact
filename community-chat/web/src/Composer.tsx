// The message box. Enter sends and Shift+Enter adds a line (on touch screens Enter adds a line and the button sends),
// Escape cancels a reply or edit, and Up in an empty box edits your last message, as in Telegram.

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CHAT_LIMITS } from "../../shared/limits";
import type { ChatMessage, PostBlockedReason } from "../../shared/types";
import { errorMessage } from "./api";
import { Icon } from "./Icon";

export type ComposerMode = { kind: "reply"; message: ChatMessage } | { kind: "edit"; message: ChatMessage } | null;

// Unsent text per group survives switching groups (not page reloads).
const drafts = new Map<string, string>();

const BLOCKED_TEXT: Record<PostBlockedReason, string> = {
  admins_only: "Only admins can send messages in this group.",
  archived: "This group is archived. Restore it to send messages.",
  no_permission: "You can’t send messages in the community right now.",
};

export function Composer({
  slug,
  canPost,
  blockedReason,
  mode,
  onCancelMode,
  onSend,
  onSaveEdit,
  onEditLast,
}: {
  slug: string;
  canPost: boolean;
  blockedReason: PostBlockedReason | null;
  mode: ComposerMode;
  onCancelMode: () => void;
  onSend: (body: string) => void;
  onSaveEdit: (message: ChatMessage, body: string) => Promise<void>;
  onEditLast: () => void;
}) {
  const [text, setText] = useState(() => drafts.get(slug) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const editing = mode?.kind === "edit" ? mode.message : null;

  // Entering edit mode loads the message; leaving it brings back the draft.
  useEffect(() => {
    setError(null);
    if (editing) setText(editing.body);
    else setText(drafts.get(slug) ?? "");
    if (mode) ref.current?.focus();
  }, [mode, editing, slug]);

  useEffect(() => {
    if (!editing) drafts.set(slug, text);
  }, [text, slug, editing]);

  // Grow with the text up to about nine lines.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 216)}px`;
  }, [text]);

  if (!canPost) {
    return (
      <div className="cc-composer cc-composer--blocked" role="note">
        {blockedReason === "admins_only" ? <Icon name="lock" size={16} /> : null}
        {blockedReason ? BLOCKED_TEXT[blockedReason] : "You can’t send messages here."}
      </div>
    );
  }

  const trimmed = text.trim();
  const tooLong = trimmed.length > CHAT_LIMITS.messageMax;
  const unchanged = editing !== null && trimmed === editing.body;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!trimmed || tooLong || saving) return;
    if (editing) {
      if (unchanged) return onCancelMode();
      setSaving(true);
      setError(null);
      try {
        await onSaveEdit(editing, trimmed);
        onCancelMode();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }
    onSend(trimmed);
    setText("");
    drafts.delete(slug);
    if (mode) onCancelMode();
    ref.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape" && mode) {
      e.preventDefault();
      onCancelMode();
    } else if (e.key === "ArrowUp" && !text && !mode) {
      e.preventDefault();
      onEditLast();
    } else if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) {
      e.preventDefault();
      void submit();
    }
  }

  const remaining = CHAT_LIMITS.messageMax - trimmed.length;

  return (
    <form className="cc-composer" onSubmit={submit}>
      {mode ? (
        <div className="cc-composer__context">
          <Icon name={mode.kind === "edit" ? "pencil" : "reply"} size={18} className="cc-composer__context-icon" />
          <div className="cc-composer__context-text">
            <span className="cc-composer__context-title">{mode.kind === "edit" ? "Edit message" : `Reply to ${mode.message.author.displayName}`}</span>
            <span className="cc-composer__context-body">{mode.message.body}</span>
          </div>
          <button type="button" className="cc-icon-button" onClick={onCancelMode} aria-label={mode.kind === "edit" ? "Cancel editing" : "Cancel reply"}>
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="cc-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="cc-composer__row">
        <label className="cc-visually-hidden" htmlFor={`cc-input-${slug}`}>
          Message
        </label>
        <textarea
          id={`cc-input-${slug}`}
          ref={ref}
          className="cc-composer__input"
          rows={1}
          placeholder="Message"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          enterKeyHint="send"
          aria-invalid={tooLong || undefined}
        />
        <button type="submit" className="cc-send" disabled={!trimmed || tooLong || saving} aria-label={editing ? "Save edit" : "Send message"}>
          <Icon name={editing ? "check" : "send"} size={20} />
        </button>
      </div>
      {remaining < 200 ? (
        <p className={`cc-composer__count${tooLong ? " cc-composer__count--over" : ""}`} aria-live="polite">
          {tooLong ? `${-remaining} characters over the limit` : `${remaining} characters left`}
        </p>
      ) : null}
    </form>
  );
}
