// The production ChatStore on Postgres. Run migrations/0001_community_chat.sql first.

import type { GroupColor, GroupPhotoType, PostingPolicy } from "../../shared/limits";
import type { ChatStore, GroupPhoto, GroupRow, GroupUpdate, MessageRow, MessageUpdate, NewGroup, NewMessage, ReadState } from "./store";

/** Anything with node-postgres' `query` signature: a `pg.Pool`, a `pg.Client` or a thin wrapper around another driver. */
export interface Queryable {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

type GroupDb = {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  posting_policy: string;
  sort_order: number;
  pinned_message_id: string | null;
  photo_version: string | null;
  last_rev: string;
  created_by: string | null;
  created_at: Date;
  archived_at: Date | null;
};

type MessageDb = {
  id: string;
  group_id: string;
  author_id: string;
  body: string;
  reply_to_id: string | null;
  client_id: string | null;
  rev: string;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  deleted_by: string | null;
};

const UNIQUE_VIOLATION = "23505";

const toGroup = (r: GroupDb): GroupRow => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  emoji: r.emoji,
  color: r.color as GroupColor,
  postingPolicy: r.posting_policy as PostingPolicy,
  sortOrder: r.sort_order,
  pinnedMessageId: r.pinned_message_id === null ? null : String(r.pinned_message_id),
  photoVersion: r.photo_version,
  lastRev: Number(r.last_rev),
  createdBy: r.created_by,
  createdAt: r.created_at,
  archivedAt: r.archived_at,
});

const toMessage = (r: MessageDb): MessageRow => ({
  id: String(r.id),
  groupId: r.group_id,
  authorId: r.author_id,
  body: r.body,
  replyToId: r.reply_to_id === null ? null : String(r.reply_to_id),
  clientId: r.client_id,
  rev: Number(r.rev),
  createdAt: r.created_at,
  editedAt: r.edited_at,
  deletedAt: r.deleted_at,
  deletedBy: r.deleted_by,
});

// bigint columns are cast to text so ids never lose precision in JavaScript.
const groupColumns = (t = "") => `${t}id, ${t}slug, ${t}name, ${t}description, ${t}emoji, ${t}color, ${t}posting_policy, ${t}sort_order,
  ${t}pinned_message_id::text AS pinned_message_id, ${t}photo_version, ${t}last_rev::text AS last_rev, ${t}created_by, ${t}created_at,
  ${t}archived_at`;
const GROUP_COLUMNS = groupColumns();
const messageColumns = (t = "") => `${t}id::text AS id, ${t}group_id, ${t}author_id, ${t}body, ${t}reply_to_id::text AS reply_to_id,
  ${t}client_id, ${t}rev::text AS rev, ${t}created_at, ${t}edited_at, ${t}deleted_at, ${t}deleted_by`;
const MESSAGE_COLUMNS = messageColumns();

export class PgChatStore implements ChatStore {
  constructor(private readonly db: Queryable) {}

  async listGroups({ includeArchived }: { includeArchived: boolean }) {
    const { rows } = await this.db.query<GroupDb>(
      `SELECT ${GROUP_COLUMNS} FROM community_chat_groups
       WHERE $1 OR archived_at IS NULL
       ORDER BY sort_order, created_at`,
      [includeArchived],
    );
    return rows.map(toGroup);
  }

  async getGroupBySlug(slug: string) {
    const { rows } = await this.db.query<GroupDb>(`SELECT ${GROUP_COLUMNS} FROM community_chat_groups WHERE slug = $1`, [slug]);
    return rows[0] ? toGroup(rows[0]) : null;
  }

  async getGroupById(id: string) {
    const { rows } = await this.db.query<GroupDb>(`SELECT ${GROUP_COLUMNS} FROM community_chat_groups WHERE id = $1`, [id]);
    return rows[0] ? toGroup(rows[0]) : null;
  }

  async countGroups() {
    const { rows } = await this.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM community_chat_groups WHERE archived_at IS NULL`);
    return rows[0]?.n ?? 0;
  }

  async createGroup(g: NewGroup) {
    const { rows } = await this.db.query<GroupDb>(
      `INSERT INTO community_chat_groups (slug, name, description, emoji, color, posting_policy, created_by, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(max(sort_order), 0) + 10 FROM community_chat_groups))
       ON CONFLICT (slug) DO NOTHING
       RETURNING ${GROUP_COLUMNS}`,
      [g.slug, g.name, g.description, g.emoji, g.color, g.postingPolicy, g.createdBy],
    );
    return rows[0] ? toGroup(rows[0]) : null;
  }

  async updateGroup(id: string, u: GroupUpdate) {
    const sets: string[] = [];
    const values: unknown[] = [id];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (u.name !== undefined) set("name", u.name);
    if (u.description !== undefined) set("description", u.description);
    if (u.emoji !== undefined) set("emoji", u.emoji);
    if (u.color !== undefined) set("color", u.color);
    if (u.postingPolicy !== undefined) set("posting_policy", u.postingPolicy);
    if (u.archivedAt !== undefined) set("archived_at", u.archivedAt);
    sets.push("updated_at = now()");
    const { rows } = await this.db.query<GroupDb>(
      `UPDATE community_chat_groups SET ${sets.join(", ")} WHERE id = $1 RETURNING ${GROUP_COLUMNS}`,
      values,
    );
    return rows[0] ? toGroup(rows[0]) : null;
  }

  async reorderGroups(ids: readonly string[]) {
    await this.db.query(
      `UPDATE community_chat_groups g SET sort_order = o.ord * 10, updated_at = now()
       FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, ord)
       WHERE g.id = o.id`,
      [ids],
    );
  }

  async setPinned(groupId: string, messageId: string | null) {
    await this.db.query(`UPDATE community_chat_groups SET pinned_message_id = $2, updated_at = now() WHERE id = $1`, [groupId, messageId]);
  }

  async setGroupPhoto(groupId: string, photo: GroupPhoto | null, updatedBy: string) {
    // One statement, so the picture and the version the group list advertises always match.
    const { rows } = photo
      ? await this.db.query<GroupDb>(
          `WITH p AS (
             INSERT INTO community_chat_group_photos (group_id, content_type, bytes, version, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (group_id) DO UPDATE
             SET content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes, version = EXCLUDED.version,
                 updated_by = EXCLUDED.updated_by, updated_at = now()
             RETURNING group_id, version
           )
           UPDATE community_chat_groups g SET photo_version = p.version, updated_at = now()
           FROM p WHERE g.id = p.group_id
           RETURNING ${groupColumns("g.")}`,
          [groupId, photo.contentType, Buffer.from(photo.bytes.buffer, photo.bytes.byteOffset, photo.bytes.byteLength), photo.version, updatedBy],
        )
      : await this.db.query<GroupDb>(
          `WITH d AS (DELETE FROM community_chat_group_photos WHERE group_id = $1)
           UPDATE community_chat_groups SET photo_version = NULL, updated_at = now() WHERE id = $1
           RETURNING ${GROUP_COLUMNS}`,
          [groupId],
        );
    return rows[0] ? toGroup(rows[0]) : null;
  }

  async getGroupPhoto(groupId: string) {
    const { rows } = await this.db.query<{ content_type: string; bytes: Uint8Array; version: string }>(
      `SELECT content_type, bytes, version FROM community_chat_group_photos WHERE group_id = $1`,
      [groupId],
    );
    const r = rows[0];
    return r ? { contentType: r.content_type as GroupPhotoType, bytes: new Uint8Array(r.bytes), version: r.version } : null;
  }

  async insertMessage(m: NewMessage) {
    if (m.clientId) {
      const existing = await this.findByClientId(m.authorId, m.clientId);
      if (existing) return { row: existing, duplicate: true };
    }
    try {
      // One statement: the group row stays locked until it commits, so revisions in a group commit in order.
      const { rows } = await this.db.query<MessageDb>(
        `WITH g AS (
           UPDATE community_chat_groups SET last_rev = last_rev + 1
           WHERE id = $1 AND archived_at IS NULL
           RETURNING id, last_rev
         )
         INSERT INTO community_chat_messages (group_id, author_id, body, reply_to_id, client_id, rev)
         SELECT g.id, $2, $3, $4, $5, g.last_rev FROM g
         RETURNING ${MESSAGE_COLUMNS}`,
        [m.groupId, m.authorId, m.body, m.replyToId, m.clientId],
      );
      return rows[0] ? { row: toMessage(rows[0]), duplicate: false } : null;
    } catch (error) {
      // Two identical sends raced; the other one won.
      if (m.clientId && (error as { code?: string }).code === UNIQUE_VIOLATION) {
        const existing = await this.findByClientId(m.authorId, m.clientId);
        if (existing) return { row: existing, duplicate: true };
      }
      throw error;
    }
  }

  private async findByClientId(authorId: string, clientId: string) {
    const { rows } = await this.db.query<MessageDb>(
      `SELECT ${MESSAGE_COLUMNS} FROM community_chat_messages WHERE author_id = $1 AND client_id = $2`,
      [authorId, clientId],
    );
    return rows[0] ? toMessage(rows[0]) : null;
  }

  async getMessage(id: string) {
    const { rows } = await this.db.query<MessageDb>(`SELECT ${MESSAGE_COLUMNS} FROM community_chat_messages WHERE id = $1`, [id]);
    return rows[0] ? toMessage(rows[0]) : null;
  }

  async getMessages(ids: readonly string[]) {
    if (ids.length === 0) return [];
    const { rows } = await this.db.query<MessageDb>(`SELECT ${MESSAGE_COLUMNS} FROM community_chat_messages WHERE id = ANY($1::bigint[])`, [ids]);
    return rows.map(toMessage);
  }

  async updateMessage(id: string, u: MessageUpdate) {
    const change =
      u.kind === "edit"
        ? { sql: "body = $2, edited_at = now()", values: [u.body] }
        : { sql: "body = '', deleted_at = now(), deleted_by = $2", values: [u.deletedBy] };
    const { rows } = await this.db.query<MessageDb>(
      `WITH g AS (
         UPDATE community_chat_groups SET last_rev = last_rev + 1
         WHERE id = (SELECT group_id FROM community_chat_messages WHERE id = $1)
         RETURNING last_rev
       )
       UPDATE community_chat_messages m SET ${change.sql}, rev = g.last_rev
       FROM g WHERE m.id = $1
       RETURNING ${messageColumns("m.")}`,
      [id, ...change.values],
    );
    return rows[0] ? toMessage(rows[0]) : null;
  }

  async latestMessages(groupId: string, limit: number) {
    const { rows } = await this.db.query<MessageDb>(
      `SELECT ${MESSAGE_COLUMNS} FROM community_chat_messages WHERE group_id = $1 ORDER BY id DESC LIMIT $2`,
      [groupId, limit],
    );
    return rows.map(toMessage);
  }

  async messagesBefore(groupId: string, beforeId: string, limit: number) {
    const { rows } = await this.db.query<MessageDb>(
      `SELECT ${MESSAGE_COLUMNS} FROM community_chat_messages WHERE group_id = $1 AND id < $2 ORDER BY id DESC LIMIT $3`,
      [groupId, beforeId, limit],
    );
    return rows.map(toMessage);
  }

  async messagesSince(groupId: string, rev: number, limit: number) {
    const { rows } = await this.db.query<MessageDb>(
      `SELECT ${MESSAGE_COLUMNS} FROM community_chat_messages WHERE group_id = $1 AND rev > $2 ORDER BY rev LIMIT $3`,
      [groupId, rev, limit],
    );
    return rows.map(toMessage);
  }

  async lastMessages(groupIds: readonly string[]) {
    if (groupIds.length === 0) return new Map<string, MessageRow>();
    const { rows } = await this.db.query<MessageDb>(
      `SELECT m.* FROM unnest($1::uuid[]) AS g(id)
       CROSS JOIN LATERAL (
         SELECT ${MESSAGE_COLUMNS} FROM community_chat_messages
         WHERE group_id = g.id AND deleted_at IS NULL
         ORDER BY id DESC LIMIT 1
       ) m`,
      [groupIds],
    );
    return new Map(rows.map((r) => [r.group_id, toMessage(r)]));
  }

  async countRecentMessages(authorId: string, since: Date) {
    const { rows } = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM community_chat_messages WHERE author_id = $1 AND created_at >= $2`,
      [authorId, since],
    );
    return rows[0]?.n ?? 0;
  }

  async readStates(userId: string, groupIds: readonly string[], { lookbackSince, cap }: { lookbackSince: Date; cap: number }) {
    if (groupIds.length === 0) return new Map<string, ReadState>();
    const { rows } = await this.db.query<{ group_id: string; last_read: string; unread: number }>(
      `SELECT g.id AS group_id,
              COALESCE(rs.last_read_message_id, 0)::text AS last_read,
              (SELECT count(*)::int FROM (
                 SELECT 1 FROM community_chat_messages m
                 WHERE m.group_id = g.id
                   AND m.id > COALESCE(rs.last_read_message_id, 0)
                   AND m.deleted_at IS NULL
                   AND m.author_id <> $1
                   AND (rs.user_id IS NOT NULL OR m.created_at > $3)
                 LIMIT $4
               ) x) AS unread
       FROM unnest($2::uuid[]) AS g(id)
       LEFT JOIN community_chat_read_state rs ON rs.group_id = g.id AND rs.user_id = $1`,
      [userId, groupIds, lookbackSince, cap],
    );
    return new Map(rows.map((r) => [r.group_id, { lastReadId: r.last_read, unread: r.unread }]));
  }

  async markRead(userId: string, groupId: string, messageId: string) {
    await this.db.query(
      `INSERT INTO community_chat_read_state (user_id, group_id, last_read_message_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, group_id) DO UPDATE
       SET last_read_message_id = GREATEST(community_chat_read_state.last_read_message_id, EXCLUDED.last_read_message_id),
           updated_at = now()`,
      [userId, groupId, messageId],
    );
  }
}
