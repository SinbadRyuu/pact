// Parses untrusted request bodies into clean values, collecting one message per bad field.

import {
  CHAT_LIMITS,
  GROUP_COLORS,
  POSTING_POLICIES,
  RESERVED_SLUGS,
  SLUG_PATTERN,
  slugify,
  type GroupColor,
  type GroupPhotoType,
  type PostingPolicy,
} from "../../shared/limits";
import type { GroupInput, GroupPatch, SendMessageInput } from "../../shared/types";
import { invalid } from "./errors";

type Fields = Record<string, string>;

const MESSAGE_ID = /^[1-9]\d{0,17}$/;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

function record(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw invalid({}, "The request body must be a JSON object.");
  return body as Record<string, unknown>;
}

/** Drops control characters (keeping newlines and tabs), trims trailing spaces and limits blank lines to two in a row. */
export function cleanMessageBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u2028\u2029]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function cleanLine(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function optionalString(value: unknown, field: string, fields: Fields): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    fields[field] = "Must be text.";
    return undefined;
  }
  return value;
}

export function parseMessageId(value: unknown, field = "messageId"): string {
  if (typeof value !== "string" || !MESSAGE_ID.test(value)) throw invalid({ [field]: "Not a valid message." });
  return value;
}

export function parseSendMessage(body: unknown): { body: string; replyToId: string | null; clientId: string | null } {
  const input = record(body) as Partial<Record<keyof SendMessageInput, unknown>>;
  const fields: Fields = {};
  const text = typeof input.body === "string" ? cleanMessageBody(input.body) : "";
  if (!text) fields.body = "Write a message first.";
  else if (text.length > CHAT_LIMITS.messageMax) fields.body = `Messages can be up to ${CHAT_LIMITS.messageMax} characters.`;

  let replyToId: string | null = null;
  if (input.replyToId !== undefined && input.replyToId !== null) {
    if (typeof input.replyToId === "string" && MESSAGE_ID.test(input.replyToId)) replyToId = input.replyToId;
    else fields.replyToId = "Not a valid message.";
  }

  let clientId: string | null = null;
  if (input.clientId !== undefined && input.clientId !== null) {
    if (typeof input.clientId === "string" && CLIENT_ID.test(input.clientId)) clientId = input.clientId;
    else fields.clientId = "Not a valid client id.";
  }

  if (Object.keys(fields).length) throw invalid(fields);
  return { body: text, replyToId, clientId };
}

export function parseEditMessage(body: unknown): string {
  const input = record(body);
  const text = typeof input.body === "string" ? cleanMessageBody(input.body) : "";
  if (!text) throw invalid({ body: "A message cannot be empty. Delete it instead." });
  if (text.length > CHAT_LIMITS.messageMax) throw invalid({ body: `Messages can be up to ${CHAT_LIMITS.messageMax} characters.` });
  return text;
}

function checkName(value: string, fields: Fields): string {
  const name = cleanLine(value);
  if (name.length < CHAT_LIMITS.groupNameMin || name.length > CHAT_LIMITS.groupNameMax) {
    fields.name = `Use ${CHAT_LIMITS.groupNameMin} to ${CHAT_LIMITS.groupNameMax} characters.`;
  }
  return name;
}

function checkDescription(value: string, fields: Fields): string {
  const description = cleanLine(value);
  if (description.length > CHAT_LIMITS.groupDescriptionMax) fields.description = `Use up to ${CHAT_LIMITS.groupDescriptionMax} characters.`;
  return description;
}

function checkEmoji(value: string, fields: Fields): string {
  const emoji = value.trim();
  if (emoji.length > CHAT_LIMITS.groupEmojiMax || /\s/.test(emoji)) fields.emoji = "Use a single emoji, or leave it empty.";
  return emoji;
}

function checkColor(value: unknown, fields: Fields): GroupColor | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && (GROUP_COLORS as readonly string[]).includes(value)) return value as GroupColor;
  fields.color = "Choose one of the listed colours.";
  return undefined;
}

function checkPolicy(value: unknown, fields: Fields): PostingPolicy | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && (POSTING_POLICIES as readonly string[]).includes(value)) return value as PostingPolicy;
  fields.postingPolicy = "Choose who can send messages.";
  return undefined;
}

export function parseNewGroup(body: unknown): Required<GroupInput> {
  const input = record(body) as Partial<Record<keyof GroupInput, unknown>>;
  const fields: Fields = {};
  const name = checkName(optionalString(input.name, "name", fields) ?? "", fields);

  const rawSlug = optionalString(input.slug, "slug", fields);
  const slug = rawSlug !== undefined && rawSlug.trim() !== "" ? rawSlug.trim().toLowerCase() : slugify(name);
  if (!fields.slug && !fields.name) {
    if (!slug || slug.length > CHAT_LIMITS.slugMax || !SLUG_PATTERN.test(slug)) {
      fields.slug = `Use lowercase letters, numbers and single hyphens, up to ${CHAT_LIMITS.slugMax} characters.`;
    } else if (RESERVED_SLUGS.includes(slug)) {
      fields.slug = "This link is reserved. Choose another.";
    }
  }

  const description = checkDescription(optionalString(input.description, "description", fields) ?? "", fields);
  const emoji = checkEmoji(optionalString(input.emoji, "emoji", fields) ?? "", fields);
  const color = checkColor(input.color, fields) ?? "cyan";
  const postingPolicy = checkPolicy(input.postingPolicy, fields) ?? "everyone";

  if (Object.keys(fields).length) throw invalid(fields);
  return { name, slug, description, emoji, color, postingPolicy };
}

export function parseGroupPatch(body: unknown): GroupPatch {
  const input = record(body) as Partial<Record<keyof GroupPatch | "slug", unknown>>;
  const fields: Fields = {};
  const patch: GroupPatch = {};

  if (input.slug !== undefined) fields.slug = "A group's link cannot change after it is created.";
  const name = optionalString(input.name, "name", fields);
  if (name !== undefined) patch.name = checkName(name, fields);
  const description = optionalString(input.description, "description", fields);
  if (description !== undefined) patch.description = checkDescription(description, fields);
  const emoji = optionalString(input.emoji, "emoji", fields);
  if (emoji !== undefined) patch.emoji = checkEmoji(emoji, fields);
  const color = checkColor(input.color, fields);
  if (color) patch.color = color;
  const postingPolicy = checkPolicy(input.postingPolicy, fields);
  if (postingPolicy) patch.postingPolicy = postingPolicy;
  if (input.archived !== undefined) {
    if (typeof input.archived === "boolean") patch.archived = input.archived;
    else fields.archived = "Must be true or false.";
  }

  if (Object.keys(fields).length) throw invalid(fields);
  if (Object.keys(patch).length === 0) throw invalid({}, "Nothing to change.");
  return patch;
}

export function parseSlugList(body: unknown): string[] {
  const input = record(body);
  const slugs = input.slugs;
  if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > CHAT_LIMITS.maxGroupsIncludingArchived || !slugs.every((s) => typeof s === "string" && SLUG_PATTERN.test(s))) {
    throw invalid({ slugs: "Send every group's link in the new order." });
  }
  if (new Set(slugs).size !== slugs.length) throw invalid({ slugs: "Each group can appear once." });
  return slugs as string[];
}

export function parsePin(body: unknown): string | null {
  const input = record(body);
  if (input.messageId === null) return null;
  return parseMessageId(input.messageId);
}

export function parseLimit(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw invalid({ limit: "Must be a whole number above zero." });
  return Math.min(n, max);
}

export function parseRev(value: string): number {
  const n = Number(value);
  if (!/^\d{1,15}$/.test(value) || !Number.isSafeInteger(n)) throw invalid({ since: "Not a valid cursor." });
  return n;
}

const DATA_URL = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;

/** What the file really is, from its first bytes. The type the upload claims is not trusted. */
function sniffImage(bytes: Uint8Array): GroupPhotoType | null {
  const at = (i: number, ...expected: number[]) => expected.every((b, j) => bytes[i + j] === b);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** Accepts `{ image: "data:image/webp;base64,..." }` holding a WebP, JPEG or PNG within the size limit. */
export function parseGroupPhoto(body: unknown): { contentType: GroupPhotoType; bytes: Uint8Array } {
  const input = record(body);
  const match = typeof input.image === "string" ? DATA_URL.exec(input.image) : null;
  if (!match) throw invalid({ image: "Upload a JPG, PNG or WebP picture." });
  // A base64 string four characters long holds three bytes; reject oversized uploads before decoding them.
  if ((match[2]!.length / 4) * 3 > CHAT_LIMITS.groupPhotoMaxBytes + 3) throw invalid({ image: tooBig() });
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
  } catch {
    throw invalid({ image: "The picture could not be read. Try another file." });
  }
  if (bytes.length > CHAT_LIMITS.groupPhotoMaxBytes) throw invalid({ image: tooBig() });
  const actual = sniffImage(bytes);
  if (!actual || actual !== match[1]) throw invalid({ image: "This file isn’t a valid JPG, PNG or WebP picture." });
  return { contentType: actual, bytes };
}

const tooBig = () => `Pictures can be up to ${Math.round(CHAT_LIMITS.groupPhotoMaxBytes / 1000)} KB.`;
