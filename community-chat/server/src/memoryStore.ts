// An in-memory ChatStore with the same behaviour as PgChatStore. Used by tests and the browser demo.

import { DEFAULT_GROUPS } from "../../shared/defaultGroups";
import { compareIds, type ChatStore, type GroupRow, type GroupUpdate, type MessageRow, type MessageUpdate, type NewGroup, type NewMessage, type ReadState } from "./store";

export class MemoryChatStore implements ChatStore {
  private groups = new Map<string, GroupRow>();
  private messages = new Map<string, MessageRow>();
  private reads = new Map<string, string>();
  private nextMessageId = 1;
  private nextGroupId = 1;
  private readonly now: () => Date;

  constructor(options: { now?: () => Date; seedDefaultGroups?: boolean } = {}) {
    this.now = options.now ?? (() => new Date());
    if (options.seedDefaultGroups ?? true) {
      for (const g of DEFAULT_GROUPS) {
        const row = this.newGroupRow({ ...g, createdBy: "system" });
        row.sortOrder = g.sortOrder;
        this.groups.set(row.id, row);
      }
    }
  }

  private newGroupRow(g: NewGroup): GroupRow {
    const maxSort = Math.max(0, ...[...this.groups.values()].map((x) => x.sortOrder));
    return {
      id: `00000000-0000-4000-8000-${String(this.nextGroupId++).padStart(12, "0")}`,
      slug: g.slug,
      name: g.name,
      description: g.description,
      emoji: g.emoji,
      color: g.color,
      postingPolicy: g.postingPolicy,
      sortOrder: maxSort + 10,
      pinnedMessageId: null,
      lastRev: 0,
      createdBy: g.createdBy,
      createdAt: this.now(),
      archivedAt: null,
    };
  }

  async listGroups({ includeArchived }: { includeArchived: boolean }) {
    return [...this.groups.values()]
      .filter((g) => includeArchived || !g.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
      .map((g) => ({ ...g }));
  }

  async getGroupBySlug(slug: string) {
    const g = [...this.groups.values()].find((x) => x.slug === slug);
    return g ? { ...g } : null;
  }

  async getGroupById(id: string) {
    const g = this.groups.get(id);
    return g ? { ...g } : null;
  }

  async countGroups() {
    return [...this.groups.values()].filter((g) => !g.archivedAt).length;
  }

  async createGroup(group: NewGroup) {
    if ([...this.groups.values()].some((g) => g.slug === group.slug)) return null;
    const row = this.newGroupRow(group);
    this.groups.set(row.id, row);
    return { ...row };
  }

  async updateGroup(id: string, update: GroupUpdate) {
    const g = this.groups.get(id);
    if (!g) return null;
    Object.assign(g, update);
    return { ...g };
  }

  async reorderGroups(ids: readonly string[]) {
    ids.forEach((id, i) => {
      const g = this.groups.get(id);
      if (g) g.sortOrder = (i + 1) * 10;
    });
  }

  async setPinned(groupId: string, messageId: string | null) {
    const g = this.groups.get(groupId);
    if (g) g.pinnedMessageId = messageId;
  }

  async insertMessage(m: NewMessage) {
    if (m.clientId) {
      const existing = [...this.messages.values()].find((x) => x.authorId === m.authorId && x.clientId === m.clientId);
      if (existing) return { row: { ...existing }, duplicate: true };
    }
    const g = this.groups.get(m.groupId);
    if (!g || g.archivedAt) return null;
    g.lastRev += 1;
    const row: MessageRow = {
      id: String(this.nextMessageId++),
      groupId: m.groupId,
      authorId: m.authorId,
      body: m.body,
      replyToId: m.replyToId,
      clientId: m.clientId,
      rev: g.lastRev,
      createdAt: this.now(),
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
    };
    this.messages.set(row.id, row);
    return { row: { ...row }, duplicate: false };
  }

  async getMessage(id: string) {
    const m = this.messages.get(id);
    return m ? { ...m } : null;
  }

  async getMessages(ids: readonly string[]) {
    return ids.flatMap((id) => {
      const m = this.messages.get(id);
      return m ? [{ ...m }] : [];
    });
  }

  async updateMessage(id: string, update: MessageUpdate) {
    const m = this.messages.get(id);
    const g = m && this.groups.get(m.groupId);
    if (!m || !g) return null;
    g.lastRev += 1;
    m.rev = g.lastRev;
    if (update.kind === "edit") {
      m.body = update.body;
      m.editedAt = this.now();
    } else {
      m.body = "";
      m.deletedAt = this.now();
      m.deletedBy = update.deletedBy;
    }
    return { ...m };
  }

  private inGroup(groupId: string) {
    return [...this.messages.values()].filter((m) => m.groupId === groupId);
  }

  async latestMessages(groupId: string, limit: number) {
    return this.inGroup(groupId).sort((a, b) => compareIds(b.id, a.id)).slice(0, limit).map((m) => ({ ...m }));
  }

  async messagesBefore(groupId: string, beforeId: string, limit: number) {
    return this.inGroup(groupId)
      .filter((m) => compareIds(m.id, beforeId) < 0)
      .sort((a, b) => compareIds(b.id, a.id))
      .slice(0, limit)
      .map((m) => ({ ...m }));
  }

  async messagesSince(groupId: string, rev: number, limit: number) {
    return this.inGroup(groupId)
      .filter((m) => m.rev > rev)
      .sort((a, b) => a.rev - b.rev)
      .slice(0, limit)
      .map((m) => ({ ...m }));
  }

  async lastMessages(groupIds: readonly string[]) {
    const out = new Map<string, MessageRow>();
    for (const id of groupIds) {
      const last = this.inGroup(id)
        .filter((m) => !m.deletedAt)
        .sort((a, b) => compareIds(b.id, a.id))[0];
      if (last) out.set(id, { ...last });
    }
    return out;
  }

  async countRecentMessages(authorId: string, since: Date) {
    return [...this.messages.values()].filter((m) => m.authorId === authorId && m.createdAt >= since).length;
  }

  async readStates(userId: string, groupIds: readonly string[], { lookbackSince, cap }: { lookbackSince: Date; cap: number }) {
    const out = new Map<string, ReadState>();
    for (const groupId of groupIds) {
      const marker = this.reads.get(`${userId}:${groupId}`);
      const lastReadId = marker ?? "0";
      const unread = this.inGroup(groupId).filter(
        (m) => !m.deletedAt && m.authorId !== userId && compareIds(m.id, lastReadId) > 0 && (marker !== undefined || m.createdAt > lookbackSince),
      ).length;
      out.set(groupId, { lastReadId, unread: Math.min(unread, cap) });
    }
    return out;
  }

  async markRead(userId: string, groupId: string, messageId: string) {
    const key = `${userId}:${groupId}`;
    const current = this.reads.get(key);
    if (current === undefined || compareIds(messageId, current) > 0) this.reads.set(key, messageId);
  }
}
