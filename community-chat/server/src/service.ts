// Every rule of the community chat lives here, so the HTTP layer and the UI cannot drift from it:
//   * only admins create, edit, reorder and archive groups;
//   * all messages belong to a group, so there are no one-to-one conversations;
//   * members with the post permission can post in groups whose policy is "everyone";
//   * authors edit their own messages for 48 hours and delete them any time; admins and moderators delete or pin any message.

import { CHAT_LIMITS } from "../../shared/limits";
import type {
  ChatAuthor,
  ChatGroup,
  ChatMessage,
  ChatReplyPreview,
  GroupListResponse,
  MessagePage,
  PostBlockedReason,
  StaffRole,
} from "../../shared/types";
import { ChatError, forbidden, invalid, notFound } from "./errors";
import type { ChatStore, GroupPhoto, GroupRow, GroupUpdate, MessageRow } from "./store";
import { parseEditMessage, parseGroupPatch, parseGroupPhoto, parseNewGroup, parsePin, parseSendMessage, parseSlugList } from "./validation";

/** The signed-in member, as the host app's session middleware knows them. */
export interface ChatViewer {
  id: string;
  roles: readonly string[];
  permissions: readonly string[];
}

export interface ChatMemberProfile {
  handle: string | null;
  displayName: string;
  avatarUrl?: string | null;
  role?: StaffRole | null;
}

/** Looks up display names for message authors. The host app implements it against its users table. */
export interface MemberDirectory {
  lookup(ids: readonly string[]): Promise<Map<string, ChatMemberProfile>>;
}

export interface ChatServiceOptions {
  store: ChatStore;
  directory: MemberDirectory;
  /** The permission a member needs to send messages. Defaults to the forum's `community.post`; null skips the check. */
  postPermission?: string | null;
  now?: () => Date;
}

const isAdmin = (v: ChatViewer) => v.roles.includes("admin");
const isStaff = (v: ChatViewer) => isAdmin(v) || v.roles.includes("moderator");

const FORMER_MEMBER: ChatMemberProfile = { handle: null, displayName: "Former member", avatarUrl: null, role: null };

export class CommunityChatService {
  private readonly store: ChatStore;
  private readonly directory: MemberDirectory;
  private readonly postPermission: string | null;
  private readonly now: () => Date;

  constructor(options: ChatServiceOptions) {
    this.store = options.store;
    this.directory = options.directory;
    this.postPermission = options.postPermission === undefined ? "community.post" : options.postPermission;
    this.now = options.now ?? (() => new Date());
  }

  // ---- Groups ----

  async listGroups(viewer: ChatViewer): Promise<GroupListResponse> {
    const rows = await this.store.listGroups({ includeArchived: isAdmin(viewer) });
    const ids = rows.map((g) => g.id);
    const lookbackSince = new Date(this.now().getTime() - CHAT_LIMITS.unreadLookbackDays * 86_400_000);
    const [last, reads] = await Promise.all([
      this.store.lastMessages(ids),
      this.store.readStates(viewer.id, ids, { lookbackSince, cap: CHAT_LIMITS.unreadCap }),
    ]);
    const lastRows = [...last.values()];
    const ctx = await this.context(viewer, lastRows);
    const groups = rows.map((row): ChatGroup => {
      const lastRow = last.get(row.id);
      const read = reads.get(row.id);
      return {
        ...this.groupFields(viewer, row),
        lastMessage: lastRow ? this.toMessage(viewer, lastRow, ctx) : null,
        unreadCount: read?.unread ?? 0,
        lastReadId: read?.lastReadId ?? "0",
      };
    });
    return {
      groups,
      viewer: { id: viewer.id, canManageGroups: isAdmin(viewer), canModerate: isStaff(viewer) },
    };
  }

  async createGroup(viewer: ChatViewer, body: unknown): Promise<ChatGroup> {
    this.requireAdmin(viewer, "Only admins can create groups.");
    const input = parseNewGroup(body);
    if ((await this.store.countGroups()) >= CHAT_LIMITS.maxGroups) {
      throw new ChatError(409, "too_many_groups", `The community can have up to ${CHAT_LIMITS.maxGroups} groups. Archive one first.`);
    }
    const row = await this.store.createGroup({ ...input, createdBy: viewer.id });
    if (!row) throw invalid({ slug: "Another group already uses this link." });
    return { ...this.groupFields(viewer, row), lastMessage: null, unreadCount: 0, lastReadId: "0" };
  }

  async updateGroup(viewer: ChatViewer, slug: string, body: unknown): Promise<ChatGroup> {
    this.requireAdmin(viewer, "Only admins can edit groups.");
    const patch = parseGroupPatch(body);
    const group = await this.findGroup(viewer, slug);
    const update: GroupUpdate = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.emoji !== undefined) update.emoji = patch.emoji;
    if (patch.color !== undefined) update.color = patch.color;
    if (patch.postingPolicy !== undefined) update.postingPolicy = patch.postingPolicy;
    if (patch.archived !== undefined) update.archivedAt = patch.archived ? (group.archivedAt ?? this.now()) : null;
    const row = await this.store.updateGroup(group.id, update);
    if (!row) throw notFound("This group no longer exists.");
    return { ...this.groupFields(viewer, row), lastMessage: null, unreadCount: 0, lastReadId: "0" };
  }

  async reorderGroups(viewer: ChatViewer, body: unknown): Promise<void> {
    this.requireAdmin(viewer, "Only admins can reorder groups.");
    const slugs = parseSlugList(body);
    const all = await this.store.listGroups({ includeArchived: true });
    const bySlug = new Map(all.map((g) => [g.slug, g]));
    if (slugs.length !== all.length || slugs.some((s) => !bySlug.has(s))) {
      throw invalid({ slugs: "The list of groups changed. Refresh and try again." });
    }
    await this.store.reorderGroups(slugs.map((s) => bySlug.get(s)!.id));
  }

  // ---- Group pictures ----

  /** Uploads or replaces a group's picture. Admins only. */
  async setGroupPhoto(viewer: ChatViewer, slug: string, body: unknown): Promise<ChatGroup> {
    this.requireAdmin(viewer, "Only admins can change a group’s picture.");
    const { contentType, bytes } = parseGroupPhoto(body);
    const group = await this.findGroup(viewer, slug);
    const row = await this.store.setGroupPhoto(group.id, { contentType, bytes, version: newVersion() }, viewer.id);
    if (!row) throw notFound("This group no longer exists.");
    return { ...this.groupFields(viewer, row), lastMessage: null, unreadCount: 0, lastReadId: "0" };
  }

  /** Removes a group's picture, so it shows its emoji again. Admins only. */
  async removeGroupPhoto(viewer: ChatViewer, slug: string): Promise<ChatGroup> {
    this.requireAdmin(viewer, "Only admins can change a group’s picture.");
    const group = await this.findGroup(viewer, slug);
    const row = await this.store.setGroupPhoto(group.id, null, viewer.id);
    if (!row) throw notFound("This group no longer exists.");
    return { ...this.groupFields(viewer, row), lastMessage: null, unreadCount: 0, lastReadId: "0" };
  }

  /** Anyone who can see the group can see its picture. */
  async getGroupPhoto(viewer: ChatViewer, slug: string): Promise<GroupPhoto> {
    const group = await this.findGroup(viewer, slug);
    const photo = await this.store.getGroupPhoto(group.id);
    if (!photo) throw notFound("This group has no picture.");
    return photo;
  }

  // ---- Messages ----

  async listMessages(viewer: ChatViewer, slug: string, query: { before?: string; since?: number; limit: number }): Promise<MessagePage> {
    const group = await this.findGroup(viewer, slug);
    let rows: MessageRow[];
    let cursor: number | null;
    let hasMore: boolean;

    if (query.since !== undefined) {
      const limit = CHAT_LIMITS.sincePageSize;
      rows = await this.store.messagesSince(group.id, query.since, limit);
      hasMore = rows.length === limit;
      cursor = rows.length ? rows[rows.length - 1]!.rev : query.since;
    } else if (query.before !== undefined) {
      const newestFirst = await this.store.messagesBefore(group.id, query.before, query.limit + 1);
      hasMore = newestFirst.length > query.limit;
      rows = newestFirst.slice(0, query.limit).reverse();
      cursor = null;
    } else {
      // Read the revision before the messages: anything committed after this read is picked up by the next poll.
      cursor = group.lastRev;
      const newestFirst = await this.store.latestMessages(group.id, query.limit + 1);
      hasMore = newestFirst.length > query.limit;
      rows = newestFirst.slice(0, query.limit).reverse();
    }

    const pinnedRow = group.pinnedMessageId ? await this.store.getMessage(group.pinnedMessageId) : null;
    const pinnedVisible = pinnedRow && !pinnedRow.deletedAt ? pinnedRow : null;
    const ctx = await this.context(viewer, pinnedVisible ? [...rows, pinnedVisible] : rows);
    return {
      messages: rows.map((r) => this.toMessage(viewer, r, ctx)),
      cursor,
      hasMore,
      pinned: pinnedVisible ? this.toMessage(viewer, pinnedVisible, ctx) : null,
    };
  }

  async sendMessage(viewer: ChatViewer, slug: string, body: unknown): Promise<{ message: ChatMessage; duplicate: boolean }> {
    const input = parseSendMessage(body);
    const group = await this.findGroup(viewer, slug);
    const blocked = this.postBlockedReason(viewer, group);
    if (blocked) throw forbidden(BLOCKED_MESSAGES[blocked], blocked);

    if (input.replyToId) {
      const target = await this.store.getMessage(input.replyToId);
      if (!target || target.groupId !== group.id || target.deletedAt) {
        throw invalid({ replyToId: "The message you replied to is no longer available." });
      }
    }

    if (!isStaff(viewer)) {
      const windowStart = new Date(this.now().getTime() - CHAT_LIMITS.rateLimitWindowSeconds * 1000);
      if ((await this.store.countRecentMessages(viewer.id, windowStart)) >= CHAT_LIMITS.rateLimitMessages) {
        throw new ChatError(429, "rate_limited", "You are sending messages too quickly. Wait a few seconds.", {
          retryAfterSeconds: CHAT_LIMITS.rateLimitWindowSeconds,
        });
      }
    }

    const result = await this.store.insertMessage({ groupId: group.id, authorId: viewer.id, ...input });
    if (!result) throw forbidden(BLOCKED_MESSAGES.archived, "archived");
    const ctx = await this.context(viewer, [result.row]);
    return { message: this.toMessage(viewer, result.row, ctx), duplicate: result.duplicate };
  }

  async editMessage(viewer: ChatViewer, id: string, body: unknown): Promise<ChatMessage> {
    const text = parseEditMessage(body);
    const { row, group } = await this.findMessage(viewer, id);
    if (row.authorId !== viewer.id) throw forbidden("You can only edit your own messages.");
    if (group.archivedAt) throw forbidden(BLOCKED_MESSAGES.archived, "archived");
    if (!this.withinEditWindow(row)) {
      throw forbidden(`Messages can only be edited for ${CHAT_LIMITS.editWindowHours} hours after they are sent.`, "edit_window_passed");
    }
    if (text === row.body) throw new ChatError(409, "nothing_to_change", "The message is unchanged.");
    const updated = await this.store.updateMessage(row.id, { kind: "edit", body: text });
    if (!updated) throw notFound("This message is no longer available.");
    return this.toMessage(viewer, updated, await this.context(viewer, [updated]));
  }

  async deleteMessage(viewer: ChatViewer, id: string): Promise<void> {
    const { row, group } = await this.findMessage(viewer, id);
    if (row.authorId !== viewer.id && !isStaff(viewer)) throw forbidden("You can only delete your own messages.");
    await this.store.updateMessage(row.id, { kind: "delete", deletedBy: viewer.id });
    if (group.pinnedMessageId === row.id) await this.store.setPinned(group.id, null);
  }

  async setPinned(viewer: ChatViewer, slug: string, body: unknown): Promise<void> {
    if (!isStaff(viewer)) throw forbidden("Only admins and moderators can pin messages.");
    const messageId = parsePin(body);
    const group = await this.findGroup(viewer, slug);
    if (messageId) {
      const row = await this.store.getMessage(messageId);
      if (!row || row.groupId !== group.id || row.deletedAt) throw invalid({ messageId: "This message is no longer available." });
    }
    await this.store.setPinned(group.id, messageId);
  }

  async markRead(viewer: ChatViewer, slug: string, messageId: string): Promise<void> {
    const group = await this.findGroup(viewer, slug);
    const row = await this.store.getMessage(messageId);
    if (!row || row.groupId !== group.id) throw invalid({ messageId: "Not a message in this group." });
    await this.store.markRead(viewer.id, group.id, messageId);
  }

  // ---- Helpers ----

  private requireAdmin(viewer: ChatViewer, message: string) {
    if (!isAdmin(viewer)) throw forbidden(message, "admins_only");
  }

  /** Archived groups are invisible to everyone but admins. */
  private async findGroup(viewer: ChatViewer, slug: string): Promise<GroupRow> {
    const group = await this.store.getGroupBySlug(slug);
    if (!group || (group.archivedAt && !isAdmin(viewer))) throw notFound("This group is not available.");
    return group;
  }

  private async findMessage(viewer: ChatViewer, id: string): Promise<{ row: MessageRow; group: GroupRow }> {
    const row = await this.store.getMessage(id);
    const group = row && !row.deletedAt ? await this.store.getGroupById(row.groupId) : null;
    if (!row || !group || (group.archivedAt && !isAdmin(viewer))) throw notFound("This message is no longer available.");
    return { row, group };
  }

  private postBlockedReason(viewer: ChatViewer, group: GroupRow): PostBlockedReason | null {
    if (group.archivedAt) return "archived";
    if (this.postPermission && !viewer.permissions.includes(this.postPermission)) return "no_permission";
    if (group.postingPolicy === "admins" && !isAdmin(viewer)) return "admins_only";
    return null;
  }

  private withinEditWindow(row: MessageRow) {
    return this.now().getTime() - row.createdAt.getTime() < CHAT_LIMITS.editWindowHours * 3_600_000;
  }

  private groupFields(viewer: ChatViewer, row: GroupRow) {
    const blocked = this.postBlockedReason(viewer, row);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      emoji: row.emoji,
      color: row.color,
      photoVersion: row.photoVersion,
      postingPolicy: row.postingPolicy,
      sortOrder: row.sortOrder,
      archived: row.archivedAt !== null,
      createdAt: row.createdAt.toISOString(),
      canPost: blocked === null,
      postBlockedReason: blocked,
    };
  }

  /** Loads the authors and replied-to messages a set of rows needs, in two batched lookups. */
  private async context(viewer: ChatViewer, rows: readonly MessageRow[]) {
    const replyIds = [...new Set(rows.map((r) => r.replyToId).filter((id): id is string => id !== null))];
    const replies = new Map((await this.store.getMessages(replyIds)).map((r) => [r.id, r]));
    const authorIds = new Set(rows.map((r) => r.authorId));
    for (const r of replies.values()) authorIds.add(r.authorId);
    const profiles = authorIds.size ? await this.directory.lookup([...authorIds]) : new Map<string, ChatMemberProfile>();
    return { replies, profiles, staff: isStaff(viewer) };
  }

  private author(id: string, profiles: Map<string, ChatMemberProfile>): ChatAuthor {
    const p = profiles.get(id) ?? FORMER_MEMBER;
    return { id, handle: p.handle, displayName: p.displayName, avatarUrl: p.avatarUrl ?? null, role: p.role ?? null };
  }

  private toMessage(viewer: ChatViewer, row: MessageRow, ctx: Awaited<ReturnType<CommunityChatService["context"]>>): ChatMessage {
    const deleted = row.deletedAt !== null;
    const mine = row.authorId === viewer.id;
    let replyTo: ChatReplyPreview | null = null;
    if (row.replyToId) {
      const target = ctx.replies.get(row.replyToId);
      replyTo = target
        ? {
            id: target.id,
            authorName: this.author(target.authorId, ctx.profiles).displayName,
            excerpt: target.deletedAt ? "" : excerpt(target.body),
            deleted: target.deletedAt !== null,
          }
        : { id: row.replyToId, authorName: "", excerpt: "", deleted: true };
    }
    return {
      id: row.id,
      groupId: row.groupId,
      author: this.author(row.authorId, ctx.profiles),
      body: deleted ? "" : row.body,
      replyTo,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      deleted,
      rev: row.rev,
      clientId: mine ? row.clientId : null,
      mine,
      canEdit: mine && !deleted && this.withinEditWindow(row),
      canDelete: !deleted && (mine || ctx.staff),
    };
  }
}

const BLOCKED_MESSAGES: Record<PostBlockedReason, string> = {
  admins_only: "Only admins can send messages in this group.",
  archived: "This group is archived. Messages can no longer be sent.",
  no_permission: "You cannot send messages in the community right now.",
};

/** A short random token; it changes the picture's URL so browsers fetch the new one. */
function newVersion() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function excerpt(body: string) {
  const line = body.replace(/\s+/g, " ").trim();
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}
