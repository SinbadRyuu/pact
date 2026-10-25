import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { MemoryChatStore } from "../src/memoryStore";
import { PgChatStore } from "../src/pgStore";
import { describeStoreContract } from "./storeContract";

describeStoreContract("memory", async () => new MemoryChatStore());

// Set TEST_DATABASE_URL to an empty, throwaway database to run the Postgres suite. Each test drops and recreates the chat tables.
const url = process.env.TEST_DATABASE_URL;
const migration = readFileSync(new URL("../migrations/0001_community_chat.sql", import.meta.url), "utf8");

if (url) {
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  afterAll(() => pool.end());

  const reset = async () => {
    await pool.query("DROP TABLE IF EXISTS community_chat_read_state, community_chat_messages, community_chat_groups CASCADE");
    await pool.query(migration);
  };

  describeStoreContract("postgres", async () => {
    await reset();
    return new PgChatStore(pool);
  });

  describe("postgres migration", () => {
    it("can run twice without errors", async () => {
      await reset();
      await pool.query(migration);
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM community_chat_groups");
      expect(rows[0].n).toBe(3);
    });

    it("commits concurrent sends with unique, gap-free revisions", async () => {
      await reset();
      const store = new PgChatStore(pool);
      const groupId = (await store.getGroupBySlug("general-chat"))!.id;
      const sends = Array.from({ length: 40 }, (_, i) =>
        store.insertMessage({ groupId, authorId: `u${i % 5}`, body: `m${i}`, replyToId: null, clientId: null }),
      );
      const revs = (await Promise.all(sends)).map((r) => r!.row.rev).sort((a, b) => a - b);
      expect(revs).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    });

    it("rejects a message body over the limit at the database too", async () => {
      await reset();
      const store = new PgChatStore(pool);
      const groupId = (await store.getGroupBySlug("general-chat"))!.id;
      await expect(store.insertMessage({ groupId, authorId: "u1", body: "x".repeat(2001), replyToId: null, clientId: null })).rejects.toThrow();
    });
  });
} else {
  describe.skip("postgres store contract (set TEST_DATABASE_URL to run)", () => {
    it("skipped", () => {});
  });
}
