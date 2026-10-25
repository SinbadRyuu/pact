import { useCallback, useMemo, useRef, useState } from "react";
import type { ChatGroup, ChatMessage, ChatViewerInfo } from "../../shared/types";
import { GroupAvatar } from "./Avatar";
import { Composer, type ComposerMode } from "./Composer";
import { ConfirmDialog } from "./Dialog";
import { Icon } from "./Icon";
import { MessageList, type MessageActions } from "./MessageList";
import { errorMessage } from "./api";
import { firstUnreadId } from "./thread";
import { useThread } from "./useThread";

export function ChatView({
  group,
  viewer,
  memberHref,
  onBack,
  onEditGroup,
}: {
  group: ChatGroup;
  viewer: ChatViewerInfo;
  memberHref: (handle: string) => string;
  onBack: (() => void) | null;
  onEditGroup: (() => void) | null;
}) {
  const thread = useThread(group.slug);
  const { state, messages } = thread;
  const [mode, setMode] = useState<ComposerMode>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChatMessage | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Where the unread line goes is decided from the read marker when the group opens, then left alone.
  const unreadAtOpen = useRef({ lastReadId: group.lastReadId, unread: group.unreadCount });
  const dividerId = useMemo(
    () => (state.status === "ready" ? firstUnreadId(messages, unreadAtOpen.current.lastReadId, unreadAtOpen.current.unread) : null),
    // Fixed once the first page arrives, so new messages do not move the line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.status === "ready"],
  );

  const run = useCallback(async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }, []);

  const actions: MessageActions = {
    canReply: group.canPost,
    canModerate: viewer.canModerate,
    pinnedId: state.pinned?.id ?? null,
    onReply: (m) => setMode({ kind: "reply", message: m }),
    onEdit: (m) => setMode({ kind: "edit", message: m }),
    onDelete: (m) => setConfirmDelete(m),
    onPin: (m) => void run(() => thread.pin(m?.id ?? null)),
    onRetry: thread.retry,
    onDiscard: thread.discard,
    memberHref,
  };

  function editLast() {
    const mine = [...messages].reverse().find((m) => m.mine && m.canEdit);
    if (mine) setMode({ kind: "edit", message: mine });
  }

  async function deleteConfirmed() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await thread.remove(confirmDelete.id);
      if (mode?.message.id === confirmDelete.id) setMode(null);
      setConfirmDelete(null);
    } catch (error) {
      setActionError(errorMessage(error));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  }

  const subtitle = group.archived
    ? "Archived · hidden from members"
    : group.postingPolicy === "admins"
      ? "Only admins can send messages"
      : group.description || "Group chat · everyone can send messages";

  return (
    <section className="cc-chat" aria-label={group.name}>
      <header className="cc-chat__head">
        {onBack ? (
          <button type="button" className="cc-icon-button cc-chat__back" onClick={onBack} aria-label="All groups">
            <Icon name="back" />
          </button>
        ) : null}
        <GroupAvatar group={group} size="sm" />
        <div className="cc-chat__title">
          <h2>{group.name}</h2>
          <p title={group.description}>{subtitle}</p>
        </div>
        {onEditGroup ? (
          <button type="button" className="cc-icon-button" onClick={onEditGroup} aria-label="Edit group">
            <Icon name="settings" />
          </button>
        ) : null}
      </header>

      {state.pinned ? (
        <div className="cc-pinned">
          <button
            type="button"
            className="cc-pinned__body"
            onClick={() => document.getElementById(`cc-msg-${state.pinned!.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" })}
          >
            <span className="cc-pinned__label">
              <Icon name="pin" size={14} /> Pinned message
            </span>
            <span className="cc-pinned__text">{state.pinned.body}</span>
          </button>
          {viewer.canModerate ? (
            <button type="button" className="cc-icon-button" onClick={() => void run(() => thread.pin(null))} aria-label="Unpin message">
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      {state.reconnecting && state.status === "ready" ? (
        <p className="cc-banner" role="status">
          <span className="cc-spinner cc-spinner--small" aria-hidden="true" /> Reconnecting…
        </p>
      ) : null}
      {actionError ? (
        <p className="cc-banner cc-banner--error" role="alert">
          {actionError}
          <button type="button" className="cc-icon-button" onClick={() => setActionError(null)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="cc-state" role="alert">
          <Icon name="alert" size={28} />
          <p>{state.error}</p>
          {state.fatal ? null : (
            <button type="button" className="cc-button" onClick={thread.reload}>
              <Icon name="refresh" size={16} /> Try again
            </button>
          )}
        </div>
      ) : (
        <>
          {state.status === "loading" ? (
            <div className="cc-state" role="status">
              <span className="cc-spinner" aria-hidden="true" /> Loading messages…
            </div>
          ) : null}
          <MessageList
            groupName={group.name}
            messages={messages}
            pending={state.pending}
            ready={state.status === "ready"}
            hasOlder={state.hasOlder}
            loadingOlder={state.loadingOlder}
            onLoadOlder={() => void thread.loadOlder()}
            firstUnreadId={dividerId}
            onReadUpTo={thread.markRead}
            actions={actions}
          />
        </>
      )}

      <Composer
        slug={group.slug}
        canPost={group.canPost}
        blockedReason={group.postBlockedReason}
        mode={mode}
        onCancelMode={() => setMode(null)}
        onSend={(body) => thread.send(body, mode?.kind === "reply" ? mode.message : null)}
        onSaveEdit={(m, body) => thread.edit(m.id, body)}
        onEditLast={editLast}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this message?"
        confirmLabel="Delete message"
        busy={busy}
        onConfirm={() => void deleteConfirmed()}
        onCancel={() => setConfirmDelete(null)}
      >
        <p>
          {confirmDelete && !confirmDelete.mine
            ? `This removes ${confirmDelete.author.displayName}’s message for everyone in the group.`
            : "This removes the message for everyone in the group. It can’t be undone."}
        </p>
      </ConfirmDialog>
    </section>
  );
}
