// Limits shared by the server (which enforces them) and the web client (which shows them).

export const CHAT_LIMITS = {
  messageMax: 2000,
  groupNameMin: 3,
  groupNameMax: 60,
  groupDescriptionMax: 280,
  groupEmojiMax: 16,
  slugMax: 40,
  clientIdMax: 64,
  pageSize: 50,
  pageSizeMax: 100,
  sincePageSize: 200,
  /** Active groups. Archived ones don't count. */
  maxGroups: 50,
  /** Every group, archived included, as sent when reordering. */
  maxGroupsIncludingArchived: 500,
  /** Authors can edit a message for this long after sending it, as in Telegram. */
  editWindowHours: 48,
  /** Members (not staff) can send this many messages per window. */
  rateLimitMessages: 6,
  rateLimitWindowSeconds: 10,
  /** Without a read marker, only messages this recent count as unread. */
  unreadLookbackDays: 7,
  unreadCap: 99,
} as const;

/** Paths under /app/community that a group slug must not take. */
export const RESERVED_SLUGS: readonly string[] = ["new", "posts", "members", "manage", "settings", "edit", "admin", "groups", "messages", "order"];

export const GROUP_COLORS = ["cyan", "violet", "magenta", "mint", "gold", "rose", "blue", "orange"] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];

export const POSTING_POLICIES = ["everyone", "admins"] as const;
export type PostingPolicy = (typeof POSTING_POLICIES)[number];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Turns a group name into a URL slug: "VT Impact Results" → "vt-impact-results". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CHAT_LIMITS.slugMax)
    .replace(/-+$/g, "");
}
