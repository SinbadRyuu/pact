import type { GroupColor } from "../../shared/limits";

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "Today", "Yesterday", "Monday" (this week), "12 October" (this year) or "12 October 2025". */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (sameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);
  if (d >= weekAgo) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
}

export const isSameDay = (a: string, b: string) => sameDay(new Date(a), new Date(b));

/** The short time in the group list: "14:05" today, "Mon" this week, "12/10/26" before that. */
export function listTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (sameDay(d, now)) return timeOfDay(iso);
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);
  if (d >= weekAgo) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function fullTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
}

export function initials(name: string) {
  const words = name
    .replace(/^vt impact\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export const GROUP_COLOR_VALUES: Record<GroupColor, string> = {
  cyan: "#3ee8ff",
  violet: "#8b6cff",
  magenta: "#ff4fd8",
  mint: "#3dffb2",
  gold: "#ffd25e",
  rose: "#ff5c8a",
  blue: "#5b8cff",
  orange: "#ff9f43",
};

export const GROUP_COLOR_LABELS: Record<GroupColor, string> = {
  cyan: "Cyan",
  violet: "Violet",
  magenta: "Magenta",
  mint: "Mint",
  gold: "Gold",
  rose: "Rose",
  blue: "Blue",
  orange: "Orange",
};

const NAME_COLORS: GroupColor[] = ["cyan", "violet", "magenta", "mint", "gold", "rose", "blue", "orange"];

/** A stable colour per member, so the same person always has the same name colour, as in Telegram. */
export function memberColor(id: string): GroupColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return NAME_COLORS[Math.abs(h) % NAME_COLORS.length]!;
}

export type TextPart = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"]+/gi;
const TRAILING = /[).,!?;:'"\]]+$/;

/** Splits text into plain runs and http(s) links. Rendered as React text, so nothing is parsed as HTML. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    let url = match[0];
    const trailing = TRAILING.exec(url)?.[0] ?? "";
    // Keep a closing bracket that belongs to the URL, as in Wikipedia links.
    const keep = trailing.startsWith(")") && url.includes("(") ? ")" : "";
    url = url.slice(0, url.length - trailing.length) + keep;
    const start = match.index;
    if (start > last) parts.push({ kind: "text", text: text.slice(last, start) });
    parts.push({ kind: "link", text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
