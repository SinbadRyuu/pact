// The scrolling message history. It keeps the reader's place when older messages load above, follows new
// messages only when the reader is already at the bottom, and offers a "jump to latest" button otherwise.

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import type { ChatMessage, ChatReplyPreview } from "../../shared/types";
import { MemberAvatar } from "./Avatar";
import { Icon } from "./Icon";
import { GROUP_COLOR_VALUES, dayLabel, fullTimestamp, isSameDay, linkify, memberColor, timeOfDay } from "./format";
import type { PendingMessage } from "./thread";

const RUN_GAP_MS = 5 * 60_000;
const NEAR_BOTTOM_PX = 80;
const LOAD_OLDER_PX = 240;

type Item =
  | { kind: "message"; key: string; message: ChatMessage }
  | { kind: "pending"; key: string; pending: PendingMessage };

export interface MessageActions {
  canReply: boolean;
  canModerate: boolean;
  pinnedId: string | null;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage | null) => void;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  memberHref: (handle: string) => string;
}

export function MessageList({
  groupName,
  messages,
  pending,
  ready,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  firstUnreadId,
  onReadUpTo,
  actions,
}: {
  groupName: string;
  messages: readonly ChatMessage[];
  pending: readonly PendingMessage[];
  ready: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  firstUnreadId: string | null;
  onReadUpTo: (id: string) => void;
  actions: MessageActions;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const positionedRef = useRef(false);
  const anchorRef = useRef<{ height: number; top: number; firstId: string | undefined } | null>(null);
  const lastKeysRef = useRef<string[]>([]);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const items = useMemo<Item[]>(
    () => [
      // Your own messages keep their client id as the key, so the optimistic copy turns into the real one without remounting.
      ...messages.map((m): Item => ({ kind: "message", key: m.clientId ?? m.id, message: m })),
      ...pending.map((p): Item => ({ kind: "pending", key: p.clientId, pending: p })),
    ],
    [messages, pending],
  );
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const firstId = messages[0]?.id;
  const lastReal = messages[messages.length - 1];

  const readLatest = useCallback(() => {
    if (lastReal && document.visibilityState === "visible") onReadUpTo(lastReal.id);
  }, [lastReal, onReadUpTo]);

  const updateBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
    if (bottom) {
      setUnseen(0);
      readLatest();
    }
  }, [readLatest]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !ready) return;
    const keys = items.map((i) => i.key);

    if (!positionedRef.current) {
      const divider = el.querySelector<HTMLElement>(".cc-unread-line");
      el.scrollTop = divider ? divider.offsetTop - 16 : el.scrollHeight;
      positionedRef.current = true;
      lastKeysRef.current = keys;
      updateBottom();
      return;
    }

    const anchor = anchorRef.current;
    if (anchor && firstId !== anchor.firstId) {
      el.scrollTop = anchor.top + (el.scrollHeight - anchor.height);
      anchorRef.current = null;
    }

    const prev = lastKeysRef.current;
    const prevLast = prev[prev.length - 1];
    if (keys[keys.length - 1] !== prevLast) {
      const from = prevLast ? keys.lastIndexOf(prevLast) + 1 : 0;
      const added = items.slice(from);
      const own = added.some((i) => i.kind === "pending" || i.message.mine);
      if (atBottomRef.current || own) {
        el.scrollTop = el.scrollHeight;
        updateBottom();
      } else {
        setUnseen((n) => n + added.filter((i) => i.kind === "message" && !i.message.mine).length);
      }
    }
    lastKeysRef.current = keys;
  }, [items, ready, firstId, updateBottom]);

  // Stay pinned to the bottom when the scroller shrinks, e.g. the keyboard opens or the composer grows.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (atBottomRef.current) readLatest();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [readLatest]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    updateBottom();
    if (el.scrollTop < LOAD_OLDER_PX && hasOlder && !loadingOlder) loadOlder();
  }

  function loadOlder() {
    const el = scrollerRef.current;
    if (el) anchorRef.current = { height: el.scrollHeight, top: el.scrollTop, firstId };
    onLoadOlder();
  }

  function jumpToLatest() {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  function jumpTo(id: string) {
    const target = document.getElementById(`cc-msg-${id}`);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlight(id);
    window.setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1600);
  }

  // Close the open menu on an outside press or Escape.
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(".cc-menu, .cc-msg__more")) setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  // One section per day, so each day's label sticks only while that day is on screen.
  const sections: Array<{ key: string; label: string; rows: ReactNode[] }> = [];
  items.forEach((item, i) => {
    const prev = items[i - 1];
    const next = items[i + 1];
    const created = itemTime(item);
    if (!prev || !isSameDay(itemTime(prev), created)) sections.push({ key: new Date(created).toDateString(), label: dayLabel(created), rows: [] });
    const rows = sections[sections.length - 1]!.rows;
    if (item.kind === "message" && item.message.id === firstUnreadId) {
      rows.push(
        <li key="unread" className="cc-unread-line" role="separator">
          <span>Unread messages</span>
        </li>,
      );
    }
    const first = !continues(prev, item) || (item.kind === "message" && item.message.id === firstUnreadId);
    const last = !continues(item, next) || (next?.kind === "message" && next.message.id === firstUnreadId);
    rows.push(
      item.kind === "message" ? (
        <MessageBubble
          key={item.key}
          message={item.message}
          first={first}
          last={last}
          highlighted={highlight === item.message.id}
          menuOpen={menuFor === item.message.id}
          onMenu={(open) => setMenuFor(open ? item.message.id : null)}
          onJumpTo={jumpTo}
          replyTarget={item.message.replyTo ? byId.get(item.message.replyTo.id) : undefined}
          actions={actions}
        />
      ) : (
        <PendingBubble key={item.key} pending={item.pending} first={first} last={last} onRetry={actions.onRetry} onDiscard={actions.onDiscard} />
      ),
    );
  });

  return (
    <div className="cc-history">
      <div className="cc-scroller" ref={scrollerRef} onScroll={onScroll} role="log" aria-label={`Messages in ${groupName}`} tabIndex={0}>
        <div className="cc-scroller__inner">
          {hasOlder ? (
            <div className="cc-older">
              {loadingOlder ? (
                <span className="cc-spinner" role="status" aria-label="Loading earlier messages" />
              ) : (
                <button type="button" className="cc-button cc-button--small" onClick={loadOlder}>
                  Load earlier messages
                </button>
              )}
            </div>
          ) : ready && items.length > 0 ? (
            <p className="cc-start">This is the start of {groupName}.</p>
          ) : null}
          {ready && items.length === 0 ? (
            <div className="cc-empty">
              <span className="cc-empty__icon" aria-hidden="true">
                👋
              </span>
              <p>No messages yet.</p>
              <p className="cc-muted cc-small">{actions.canReply ? "Be the first to say hello." : "Messages will appear here."}</p>
            </div>
          ) : null}
          <div className="cc-messages">
            {sections.map((section) => (
              <section key={section.key} className="cc-day-section" aria-label={section.label}>
                <div className="cc-day">
                  <span>{section.label}</span>
                </div>
                <ol className="cc-day-list" role="list">
                  {section.rows}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </div>
      {!atBottom ? (
        <button type="button" className="cc-jump" onClick={jumpToLatest} aria-label={unseen ? `${unseen} new messages. Jump to latest` : "Jump to latest"}>
          <Icon name="down" />
          {unseen > 0 ? <span className="cc-badge cc-jump__badge">{unseen > 99 ? "99+" : unseen}</span> : null}
        </button>
      ) : null}
    </div>
  );
}

const itemTime = (i: Item) => (i.kind === "pending" ? i.pending.createdAt : i.message.createdAt);

/** Whether `b` continues `a`'s run: same author, same day, within five minutes, neither deleted. */
function continues(a: Item | undefined, b: Item | undefined) {
  if (!a || !b) return false;
  const author = (i: Item) => (i.kind === "pending" ? "me" : i.message.mine ? "me" : i.message.author.id);
  const deleted = (i: Item) => i.kind === "message" && i.message.deleted;
  return (
    author(a) === author(b) &&
    !deleted(a) &&
    !deleted(b) &&
    isSameDay(itemTime(a), itemTime(b)) &&
    new Date(itemTime(b)).getTime() - new Date(itemTime(a)).getTime() < RUN_GAP_MS
  );
}

function MessageText({ text, meta }: { text: string; meta: ReactNode }) {
  return (
    <p className="cc-bubble__text">
      {linkify(text).map((part, i) =>
        part.kind === "link" ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {part.text}
          </a>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
      {/* Reserves room on the last line so the time never covers the text. */}
      <span className="cc-bubble__spacer" aria-hidden="true">
        {meta}
      </span>
      <span className="cc-bubble__meta">{meta}</span>
    </p>
  );
}

function Quote({ preview, live, onJump }: { preview: ChatReplyPreview; live: ChatMessage | undefined; onJump: (id: string) => void }) {
  const deleted = live ? live.deleted : preview.deleted;
  const name = live?.author.displayName ?? preview.authorName;
  const text = live ? live.body : preview.excerpt;
  return (
    <button type="button" className="cc-quote" onClick={() => onJump(preview.id)} disabled={!live}>
      <span className="cc-quote__name">{deleted ? "Deleted message" : name}</span>
      <span className="cc-quote__text">{deleted ? "This message was deleted." : text}</span>
    </button>
  );
}

function MessageBubble({
  message: m,
  first,
  last,
  highlighted,
  menuOpen,
  onMenu,
  onJumpTo,
  replyTarget,
  actions,
}: {
  message: ChatMessage;
  first: boolean;
  last: boolean;
  highlighted: boolean;
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  onJumpTo: (id: string) => void;
  replyTarget: ChatMessage | undefined;
  actions: MessageActions;
}) {
  const cls = ["cc-msg", m.mine ? "cc-msg--out" : "cc-msg--in", first && "cc-msg--first", last && "cc-msg--last", highlighted && "cc-msg--highlight"]
    .filter(Boolean)
    .join(" ");
  const nameColor = { color: GROUP_COLOR_VALUES[memberColor(m.author.id)] } as CSSProperties;
  const meta = (
    <>
      {m.editedAt && !m.deleted ? <span className="cc-bubble__edited">edited</span> : null}
      <time dateTime={m.createdAt} title={fullTimestamp(m.createdAt)}>
        {timeOfDay(m.createdAt)}
      </time>
    </>
  );
  const isPinned = actions.pinnedId === m.id;
  const menu: Array<{ label: string; icon: Parameters<typeof Icon>[0]["name"]; run: () => void; danger?: boolean }> = [];
  if (!m.deleted) {
    if (actions.canReply) menu.push({ label: "Reply", icon: "reply", run: () => actions.onReply(m) });
    menu.push({ label: "Copy text", icon: "copy", run: () => void navigator.clipboard?.writeText(m.body).catch(() => {}) });
    if (m.canEdit) menu.push({ label: "Edit", icon: "pencil", run: () => actions.onEdit(m) });
    if (actions.canModerate) menu.push({ label: isPinned ? "Unpin" : "Pin", icon: "pin", run: () => actions.onPin(isPinned ? null : m) });
    if (m.canDelete) menu.push({ label: "Delete", icon: "trash", run: () => actions.onDelete(m), danger: true });
  }

  return (
    <li id={`cc-msg-${m.id}`} className={cls}>
      {!m.mine ? <div className="cc-msg__avatar">{last ? <MemberAvatar author={m.author} /> : null}</div> : null}
      <div className="cc-bubble" onDoubleClick={() => actions.canReply && !m.deleted && actions.onReply(m)}>
        {!m.mine && first ? (
          <div className="cc-bubble__author">
            {m.author.handle ? (
              <Link to={actions.memberHref(m.author.handle)} style={nameColor}>
                {m.author.displayName}
              </Link>
            ) : (
              <span style={nameColor}>{m.author.displayName}</span>
            )}
            {m.author.role ? <span className="cc-role">{m.author.role === "admin" ? "admin" : "mod"}</span> : null}
          </div>
        ) : null}
        {m.replyTo && !m.deleted ? <Quote preview={m.replyTo} live={replyTarget} onJump={onJumpTo} /> : null}
        {m.deleted ? (
          <p className="cc-bubble__text cc-bubble__text--deleted">
            <Icon name="trash" size={14} /> Message deleted
            <span className="cc-bubble__spacer" aria-hidden="true">
              {meta}
            </span>
            <span className="cc-bubble__meta">{meta}</span>
          </p>
        ) : (
          <MessageText text={m.body} meta={meta} />
        )}
      </div>
      {menu.length > 0 ? (
        <div className={`cc-msg__tools${menuOpen ? " cc-msg__tools--open" : ""}`}>
          <button
            type="button"
            className="cc-msg__more"
            aria-label="Message options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => onMenu(!menuOpen)}
          >
            <Icon name="more" size={18} />
          </button>
          {menuOpen ? (
            <ul className="cc-menu" role="menu">
              {menu.map((item) => (
                <li key={item.label} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`cc-menu__item${item.danger ? " cc-menu__item--danger" : ""}`}
                    onClick={() => {
                      onMenu(false);
                      item.run();
                    }}
                  >
                    <Icon name={item.icon} size={16} /> {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function PendingBubble({
  pending: p,
  first,
  last,
  onRetry,
  onDiscard,
}: {
  pending: PendingMessage;
  first: boolean;
  last: boolean;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
}) {
  const failed = p.status === "failed";
  const meta = failed ? (
    <span className="cc-bubble__failed">Not sent</span>
  ) : (
    <Icon name="clock" size={13} label="Sending" />
  );
  return (
    <li className={["cc-msg cc-msg--out cc-msg--pending", first && "cc-msg--first", last && "cc-msg--last", failed && "cc-msg--failed"].filter(Boolean).join(" ")}>
      <div className="cc-bubble">
        {p.replyTo ? (
          <div className="cc-quote">
            <span className="cc-quote__name">{p.replyTo.authorName}</span>
            <span className="cc-quote__text">{p.replyTo.excerpt}</span>
          </div>
        ) : null}
        <MessageText text={p.body} meta={meta} />
      </div>
      {failed ? (
        <div className="cc-msg__failed" role="alert">
          <span>{p.error}</span>
          <button type="button" className="cc-link-button" onClick={() => onRetry(p.clientId)}>
            Try again
          </button>
          <button type="button" className="cc-link-button" onClick={() => onDiscard(p.clientId)}>
            Discard
          </button>
        </div>
      ) : null}
    </li>
  );
}
