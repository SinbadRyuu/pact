import { beforeEach, describe, expect, it } from "vitest";
import { CHAT_LIMITS } from "../../shared/limits";
import { ChatError } from "../src/errors";
import { MemoryChatStore } from "../src/memoryStore";
import { CommunityChatService, type ChatViewer, type MemberDirectory } from "../src/service";

const admin: ChatViewer = { id: "admin-1", roles: ["member", "admin"], permissions: ["community.post"] };
const moderator: ChatViewer = { id: "mod-1", roles: ["member", "moderator"], permissions: ["community.post"] };
const alice: ChatViewer = { id: "alice", roles: ["member"], permissions: ["community.post"] };
const bob: ChatViewer = { id: "bob", roles: ["member"], permissions: ["community.post"] };
const suspended: ChatViewer = { id: "sus", roles: ["member"], permissions: [] };

const directory: MemberDirectory = {
  async lookup(ids) {
    const known: Record<string, { handle: string; displayName: string; role?: "admin" | "moderator" }> = {
      "admin-1": { handle: "vtadmin", displayName: "VT Admin", role: "admin" },
      "mod-1": { handle: "mod", displayName: "Moderator", role: "moderator" },
      alice: { handle: "alice", displayName: "Alice" },
      bob: { handle: "bob", displayName: "Bob" },
    };
    return new Map(ids.flatMap((id) => (known[id] ? [[id, known[id]!] as const] : [])));
  },
};

async function rejects(promise: Promise<unknown>, status: number, code?: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ChatError);
  expect((error as ChatError).status).toBe(status);
  if (code) expect((error as ChatError).code).toBe(code);
  return error as ChatError;
}

describe("CommunityChatService", () => {
  let now: Date;
  let service: CommunityChatService;

  beforeEach(() => {
    now = new Date("2026-10-25T12:00:00Z");
    const clock = () => new Date(now);
    service = new CommunityChatService({ store: new MemoryChatStore({ now: clock }), directory, now: clock });
  });

  const tick = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };

  describe("groups", () => {
    it("lists the default groups with the viewer's abilities", async () => {
      const res = await service.listGroups(alice);
      expect(res.groups.map((g) => g.name)).toEqual(["VT Impact General Chat", "VT Impact Results", "VT Impact Beginners Signal Group"]);
      expect(res.groups.every((g) => g.canPost)).toBe(true);
      expect(res.viewer).toEqual({ id: "alice", canManageGroups: false, canModerate: false });
      expect((await service.listGroups(admin)).viewer).toMatchObject({ canManageGroups: true, canModerate: true });
      expect((await service.listGroups(moderator)).viewer).toMatchObject({ canManageGroups: false, canModerate: true });
    });

    it("lets admins create groups", async () => {
      const group = await service.createGroup(admin, { name: "VT Impact Crypto", emoji: "🪙", color: "gold" });
      expect(group).toMatchObject({ slug: "vt-impact-crypto", name: "VT Impact Crypto", postingPolicy: "everyone", canPost: true });
      expect((await service.listGroups(alice)).groups.map((g) => g.slug)).toContain("vt-impact-crypto");
    });

    it("does not let members or moderators create, edit or reorder groups", async () => {
      for (const viewer of [alice, moderator]) {
        await rejects(service.createGroup(viewer, { name: "My private room" }), 403, "admins_only");
        await rejects(service.updateGroup(viewer, "general-chat", { name: "Renamed" }), 403, "admins_only");
        await rejects(service.reorderGroups(viewer, { slugs: ["results", "general-chat", "beginners-signals"] }), 403, "admins_only");
      }
    });

    it("makes links from accented names", async () => {
      expect((await service.createGroup(admin, { name: "Café Tomás Trading" })).slug).toBe("cafe-tomas-trading");
    });

    it("validates new groups", async () => {
      const e = await rejects(service.createGroup(admin, { name: "x", color: "plaid", postingPolicy: "nobody" }), 422);
      expect(Object.keys(e.fields!)).toEqual(expect.arrayContaining(["name", "color", "postingPolicy"]));
      await rejects(service.createGroup(admin, { name: "Members", slug: "members" }), 422);
      await rejects(service.createGroup(admin, { name: "Another general", slug: "general-chat" }), 422);
      await rejects(service.createGroup(admin, { name: "Bad link", slug: "Bad Link!" }), 422);
    });

    it("stops at the group limit, but archived groups don't count and can still be reordered", async () => {
      for (let i = 3; i < CHAT_LIMITS.maxGroups; i++) await service.createGroup(admin, { name: `Group number ${i}` });
      await rejects(service.createGroup(admin, { name: "One too many" }), 409, "too_many_groups");
      await service.updateGroup(admin, "results", { archived: true });
      await service.createGroup(admin, { name: "Fits again" });
      const slugs = (await service.listGroups(admin)).groups.map((g) => g.slug);
      expect(slugs).toHaveLength(CHAT_LIMITS.maxGroups + 1);
      await service.reorderGroups(admin, { slugs: [...slugs].reverse() });
      expect((await service.listGroups(admin)).groups[0]!.slug).toBe("fits-again");
    });

    it("edits a group but never its link", async () => {
      const g = await service.updateGroup(admin, "results", { name: "Member Results", description: "Wins and lessons", postingPolicy: "admins" });
      expect(g).toMatchObject({ slug: "results", name: "Member Results", postingPolicy: "admins" });
      await rejects(service.updateGroup(admin, "results", { slug: "new-results" }), 422);
      await rejects(service.updateGroup(admin, "results", {}), 422);
      await rejects(service.updateGroup(admin, "nope", { name: "Whatever" }), 404);
    });

    it("hides archived groups from everyone but admins, and restores them", async () => {
      await service.updateGroup(admin, "results", { archived: true });
      expect((await service.listGroups(alice)).groups.map((g) => g.slug)).not.toContain("results");
      await rejects(service.listMessages(alice, "results", { limit: 10 }), 404);
      const adminView = (await service.listGroups(admin)).groups.find((g) => g.slug === "results")!;
      expect(adminView).toMatchObject({ archived: true, canPost: false, postBlockedReason: "archived" });
      await rejects(service.sendMessage(admin, "results", { body: "hi" }), 403, "archived");
      await service.updateGroup(admin, "results", { archived: false });
      expect((await service.listGroups(alice)).groups.map((g) => g.slug)).toContain("results");
    });

    it("reorders groups when given every slug once", async () => {
      await service.reorderGroups(admin, { slugs: ["beginners-signals", "general-chat", "results"] });
      expect((await service.listGroups(alice)).groups.map((g) => g.slug)).toEqual(["beginners-signals", "general-chat", "results"]);
      await rejects(service.reorderGroups(admin, { slugs: ["general-chat", "results"] }), 422);
      await rejects(service.reorderGroups(admin, { slugs: ["general-chat", "general-chat", "results"] }), 422);
    });
  });

  describe("messages", () => {
    it("lets every member post in group chats", async () => {
      const m = await service.sendMessage(alice, "general-chat", { body: "  Hello everyone!  " });
      expect(m.message).toMatchObject({ body: "Hello everyone!", mine: true, canEdit: true, canDelete: true, author: { displayName: "Alice", handle: "alice" } });
      const page = await service.listMessages(bob, "general-chat", { limit: 50 });
      expect(page.messages.map((x) => x.body)).toEqual(["Hello everyone!"]);
      expect(page.messages[0]).toMatchObject({ mine: false, canEdit: false, canDelete: false });
    });

    it("keeps admin-only groups for admins", async () => {
      await service.updateGroup(admin, "beginners-signals", { postingPolicy: "admins" });
      await rejects(service.sendMessage(alice, "beginners-signals", { body: "Can I post?" }), 403, "admins_only");
      await rejects(service.sendMessage(moderator, "beginners-signals", { body: "Can I post?" }), 403, "admins_only");
      expect((await service.sendMessage(admin, "beginners-signals", { body: "XAUUSD buy above 2400" })).message.author.role).toBe("admin");
      const g = (await service.listGroups(alice)).groups.find((x) => x.slug === "beginners-signals")!;
      expect(g).toMatchObject({ canPost: false, postBlockedReason: "admins_only" });
    });

    it("respects the community post permission", async () => {
      await rejects(service.sendMessage(suspended, "general-chat", { body: "hi" }), 403, "no_permission");
      const open = new CommunityChatService({ store: new MemoryChatStore(), directory, postPermission: null });
      expect((await open.sendMessage(suspended, "general-chat", { body: "hi" })).message.body).toBe("hi");
    });

    it("validates message bodies", async () => {
      await rejects(service.sendMessage(alice, "general-chat", { body: "   " }), 422);
      await rejects(service.sendMessage(alice, "general-chat", { body: "x".repeat(CHAT_LIMITS.messageMax + 1) }), 422);
      await rejects(service.sendMessage(alice, "general-chat", "hi"), 422);
      const m = await service.sendMessage(alice, "general-chat", { body: "a\u0000b\r\n\n\n\n\n\nc  " });
      expect(m.message.body).toBe("ab\n\n\nc");
    });

    it("only allows replies to visible messages in the same group", async () => {
      const original = (await service.sendMessage(alice, "general-chat", { body: "Question?" })).message;
      const reply = (await service.sendMessage(bob, "general-chat", { body: "Answer", replyToId: original.id })).message;
      expect(reply.replyTo).toEqual({ id: original.id, authorName: "Alice", excerpt: "Question?", deleted: false });
      await rejects(service.sendMessage(bob, "results", { body: "Cross-group", replyToId: original.id }), 422);
      await service.deleteMessage(alice, original.id);
      await rejects(service.sendMessage(bob, "general-chat", { body: "Late", replyToId: original.id }), 422);
      const page = await service.listMessages(bob, "general-chat", { limit: 50 });
      expect(page.messages.find((m) => m.id === reply.id)!.replyTo).toMatchObject({ deleted: true, excerpt: "" });
    });

    it("does not post a retried send twice", async () => {
      const first = await service.sendMessage(alice, "general-chat", { body: "once", clientId: "abcdefgh1234" });
      const again = await service.sendMessage(alice, "general-chat", { body: "once", clientId: "abcdefgh1234" });
      expect(again).toMatchObject({ duplicate: true, message: { id: first.message.id } });
      expect((await service.listMessages(alice, "general-chat", { limit: 50 })).messages).toHaveLength(1);
    });

    it("rate limits members but not staff", async () => {
      for (let i = 0; i < CHAT_LIMITS.rateLimitMessages; i++) await service.sendMessage(alice, "general-chat", { body: `m${i}` });
      const e = await rejects(service.sendMessage(alice, "general-chat", { body: "spam" }), 429, "rate_limited");
      expect(e.retryAfterSeconds).toBe(CHAT_LIMITS.rateLimitWindowSeconds);
      tick(CHAT_LIMITS.rateLimitWindowSeconds * 1000 + 1);
      await service.sendMessage(alice, "general-chat", { body: "ok again" });
      for (let i = 0; i < CHAT_LIMITS.rateLimitMessages + 3; i++) await service.sendMessage(moderator, "general-chat", { body: `staff ${i}` });
    });

    it("lets authors edit within the window and nobody else", async () => {
      const m = (await service.sendMessage(alice, "general-chat", { body: "typo" })).message;
      await rejects(service.editMessage(bob, m.id, { body: "hacked" }), 403);
      await rejects(service.editMessage(admin, m.id, { body: "admin edit" }), 403);
      await rejects(service.editMessage(alice, m.id, { body: "typo" }), 409, "nothing_to_change");
      const edited = await service.editMessage(alice, m.id, { body: "fixed" });
      expect(edited).toMatchObject({ body: "fixed", rev: 2 });
      expect(edited.editedAt).not.toBeNull();
      tick(CHAT_LIMITS.editWindowHours * 3_600_000);
      await rejects(service.editMessage(alice, m.id, { body: "too late" }), 403, "edit_window_passed");
      expect((await service.listMessages(alice, "general-chat", { limit: 50 })).messages[0]!.canEdit).toBe(false);
    });

    it("lets authors delete their own messages and staff delete any", async () => {
      const a = (await service.sendMessage(alice, "general-chat", { body: "mine" })).message;
      const b = (await service.sendMessage(alice, "general-chat", { body: "rule-breaking" })).message;
      await rejects(service.deleteMessage(bob, a.id), 403);
      await service.deleteMessage(alice, a.id);
      await service.deleteMessage(moderator, b.id);
      await rejects(service.deleteMessage(alice, a.id), 404);
      const page = await service.listMessages(bob, "general-chat", { limit: 50 });
      expect(page.messages.map((m) => [m.deleted, m.body, m.canDelete])).toEqual([
        [true, "", false],
        [true, "", false],
      ]);
      expect((await service.listGroups(bob)).groups[0]!.lastMessage).toBeNull();
    });

    it("reports edits and deletions to pollers through the cursor", async () => {
      const a = (await service.sendMessage(alice, "general-chat", { body: "one" })).message;
      const first = await service.listMessages(bob, "general-chat", { limit: 50 });
      expect(first.cursor).toBe(1);
      const b = (await service.sendMessage(bob, "general-chat", { body: "two" })).message;
      await service.editMessage(alice, a.id, { body: "one (edited)" });
      const changes = await service.listMessages(bob, "general-chat", { limit: 50, since: first.cursor! });
      expect(changes.messages.map((m) => [m.id, m.body])).toEqual([
        [b.id, "two"],
        [a.id, "one (edited)"],
      ]);
      expect(changes.cursor).toBe(3);
      const none = await service.listMessages(bob, "general-chat", { limit: 50, since: 3 });
      expect(none).toMatchObject({ messages: [], cursor: 3, hasMore: false });
    });

    it("pages back through history", async () => {
      for (let i = 1; i <= 7; i++) await service.sendMessage(admin, "general-chat", { body: `m${i}` });
      const latest = await service.listMessages(alice, "general-chat", { limit: 3 });
      expect(latest.messages.map((m) => m.body)).toEqual(["m5", "m6", "m7"]);
      expect(latest.hasMore).toBe(true);
      const older = await service.listMessages(alice, "general-chat", { limit: 3, before: latest.messages[0]!.id });
      expect(older.messages.map((m) => m.body)).toEqual(["m2", "m3", "m4"]);
      expect(older).toMatchObject({ hasMore: true, cursor: null });
      const oldest = await service.listMessages(alice, "general-chat", { limit: 3, before: older.messages[0]!.id });
      expect(oldest.messages.map((m) => m.body)).toEqual(["m1"]);
      expect(oldest.hasMore).toBe(false);
    });

    it("shows a former member when the author is gone", async () => {
      const ghost: ChatViewer = { id: "ghost", roles: [], permissions: ["community.post"] };
      await service.sendMessage(ghost, "general-chat", { body: "boo" });
      const page = await service.listMessages(alice, "general-chat", { limit: 50 });
      expect(page.messages[0]!.author).toEqual({ id: "ghost", handle: null, displayName: "Former member", avatarUrl: null, role: null });
    });
  });

  describe("pins and unread counts", () => {
    it("lets staff pin, and unpins deleted messages", async () => {
      const m = (await service.sendMessage(admin, "general-chat", { body: "Read the rules" })).message;
      await rejects(service.setPinned(alice, "general-chat", { messageId: m.id }), 403);
      await service.setPinned(moderator, "general-chat", { messageId: m.id });
      expect((await service.listMessages(alice, "general-chat", { limit: 50 })).pinned?.body).toBe("Read the rules");
      const other = (await service.sendMessage(alice, "results", { body: "elsewhere" })).message;
      await rejects(service.setPinned(admin, "general-chat", { messageId: other.id }), 422);
      await service.deleteMessage(admin, m.id);
      expect((await service.listMessages(alice, "general-chat", { limit: 50 })).pinned).toBeNull();
    });

    it("counts unread messages until the member reads them", async () => {
      await service.sendMessage(alice, "general-chat", { body: "one" });
      const two = (await service.sendMessage(alice, "general-chat", { body: "two" })).message;
      await service.sendMessage(bob, "general-chat", { body: "bob's own" });
      let general = (await service.listGroups(bob)).groups[0]!;
      expect(general).toMatchObject({ unreadCount: 2, lastReadId: "0", lastMessage: { body: "bob's own" } });
      await service.markRead(bob, "general-chat", two.id);
      general = (await service.listGroups(bob)).groups[0]!;
      expect(general).toMatchObject({ unreadCount: 0, lastReadId: two.id });
      await rejects(service.markRead(bob, "results", two.id), 422);
    });
  });
});
