// The real chat service and HTTP handler running in the browser on the in-memory store, with sample members
// and messages. Only for the demo: nothing here ships to the app.

import { MemoryChatStore } from "../server/src/memoryStore";
import { CommunityChatService, type ChatMemberProfile, type ChatViewer } from "../server/src/service";
import { createChatHttpHandler } from "../server/src/http";
import { ChatApiError, type ChatTransport } from "../web/src/api";

export interface DemoPerson extends ChatMemberProfile {
  id: string;
  roles: string[];
}

export const PEOPLE: DemoPerson[] = [
  { id: "u-admin", handle: "vtimpact", displayName: "VT Impact Team", roles: ["member", "admin"], role: "admin" },
  { id: "u-mod", handle: "jordan", displayName: "Jordan Hale", roles: ["member", "moderator"], role: "moderator" },
  { id: "u-sam", handle: "sam", displayName: "Sam Okafor", roles: ["member"] },
  { id: "u-priya", handle: "priya", displayName: "Priya Raman", roles: ["member"] },
  { id: "u-marcus", handle: "marcus", displayName: "Marcus Webb", roles: ["member"] },
  { id: "u-lena", handle: "lena", displayName: "Lena Duarte", roles: ["member"] },
  { id: "u-tomas", handle: "tomas", displayName: "Tomás Reyes", roles: ["member"] },
];

/** The people the demo lets you act as. */
export const ACT_AS = PEOPLE.filter((p) => ["u-admin", "u-mod", "u-sam"].includes(p.id));

let seedTime: Date | null = null;
const clock = () => seedTime ?? new Date();
const store = new MemoryChatStore({ now: clock });
const directory = { lookup: async (ids: readonly string[]) => new Map(PEOPLE.filter((p) => ids.includes(p.id)).map((p) => [p.id, p] as const)) };
const service = new CommunityChatService({ store, directory, now: clock });
const handle = createChatHttpHandler(service);

const viewerOf = (p: DemoPerson): ChatViewer => ({ id: p.id, roles: p.roles, permissions: ["community.post"] });
let current: DemoPerson = ACT_AS[2]!;

export function setActingAs(id: string) {
  current = PEOPLE.find((p) => p.id === id) ?? current;
}
export const actingAs = () => current;

/** Sends requests straight to the handler, with a little latency so loading states are visible. */
export const demoTransport: ChatTransport = async ({ method, path, body, signal }) => {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 120));
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const url = new URL(path, "http://demo");
  const res = await handle({
    method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)),
    viewer: viewerOf(current),
  });
  if (res.status >= 400) {
    const e = (res.body as { error: { code: string; message: string; fields?: Record<string, string>; retryAfterSeconds?: number } }).error;
    throw new ChatApiError(res.status, e.code, e.message, e.fields ?? {}, e.retryAfterSeconds);
  }
  return res.body;
};

const person = (handleName: string) => viewerOf(PEOPLE.find((p) => p.handle === handleName)!);

async function seed() {
  const day = 86_400_000;
  const at = (daysAgo: number, hh: number, mm: number) => {
    const d = new Date(Date.now() - daysAgo * day);
    d.setHours(hh, mm, 0, 0);
    return d;
  };
  const say = async (when: Date, who: string, slug: string, body: string, replyTo?: string) => {
    seedTime = when;
    const { message } = await service.sendMessage(person(who), slug, { body, ...(replyTo ? { replyToId: replyTo } : {}) });
    return message.id;
  };

  const welcome = await say(at(2, 9, 0), "vtimpact", "general-chat", "Welcome to the VT Impact community 👋\n\nThis is the place to talk markets, ask questions and help each other. Be kind, share reasoning not tips, and remember nothing here is financial advice.");
  await say(at(2, 9, 4), "priya", "general-chat", "Thanks! Glad to be here.");
  const q = await say(at(1, 18, 12), "marcus", "general-chat", "Anyone else watching gold into the US open? The 4h structure looks like it’s building a base.");
  await say(at(1, 18, 15), "lena", "general-chat", "Same. I’m waiting for a clean break of the range high before doing anything.", q);
  await say(at(1, 18, 16), "lena", "general-chat", "The rule tester has a good walkthrough on range breaks: https://www.vtimpact.com/app/rule-tester");
  await say(at(0, 8, 31), "tomas", "general-chat", "Morning all ☕");
  await say(at(0, 8, 40), "jordan", "general-chat", "Reminder: the live Q&A is on Thursday. Drop questions in here beforehand and we’ll pick some.");
  seedTime = at(0, 8, 41);
  await service.setPinned(person("vtimpact"), "general-chat", { messageId: welcome });

  await say(at(3, 20, 2), "priya", "results", "Closed my first week following my plan. +2.1R overall, two losses where I moved my stop. Lesson learned: don’t touch the stop.");
  await say(at(3, 20, 30), "marcus", "results", "That’s a solid lesson to learn early. Nice work.");
  await say(at(0, 7, 55), "lena", "results", "Small loss on yesterday’s breakout, it faked out. Stuck to the size rule though, so −0.5R.");

  await say(at(1, 7, 30), "vtimpact", "beginners-signals", "How to read a signal in this group:\n\n1. Direction and instrument (e.g. XAUUSD buy)\n2. The level that confirms it\n3. Where the idea is wrong (stop)\n4. Why: the rule behind it\n\nAsk anything below. There are no silly questions here.");
  await say(at(1, 7, 42), "sam", "beginners-signals", "What does “confirms” mean exactly, a close above the level or just touching it?");
  await say(at(1, 7, 50), "jordan", "beginners-signals", "A candle close above it on the timeframe in the signal. A touch alone isn’t enough.");
  seedTime = null;

  // Sam has read everything up to yesterday, so today's messages show as unread.
  const sam = person("sam");
  for (const slug of ["general-chat", "results", "beginners-signals"]) {
    const page = await service.listMessages(sam, slug, { limit: 50 });
    const readUpTo = [...page.messages].reverse().find((m) => new Date(m.createdAt) < at(0, 0, 0));
    if (readUpTo) await service.markRead(sam, slug, readUpTo.id);
  }
}

export const ready = seed();

/** Someone says something every so often, so polling has something to show. */
const CHATTER = [
  ["priya", "Just finished the risk module, the position size calculator is really useful."],
  ["marcus", "Range high just broke on the 15m, waiting for the close."],
  ["tomas", "Does anyone journal their trades on paper or only in the app?"],
  ["lena", "App journal for me, the weekly review pulls from it automatically."],
] as const;
let chatterIndex = 0;
export function startChatter(ms = 25_000) {
  return setInterval(() => {
    const [who, body] = CHATTER[chatterIndex++ % CHATTER.length]!;
    void service.sendMessage(person(who), "general-chat", { body }).catch(() => {});
  }, ms);
}
