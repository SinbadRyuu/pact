// Admin form for creating and editing groups: name, link, description, icon, colour, who can post,
// position in the list, and archive or restore.

import { useState, type CSSProperties, type FormEvent, type ReactElement } from "react";
import { CHAT_LIMITS, GROUP_COLORS, slugify, type GroupColor, type PostingPolicy } from "../../shared/limits";
import type { ChatGroup } from "../../shared/types";
import { GroupAvatar } from "./Avatar";
import { ChatApiError, chatApi, errorMessage } from "./api";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { GROUP_COLOR_LABELS, GROUP_COLOR_VALUES } from "./format";

const EMOJI_CHOICES = ["💬", "🏆", "📈", "📊", "🎓", "📣", "💡", "🧠", "🪙", "🌍", "🔔", "⚡"];

export function GroupDialog({
  open,
  group,
  groups,
  basePath,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The group to edit, or null to create one. */
  group: ChatGroup | null;
  groups: readonly ChatGroup[];
  basePath: string;
  onClose: () => void;
  onSaved: (group: ChatGroup | null, change: "created" | "updated" | "reordered") => void;
}) {
  return (
    <Dialog open={open} title={group ? "Edit group" : "New group"} onClose={onClose}>
      {open ? <GroupForm key={group?.id ?? "new"} group={group} groups={groups} basePath={basePath} onClose={onClose} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function GroupForm({
  group,
  groups,
  basePath,
  onClose,
  onSaved,
}: {
  group: ChatGroup | null;
  groups: readonly ChatGroup[];
  basePath: string;
  onClose: () => void;
  onSaved: (group: ChatGroup | null, change: "created" | "updated" | "reordered") => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [slug, setSlug] = useState(group?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState(group?.description ?? "");
  const [emoji, setEmoji] = useState(group?.emoji ?? "💬");
  const [color, setColor] = useState<GroupColor>(group?.color ?? "cyan");
  const [policy, setPolicy] = useState<PostingPolicy>(group?.postingPolicy ?? "everyone");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const shownSlug = group ? group.slug : slugEdited ? slug : slugify(name);
  const index = group ? groups.findIndex((g) => g.id === group.id) : -1;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFields({});
    setFormError(null);
    try {
      await action();
    } catch (error) {
      if (error instanceof ChatApiError && Object.keys(error.fields).length) setFields(error.fields);
      else setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      if (group) {
        const saved = await chatApi.updateGroup(group.slug, { name, description, emoji, color, postingPolicy: policy });
        onSaved(saved, "updated");
      } else {
        const saved = await chatApi.createGroup({ name, slug: shownSlug, description, emoji, color, postingPolicy: policy });
        onSaved(saved, "created");
      }
    });
  }

  function move(delta: -1 | 1) {
    const order = groups.map((g) => g.slug);
    const to = index + delta;
    if (index < 0 || to < 0 || to >= order.length) return;
    [order[index], order[to]] = [order[to]!, order[index]!];
    void run(async () => {
      await chatApi.reorderGroups(order);
      onSaved(null, "reordered");
    });
  }

  function setArchived(archived: boolean) {
    void run(async () => {
      const saved = await chatApi.updateGroup(group!.slug, { archived });
      onSaved(saved, "updated");
    });
  }

  return (
    <form className="cc-form" onSubmit={submit} noValidate>
      <div className="cc-form__preview">
        <GroupAvatar group={{ name: name || "New group", emoji, color }} size="lg" />
        <div>
          <p className="cc-form__preview-name">{name || "Group name"}</p>
          <p className="cc-muted cc-small">{policy === "admins" ? "Only admins can send messages" : "Everyone can send messages"}</p>
        </div>
      </div>

      {formError ? (
        <p className="cc-form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <Field label="Name" error={fields.name} hint={`${CHAT_LIMITS.groupNameMin} to ${CHAT_LIMITS.groupNameMax} characters, e.g. “VT Impact Crypto Chat”.`}>
        <input value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={CHAT_LIMITS.groupNameMax} required autoComplete="off" />
      </Field>

      <Field label="Link" error={fields.slug} hint={group ? "A group’s link stays the same so shared links keep working." : `${basePath}/${shownSlug || "…"}`}>
        <input
          value={shownSlug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
          }}
          maxLength={CHAT_LIMITS.slugMax}
          disabled={!!group}
          autoComplete="off"
          spellCheck={false}
          className="cc-mono"
        />
      </Field>

      <Field label="Description" optional error={fields.description} hint={`${description.length} of ${CHAT_LIMITS.groupDescriptionMax} characters.`}>
        <textarea value={description} onChange={(e) => setDescription(e.currentTarget.value)} maxLength={CHAT_LIMITS.groupDescriptionMax} rows={2} />
      </Field>

      <fieldset className="cc-fieldset">
        <legend>Icon</legend>
        <div className="cc-emoji-row">
          {EMOJI_CHOICES.map((e) => (
            <button key={e} type="button" className="cc-emoji-choice" aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
          <input
            className="cc-emoji-input"
            value={EMOJI_CHOICES.includes(emoji) ? "" : emoji}
            onChange={(e) => setEmoji(e.currentTarget.value.trim())}
            maxLength={CHAT_LIMITS.groupEmojiMax}
            aria-label="Custom emoji"
            placeholder="Other"
          />
        </div>
        {fields.emoji ? <p className="cc-field__error">{fields.emoji}</p> : null}
      </fieldset>

      <fieldset className="cc-fieldset">
        <legend>Colour</legend>
        <div className="cc-swatches">
          {GROUP_COLORS.map((c) => (
            <label key={c} className="cc-swatch" style={{ "--cc-swatch": GROUP_COLOR_VALUES[c] } as CSSProperties}>
              <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} />
              <span className="cc-visually-hidden">{GROUP_COLOR_LABELS[c]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="cc-fieldset">
        <legend>Who can send messages</legend>
        <label className="cc-radio">
          <input type="radio" name="policy" checked={policy === "everyone"} onChange={() => setPolicy("everyone")} />
          <span>
            <strong>Everyone</strong>
            <span className="cc-muted cc-small">A group chat: every member can talk.</span>
          </span>
        </label>
        <label className="cc-radio">
          <input type="radio" name="policy" checked={policy === "admins"} onChange={() => setPolicy("admins")} />
          <span>
            <strong>Only admins</strong>
            <span className="cc-muted cc-small">An announcement channel: members read, admins post. Good for signals.</span>
          </span>
        </label>
      </fieldset>

      {group ? (
        <div className="cc-form__manage">
          <div className="cc-form__manage-row">
            <span className="cc-small">Position in the list</span>
            <span className="cc-cluster">
              <button type="button" className="cc-button cc-button--small" onClick={() => move(-1)} disabled={busy || index <= 0}>
                <Icon name="up" size={16} /> Up
              </button>
              <button type="button" className="cc-button cc-button--small" onClick={() => move(1)} disabled={busy || index < 0 || index >= groups.length - 1}>
                <Icon name="down" size={16} /> Down
              </button>
            </span>
          </div>
          <div className="cc-form__manage-row">
            <span className="cc-small">{group.archived ? "Archived: hidden from members." : "Archiving hides the group and its messages from members."}</span>
            <button type="button" className={`cc-button cc-button--small${group.archived ? "" : " cc-button--danger-quiet"}`} onClick={() => setArchived(!group.archived)} disabled={busy}>
              <Icon name="archive" size={16} /> {group.archived ? "Restore" : "Archive"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="cc-dialog__actions">
        <button type="button" className="cc-button" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="cc-button cc-button--primary" disabled={busy}>
          {busy ? "Saving…" : group ? "Save changes" : "Create group"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, error, optional, children }: { label: string; hint?: string; error?: string | undefined; optional?: boolean; children: ReactElement }) {
  return (
    <label className={`cc-field${error ? " cc-field--error" : ""}`}>
      <span className="cc-field__label">
        {label}
        {optional ? <span className="cc-muted"> (optional)</span> : null}
      </span>
      {children}
      {error ? <span className="cc-field__error">{error}</span> : hint ? <span className="cc-field__hint">{hint}</span> : null}
    </label>
  );
}
