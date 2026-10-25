// Storage contract for the chat. `PgChatStore` is the production implementation; `MemoryChatStore` backs tests and the demo.

import type { GroupColor, PostingPolicy } from "../../shared/limits";

export interface GroupRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  color: GroupColor;
  postingPolicy: PostingPolicy;
  sortOrder: number;
  pinnedMessageId: string | null;
  lastRev: number;
  createdBy: string | null;
  createdAt: Date;
  archivedAt: Date | null;
}

export interface MessageRow {
  id: string;
  groupId: string;
  authorId: string;
  body: string;
  replyToId: string | null;
  clientId: string | null;
  rev: number;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface NewGroup {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  color: GroupColor;
  postingPolicy: PostingPolicy;
  createdBy: string;
}

export type GroupUpdate = Partial<Pick<GroupRow, "name" | "description" | "emoji" | "color" | "postingPolicy" | "archivedAt">>;

export interface NewMessage {
  groupId: string;
  authorId: string;
  body: string;
  replyToId: string | null;
  clientId: string | null;
}

export type MessageUpdate = { kind: "edit"; body: string } | { kind: "delete"; deletedBy: string };

export interface ReadState {
  lastReadId: string;
  unread: number;
}

export interface ChatStore {
  listGroups(options: { includeArchived: boolean }): Promise<GroupRow[]>;
  getGroupBySlug(slug: string): Promise<GroupRow | null>;
  getGroupById(id: string): Promise<GroupRow | null>;
  countGroups(): Promise<number>;
  /** Returns null when the slug is taken. New groups go to the end of the list. */
  createGroup(group: NewGroup): Promise<GroupRow | null>;
  updateGroup(id: string, update: GroupUpdate): Promise<GroupRow | null>;
  /** Sets sort_order to follow the order of `ids`. */
  reorderGroups(ids: readonly string[]): Promise<void>;
  setPinned(groupId: string, messageId: string | null): Promise<void>;

  /**
   * Inserts a message and takes the group's next revision. Returns null when the group is archived or gone.
   * When the author already sent a message with the same client id, returns that message with `duplicate: true`.
   */
  insertMessage(message: NewMessage): Promise<{ row: MessageRow; duplicate: boolean } | null>;
  getMessage(id: string): Promise<MessageRow | null>;
  getMessages(ids: readonly string[]): Promise<MessageRow[]>;
  /** Edits or soft-deletes a message and takes the group's next revision. Deleting clears the body. */
  updateMessage(id: string, update: MessageUpdate): Promise<MessageRow | null>;
  /** Newest first. */
  latestMessages(groupId: string, limit: number): Promise<MessageRow[]>;
  /** Newest first, ids below `beforeId`. */
  messagesBefore(groupId: string, beforeId: string, limit: number): Promise<MessageRow[]>;
  /** Oldest revision first, revisions above `rev`. */
  messagesSince(groupId: string, rev: number, limit: number): Promise<MessageRow[]>;
  /** The newest message that is not deleted, per group. */
  lastMessages(groupIds: readonly string[]): Promise<Map<string, MessageRow>>;
  countRecentMessages(authorId: string, since: Date): Promise<number>;

  readStates(userId: string, groupIds: readonly string[], options: { lookbackSince: Date; cap: number }): Promise<Map<string, ReadState>>;
  /** Moves the read marker forward; never backward. */
  markRead(userId: string, groupId: string, messageId: string): Promise<void>;
}

/** Message ids are bigints held as strings. Compares them numerically. */
export function compareIds(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}
