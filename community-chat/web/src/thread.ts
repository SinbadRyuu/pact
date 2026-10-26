// State for one open group chat: the messages loaded so far, the poll cursor and messages still being sent.
// Kept free of React so it can be tested on its own.

import type { ChatMessage, ChatReplyPreview, MessagePage } from "../../shared/types";

export interface PendingMessage {
  clientId: string;
  body: string;
  replyTo: ChatReplyPreview | null;
  createdAt: string;
  status: "sending" | "failed";
  error: string | null;
}

export interface ThreadState {
  slug: string;
  status: "loading" | "ready" | "error";
  error: string | null;
  /** True for errors that polling cannot fix (the group is gone or access was removed). */
  fatal: boolean;
  messages: ReadonlyMap<string, ChatMessage>;
  cursor: number | null;
  hasOlder: boolean;
  loadingOlder: boolean;
  pinned: ChatMessage | null;
  pending: readonly PendingMessage[];
  /** The last poll failed and a retry is scheduled. */
  reconnecting: boolean;
}

export type ThreadAction =
  | { type: "reset"; slug: string }
  | { type: "loaded"; slug: string; page: MessagePage }
  | { type: "merged"; slug: string; page: MessagePage }
  | { type: "olderStarted"; slug: string }
  | { type: "olderLoaded"; slug: string; page: MessagePage }
  | { type: "olderFailed"; slug: string }
  | { type: "upsert"; slug: string; message: ChatMessage }
  | { type: "pollFailed"; slug: string; error: string; fatal: boolean }
  | { type: "pending"; slug: string; pending: PendingMessage }
  | { type: "sent"; slug: string; clientId: string; message: ChatMessage }
  | { type: "sendFailed"; slug: string; clientId: string; error: string }
  | { type: "retrying"; slug: string; clientId: string }
  | { type: "discard"; slug: string; clientId: string };

export const initialThread = (slug: string): ThreadState => ({
  slug,
  status: "loading",
  error: null,
  fatal: false,
  messages: new Map(),
  cursor: null,
  hasOlder: false,
  loadingOlder: false,
  pinned: null,
  pending: [],
  reconnecting: false,
});

/** Message ids are bigints held as strings. */
export function compareIds(a: string, b: string) {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

/** Adds messages, keeping whichever copy of each has the higher revision, and drops pending copies that arrived. */
function merge(state: ThreadState, incoming: readonly ChatMessage[]): Pick<ThreadState, "messages" | "pending"> {
  if (incoming.length === 0) return { messages: state.messages, pending: state.pending };
  const messages = new Map(state.messages);
  const arrived = new Set<string>();
  for (const m of incoming) {
    const current = messages.get(m.id);
    if (!current || current.rev <= m.rev) messages.set(m.id, m);
    if (m.clientId) arrived.add(m.clientId);
  }
  const pending = arrived.size ? state.pending.filter((p) => !arrived.has(p.clientId)) : state.pending;
  return { messages, pending };
}

export function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  if (action.type === "reset") return initialThread(action.slug);
  // Responses for a group the member already left are ignored.
  if (action.slug !== state.slug) return state;

  switch (action.type) {
    case "loaded":
      return {
        ...state,
        ...merge({ ...state, messages: new Map() }, action.page.messages),
        status: "ready",
        error: null,
        fatal: false,
        cursor: action.page.cursor,
        hasOlder: action.page.hasMore,
        pinned: action.page.pinned,
        reconnecting: false,
      };
    case "merged":
      return {
        ...state,
        ...merge(state, action.page.messages),
        cursor: action.page.cursor ?? state.cursor,
        pinned: action.page.pinned,
        reconnecting: false,
      };
    case "olderStarted":
      return { ...state, loadingOlder: true };
    case "olderLoaded":
      return { ...state, ...merge(state, action.page.messages), hasOlder: action.page.hasMore, loadingOlder: false };
    case "olderFailed":
      return { ...state, loadingOlder: false };
    case "upsert":
      return { ...state, ...merge(state, [action.message]) };
    case "pollFailed":
      return state.status === "ready" && !action.fatal
        ? { ...state, reconnecting: true }
        : { ...state, status: "error", error: action.error, fatal: action.fatal, reconnecting: !action.fatal };
    case "pending":
      return { ...state, pending: [...state.pending, action.pending] };
    case "sent": {
      const merged = merge(state, [action.message]);
      return { ...state, ...merged, pending: merged.pending.filter((p) => p.clientId !== action.clientId) };
    }
    case "sendFailed":
      return {
        ...state,
        pending: state.pending.map((p) => (p.clientId === action.clientId ? { ...p, status: "failed", error: action.error } : p)),
      };
    case "retrying":
      return {
        ...state,
        pending: state.pending.map((p) => (p.clientId === action.clientId ? { ...p, status: "sending", error: null } : p)),
      };
    case "discard":
      return { ...state, pending: state.pending.filter((p) => p.clientId !== action.clientId) };
  }
}

/** Messages in display order: oldest first. */
export function sortedMessages(state: ThreadState): ChatMessage[] {
  return [...state.messages.values()].sort((a, b) => compareIds(a.id, b.id));
}

/**
 * Where the "Unread messages" line goes: before the first of the last `unreadCount` messages from other members
 * that are newer than the read marker. Null when nothing is unread.
 */
export function firstUnreadId(messages: readonly ChatMessage[], lastReadId: string, unreadCount: number): string | null {
  if (unreadCount <= 0) return null;
  const unread = messages.filter((m) => !m.mine && !m.deleted && compareIds(m.id, lastReadId) > 0);
  if (unread.length === 0) return null;
  return unread[Math.max(0, unread.length - unreadCount)]!.id;
}
