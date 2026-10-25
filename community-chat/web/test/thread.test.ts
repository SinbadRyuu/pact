import { describe, expect, it } from "vitest";
import type { ChatMessage, MessagePage } from "../../shared/types";
import { linkify } from "../src/format";
import { firstUnreadId, initialThread, sortedMessages, threadReducer, type ThreadState } from "../src/thread";

const msg = (id: string, rev: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  groupId: "g",
  author: { id: "u2", handle: "u2", displayName: "User Two", avatarUrl: null, role: null },
  body: `message ${id}`,
  replyTo: null,
  createdAt: "2026-10-25T12:00:00.000Z",
  editedAt: null,
  deleted: false,
  rev,
  clientId: null,
  mine: false,
  canEdit: false,
  canDelete: false,
  ...extra,
});

const page = (messages: ChatMessage[], cursor: number | null, hasMore = false): MessagePage => ({ messages, cursor, hasMore, pinned: null });

function loaded(messages: ChatMessage[], cursor = messages.length): ThreadState {
  return threadReducer(initialThread("general"), { type: "loaded", slug: "general", page: page(messages, cursor, true) });
}

describe("threadReducer", () => {
  it("loads, merges changes and orders by id", () => {
    let s = loaded([msg("9", 1), msg("10", 2)]);
    expect(s).toMatchObject({ status: "ready", cursor: 2, hasOlder: true });
    s = threadReducer(s, { type: "merged", slug: "general", page: page([msg("11", 3), msg("9", 4, { body: "edited" })], 4) });
    expect(sortedMessages(s).map((m) => [m.id, m.body])).toEqual([
      ["9", "edited"],
      ["10", "message 10"],
      ["11", "message 11"],
    ]);
    expect(s.cursor).toBe(4);
  });

  it("never replaces a message with an older revision", () => {
    let s = loaded([msg("1", 5, { body: "newest" })]);
    s = threadReducer(s, { type: "upsert", slug: "general", message: msg("1", 3, { body: "stale" }) });
    expect(s.messages.get("1")!.body).toBe("newest");
  });

  it("ignores responses for a group the member has left", () => {
    const s = loaded([msg("1", 1)]);
    expect(threadReducer(s, { type: "merged", slug: "results", page: page([msg("2", 2)], 2) })).toBe(s);
  });

  it("swaps a pending message for the real one when either the send or a poll returns it", () => {
    const pending = { clientId: "c1", body: "hi", replyTo: null, createdAt: "2026-10-25T12:00:00.000Z", status: "sending" as const, error: null };
    let s = threadReducer(loaded([]), { type: "pending", slug: "general", pending });
    expect(s.pending).toHaveLength(1);
    const viaPoll = threadReducer(s, { type: "merged", slug: "general", page: page([msg("5", 1, { clientId: "c1", mine: true })], 1) });
    expect(viaPoll.pending).toHaveLength(0);
    expect(viaPoll.messages.has("5")).toBe(true);

    s = threadReducer(s, { type: "sendFailed", slug: "general", clientId: "c1", error: "Network down" });
    expect(s.pending[0]).toMatchObject({ status: "failed", error: "Network down" });
    s = threadReducer(s, { type: "retrying", slug: "general", clientId: "c1" });
    expect(s.pending[0]).toMatchObject({ status: "sending", error: null });
    s = threadReducer(s, { type: "sent", slug: "general", clientId: "c1", message: msg("5", 1, { clientId: "c1", mine: true }) });
    expect(s.pending).toHaveLength(0);
  });

  it("keeps showing messages while reconnecting, and shows an error when nothing has loaded", () => {
    const ready = threadReducer(loaded([msg("1", 1)]), { type: "pollFailed", slug: "general", error: "offline", fatal: false });
    expect(ready).toMatchObject({ status: "ready", reconnecting: true });
    const fresh = threadReducer(initialThread("general"), { type: "pollFailed", slug: "general", error: "offline", fatal: false });
    expect(fresh).toMatchObject({ status: "error", error: "offline", fatal: false });
    const gone = threadReducer(loaded([msg("1", 1)]), { type: "pollFailed", slug: "general", error: "Not available", fatal: true });
    expect(gone).toMatchObject({ status: "error", fatal: true });
  });

  it("adds older pages without moving the cursor", () => {
    let s = loaded([msg("20", 7)], 7);
    s = threadReducer(s, { type: "olderStarted", slug: "general" });
    s = threadReducer(s, { type: "olderLoaded", slug: "general", page: page([msg("18", 3), msg("19", 4)], null, false) });
    expect(sortedMessages(s).map((m) => m.id)).toEqual(["18", "19", "20"]);
    expect(s).toMatchObject({ cursor: 7, hasOlder: false, loadingOlder: false });
  });
});

describe("firstUnreadId", () => {
  const list = [msg("1", 1), msg("2", 2, { mine: true }), msg("3", 3), msg("4", 4, { deleted: true }), msg("5", 5)];

  it("puts the line before the first unread message from someone else", () => {
    expect(firstUnreadId(list, "2", 2)).toBe("3");
    expect(firstUnreadId(list, "3", 1)).toBe("5");
  });

  it("uses the unread count when there is no read marker yet", () => {
    expect(firstUnreadId(list, "0", 1)).toBe("5");
    expect(firstUnreadId(list, "0", 50)).toBe("1");
  });

  it("is null when nothing is unread", () => {
    expect(firstUnreadId(list, "5", 0)).toBeNull();
    expect(firstUnreadId(list, "5", 3)).toBeNull();
  });
});

describe("linkify", () => {
  it("finds http and https links and leaves trailing punctuation outside", () => {
    expect(linkify("See https://vtimpact.com/app/signals. Then (http://example.com/a_(b)) ok")).toEqual([
      { kind: "text", text: "See " },
      { kind: "link", text: "https://vtimpact.com/app/signals", href: "https://vtimpact.com/app/signals" },
      { kind: "text", text: ". Then (" },
      { kind: "link", text: "http://example.com/a_(b)", href: "http://example.com/a_(b)" },
      { kind: "text", text: ") ok" },
    ]);
  });

  it("never links other schemes", () => {
    expect(linkify("javascript:alert(1) and ftp://x")).toEqual([{ kind: "text", text: "javascript:alert(1) and ftp://x" }]);
  });
});
