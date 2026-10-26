// Behaviour every ChatStore must have. Run against MemoryChatStore and PgChatStore.

import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_GROUPS } from "../../shared/defaultGroups";
import type { ChatStore, NewGroup } from "../src/store";

const group = (slug: string, extra: Partial<NewGroup> = {}): NewGroup => ({
  slug,
  name: `Group ${slug}`,
  description: "",
  emoji: "",
  color: "violet",
  postingPolicy: "everyone",
  createdBy: "admin-1",
  ...extra,
});

export function describeStoreContract(name: string, makeStore: () => Promise<ChatStore>) {
  describe(`${name} store contract`, () => {
    let store: ChatStore;
    let generalId: string;

    beforeEach(async () => {
      store = await makeStore();
      generalId = (await store.getGroupBySlug("general-chat"))!.id;
    });

    const send = (authorId: string, body: string, extra: Partial<{ groupId: string; replyToId: string | null; clientId: string | null }> = {}) =>
      store.insertMessage({ groupId: generalId, authorId, body, replyToId: null, clientId: null, ...extra });

    it("starts with the three default groups in order", async () => {
      const groups = await store.listGroups({ includeArchived: false });
      expect(groups.map((g) => g.slug)).toEqual(DEFAULT_GROUPS.map((g) => g.slug));
      expect(groups.map((g) => g.name)).toEqual(DEFAULT_GROUPS.map((g) => g.name));
      expect(groups.every((g) => g.postingPolicy === "everyone" && g.archivedAt === null)).toBe(true);
    });

    it("creates groups at the end and refuses a taken slug", async () => {
      const created = await store.createGroup(group("crypto-talk"));
      expect(created?.slug).toBe("crypto-talk");
      expect(await store.createGroup(group("crypto-talk"))).toBeNull();
      const slugs = (await store.listGroups({ includeArchived: false })).map((g) => g.slug);
      expect(slugs.at(-1)).toBe("crypto-talk");
      expect(await store.countGroups()).toBe(4);
    });

    it("updates, archives and reorders groups", async () => {
      const results = (await store.getGroupBySlug("results"))!;
      const updated = await store.updateGroup(results.id, { name: "Member Results", postingPolicy: "admins", archivedAt: new Date() });
      expect(updated).toMatchObject({ name: "Member Results", postingPolicy: "admins" });
      expect((await store.listGroups({ includeArchived: false })).map((g) => g.slug)).not.toContain("results");
      expect((await store.listGroups({ includeArchived: true })).map((g) => g.slug)).toContain("results");
      expect(await store.countGroups()).toBe(2);

      const all = await store.listGroups({ includeArchived: true });
      await store.reorderGroups([...all].reverse().map((g) => g.id));
      expect((await store.listGroups({ includeArchived: true })).map((g) => g.slug)).toEqual(["beginners-signals", "results", "general-chat"]);
    });

    it("gives each change in a group the next revision", async () => {
      const a = (await send("u1", "first"))!.row;
      const b = (await send("u2", "second"))!.row;
      expect([a.rev, b.rev]).toEqual([1, 2]);
      const edited = (await store.updateMessage(a.id, { kind: "edit", body: "first, edited" }))!;
      expect(edited.rev).toBe(3);
      expect(edited.editedAt).not.toBeNull();
      const deleted = (await store.updateMessage(b.id, { kind: "delete", deletedBy: "mod-1" }))!;
      expect(deleted).toMatchObject({ rev: 4, body: "", deletedBy: "mod-1" });
      expect((await store.getGroupById(generalId))!.lastRev).toBe(4);

      const since = await store.messagesSince(generalId, 2, 100);
      expect(since.map((m) => [m.id, m.rev])).toEqual([
        [a.id, 3],
        [b.id, 4],
      ]);
    });

    it("keeps revisions separate per group", async () => {
      const resultsId = (await store.getGroupBySlug("results"))!.id;
      await send("u1", "general");
      const other = (await send("u1", "results", { groupId: resultsId }))!.row;
      expect(other.rev).toBe(1);
    });

    it("refuses to insert into an archived group", async () => {
      await store.updateGroup(generalId, { archivedAt: new Date() });
      expect(await send("u1", "hello")).toBeNull();
    });

    it("returns the first message for a repeated client id", async () => {
      const first = (await send("u1", "hello", { clientId: "client-abc-123" }))!;
      const again = (await send("u1", "hello", { clientId: "client-abc-123" }))!;
      expect(first.duplicate).toBe(false);
      expect(again).toMatchObject({ duplicate: true, row: { id: first.row.id } });
      const otherAuthor = (await send("u2", "hello", { clientId: "client-abc-123" }))!;
      expect(otherAuthor.duplicate).toBe(false);
    });

    it("pages newest first and before an id", async () => {
      const ids: string[] = [];
      for (let i = 1; i <= 5; i++) ids.push((await send("u1", `m${i}`))!.row.id);
      expect((await store.latestMessages(generalId, 2)).map((m) => m.body)).toEqual(["m5", "m4"]);
      expect((await store.messagesBefore(generalId, ids[3]!, 2)).map((m) => m.body)).toEqual(["m3", "m2"]);
      expect((await store.getMessages([ids[0]!, ids[4]!, "999999"])).map((m) => m.body).sort()).toEqual(["m1", "m5"]);
    });

    it("finds each group's newest message that is not deleted", async () => {
      await send("u1", "older");
      const newer = (await send("u1", "newer"))!.row;
      await store.updateMessage(newer.id, { kind: "delete", deletedBy: "u1" });
      const last = await store.lastMessages([generalId, (await store.getGroupBySlug("results"))!.id]);
      expect(last.size).toBe(1);
      expect(last.get(generalId)?.body).toBe("older");
    });

    it("counts unread messages from others, capped, and only moves the read marker forward", async () => {
      const longAgo = new Date(Date.now() - 365 * 86_400_000);
      const a = (await send("u2", "one"))!.row;
      await send("u1", "mine");
      const c = (await send("u2", "three"))!.row;
      const d = (await send("u2", "four"))!.row;
      await store.updateMessage(d.id, { kind: "delete", deletedBy: "u2" });

      let states = await store.readStates("u1", [generalId], { lookbackSince: longAgo, cap: 99 });
      expect(states.get(generalId)).toEqual({ lastReadId: "0", unread: 2 });
      expect((await store.readStates("u1", [generalId], { lookbackSince: longAgo, cap: 1 })).get(generalId)?.unread).toBe(1);
      // With no read marker, only recent messages count.
      const future = new Date(Date.now() + 86_400_000);
      expect((await store.readStates("u1", [generalId], { lookbackSince: future, cap: 99 })).get(generalId)?.unread).toBe(0);

      await store.markRead("u1", generalId, c.id);
      await store.markRead("u1", generalId, a.id);
      states = await store.readStates("u1", [generalId], { lookbackSince: future, cap: 99 });
      expect(states.get(generalId)).toEqual({ lastReadId: c.id, unread: 0 });
    });

    it("counts an author's recent messages", async () => {
      await send("u1", "a");
      await send("u1", "b");
      await send("u2", "c");
      expect(await store.countRecentMessages("u1", new Date(Date.now() - 60_000))).toBe(2);
      expect(await store.countRecentMessages("u1", new Date(Date.now() + 60_000))).toBe(0);
    });

    it("stores, replaces and removes a group picture with a matching version", async () => {
      expect((await store.getGroupById(generalId))!.photoVersion).toBeNull();
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
      const row = await store.setGroupPhoto(generalId, { contentType: "image/png", bytes, version: "v1" }, "admin-1");
      expect(row?.photoVersion).toBe("v1");
      expect(await store.getGroupPhoto(generalId)).toEqual({ contentType: "image/png", bytes, version: "v1" });
      await store.setGroupPhoto(generalId, { contentType: "image/webp", bytes: new Uint8Array([9]), version: "v2" }, "admin-1");
      expect((await store.getGroupPhoto(generalId))?.version).toBe("v2");
      expect((await store.listGroups({ includeArchived: false }))[0]!.photoVersion).toBe("v2");
      const removed = await store.setGroupPhoto(generalId, null, "admin-1");
      expect(removed?.photoVersion).toBeNull();
      expect(await store.getGroupPhoto(generalId)).toBeNull();
    });

    it("pins and unpins", async () => {
      const m = (await send("u1", "rules"))!.row;
      await store.setPinned(generalId, m.id);
      expect((await store.getGroupById(generalId))!.pinnedMessageId).toBe(m.id);
      await store.setPinned(generalId, null);
      expect((await store.getGroupById(generalId))!.pinnedMessageId).toBeNull();
    });
  });
}
