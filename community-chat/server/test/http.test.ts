import { beforeEach, describe, expect, it } from "vitest";
import { createChatHttpHandler, toFetchHandler, type ChatRequestHandler } from "../src/http";
import { MemoryChatStore } from "../src/memoryStore";
import { CommunityChatService, type ChatViewer } from "../src/service";

const admin: ChatViewer = { id: "admin-1", roles: ["admin"], permissions: ["community.post"] };
const member: ChatViewer = { id: "m1", roles: ["member"], permissions: ["community.post"] };

describe("chat HTTP handler", () => {
  let handle: ChatRequestHandler;
  beforeEach(() => {
    const service = new CommunityChatService({ store: new MemoryChatStore(), directory: { lookup: async () => new Map() } });
    handle = createChatHttpHandler(service);
  });

  const call = (method: string, path: string, viewer: ChatViewer | null = member, body?: unknown, query: Record<string, string> = {}) =>
    handle({ method, path, query, body, viewer });

  it("requires a signed-in member", async () => {
    expect(await call("GET", "/groups", null)).toMatchObject({ status: 401, body: { error: { code: "unauthenticated" } } });
  });

  it("serves the group list", async () => {
    const res = await call("GET", "/groups/");
    expect(res.status).toBe(200);
    expect((res.body as { groups: unknown[] }).groups).toHaveLength(3);
  });

  it("returns 403 when a member tries to create a group and 201 for an admin", async () => {
    expect(await call("POST", "/groups", member, { name: "Side chat" })).toMatchObject({ status: 403, body: { error: { code: "admins_only" } } });
    expect(await call("POST", "/groups", admin, { name: "Side chat" })).toMatchObject({ status: 201, body: { slug: "side-chat" } });
  });

  it("has no way to address a member directly", async () => {
    for (const path of ["/members/alice/messages", "/dm/alice", "/conversations", "/direct/m2", "/users/m2/messages"]) {
      expect((await call("POST", path, member, { body: "psst" })).status).toBe(404);
    }
  });

  it("sends, polls, edits and deletes", async () => {
    const sent = await call("POST", "/groups/general-chat/messages", member, { body: "hello", clientId: "client-id-0001" });
    expect(sent.status).toBe(201);
    const id = (sent.body as { id: string }).id;
    const retried = await call("POST", "/groups/general-chat/messages", member, { body: "hello", clientId: "client-id-0001" });
    expect(retried).toMatchObject({ status: 200, body: { id } });

    expect(await call("PATCH", `/messages/${id}`, member, { body: "hello!" })).toMatchObject({ status: 200, body: { body: "hello!" } });
    expect(await call("GET", "/groups/general-chat/messages", member, undefined, { since: "1" })).toMatchObject({
      status: 200,
      body: { cursor: 2, messages: [{ id, body: "hello!" }] },
    });
    expect((await call("DELETE", `/messages/${id}`, member)).status).toBe(204);
    expect((await call("PUT", "/groups/general-chat/read", member, { messageId: id })).status).toBe(204);
  });

  it("validates query parameters", async () => {
    expect((await call("GET", "/groups/general-chat/messages", member, undefined, { before: "abc" })).status).toBe(422);
    expect((await call("GET", "/groups/general-chat/messages", member, undefined, { since: "-1" })).status).toBe(422);
    expect((await call("GET", "/groups/general-chat/messages", member, undefined, { since: "1", before: "1" })).status).toBe(400);
    expect((await call("GET", "/groups/general-chat/messages", member, undefined, { limit: "0" })).status).toBe(422);
  });

  it("answers 405 with Allow for a wrong method and 404 for unknown paths", async () => {
    expect(await call("DELETE", "/groups")).toMatchObject({ status: 405, headers: { allow: "GET, POST" } });
    expect((await call("GET", "/nope")).status).toBe(404);
  });

  it("sets Retry-After when rate limited", async () => {
    let last;
    for (let i = 0; i < 8; i++) last = await call("POST", "/groups/general-chat/messages", member, { body: `m${i}` });
    expect(last).toMatchObject({ status: 429, headers: { "retry-after": "10" } });
  });

  it("works through the fetch adapter", async () => {
    const fetchHandler = toFetchHandler(handle, { mountPath: "/api/v1/community/chat", getViewer: () => member });
    const res = await fetchHandler(
      new Request("https://example.test/api/v1/community/chat/groups/results/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Up 2R today" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ body: "Up 2R today" });
    const empty = await fetchHandler(new Request("https://example.test/api/v1/community/chat/groups/results/read", { method: "PUT", body: "{" }));
    expect(empty.status).toBe(422);
  });
});
