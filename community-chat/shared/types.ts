// The JSON shapes the chat API returns. Dates are ISO strings; message ids are strings because they are Postgres bigints.

import type { GroupColor, PostingPolicy } from "./limits";

export type { GroupColor, PostingPolicy };

export type StaffRole = "admin" | "moderator";

export interface ChatAuthor {
  id: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: StaffRole | null;
}

export interface ChatReplyPreview {
  id: string;
  authorName: string;
  excerpt: string;
  deleted: boolean;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  author: ChatAuthor;
  /** Empty when the message was deleted. */
  body: string;
  replyTo: ChatReplyPreview | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  /** Bumped on every insert, edit and delete in the group. Clients poll with `since=<cursor>`. */
  rev: number;
  /** The id the sender's client chose, so it can replace its optimistic copy. Only set on your own messages. */
  clientId: string | null;
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ChatGroup {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  color: GroupColor;
  /** Changes whenever an admin uploads a new picture. Null when the group uses its emoji. */
  photoVersion: string | null;
  postingPolicy: PostingPolicy;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  /** Messages with a higher id than this are unread for the viewer. */
  lastReadId: string;
  canPost: boolean;
  /** Why the viewer cannot post, when `canPost` is false. */
  postBlockedReason: PostBlockedReason | null;
}

export type PostBlockedReason = "admins_only" | "archived" | "no_permission";

export interface ChatViewerInfo {
  id: string;
  canManageGroups: boolean;
  canModerate: boolean;
}

export interface GroupListResponse {
  groups: ChatGroup[];
  viewer: ChatViewerInfo;
}

export interface MessagePage {
  messages: ChatMessage[];
  /** Pass back as `since` to get what changed. Null for pages of older history. */
  cursor: number | null;
  /** More older messages exist (initial and `before` pages) or more changes are waiting (`since` pages). */
  hasMore: boolean;
  pinned: ChatMessage | null;
}

export interface GroupInput {
  name: string;
  slug?: string;
  description?: string;
  emoji?: string;
  color?: GroupColor;
  postingPolicy?: PostingPolicy;
}

export interface GroupPatch {
  name?: string;
  description?: string;
  emoji?: string;
  color?: GroupColor;
  postingPolicy?: PostingPolicy;
  archived?: boolean;
}

export interface GroupPhotoInput {
  /** A data URL: `data:image/webp;base64,...` (or image/jpeg, image/png). */
  image: string;
}

export interface SendMessageInput {
  body: string;
  replyToId?: string | null;
  /** A random id from the client so a retried send is not posted twice. */
  clientId?: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    retryAfterSeconds?: number;
  };
}
