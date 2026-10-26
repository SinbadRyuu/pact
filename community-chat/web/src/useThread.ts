// Loads a group's messages and keeps them live by polling for changes since the last cursor.
// Polls every few seconds while the tab is visible, pauses when hidden and backs off after errors.

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessage, ChatReplyPreview, GroupListResponse } from "../../shared/types";
import { ChatApiError, chatApi, errorMessage } from "./api";
import { compareIds, initialThread, sortedMessages, threadReducer } from "./thread";

export const GROUPS_KEY = ["community-chat", "groups"] as const;

const POLL_MS = 3_000;
const MAX_BACKOFF_MS = 30_000;
const FATAL_STATUSES = new Set([401, 403, 404]);

export function newClientId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useThread(slug: string) {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(threadReducer, slug, initialThread);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pokeRef = useRef<() => void>(() => {});
  const [retryKey, bumpRetry] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    dispatch({ type: "reset", slug });
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cursor: number | null = null;
    let failures = 0;
    let running = false;
    let again = false;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    async function tick() {
      if (controller.signal.aborted) return;
      if (running) {
        again = true;
        return;
      }
      if (document.visibilityState === "hidden") return; // `onWake` resumes polling.
      running = true;
      try {
        if (cursor === null) {
          const page = await chatApi.messages(slug, {}, controller.signal);
          cursor = page.cursor;
          dispatch({ type: "loaded", slug, page });
        } else {
          // Keep reading while the server says more changes are waiting.
          for (;;) {
            const page = await chatApi.messages(slug, { since: cursor }, controller.signal);
            cursor = page.cursor ?? cursor;
            dispatch({ type: "merged", slug, page });
            if (!page.hasMore || controller.signal.aborted) break;
          }
        }
        failures = 0;
        schedule(again ? 0 : POLL_MS);
      } catch (error) {
        if (controller.signal.aborted) return;
        const fatal = error instanceof ChatApiError && FATAL_STATUSES.has(error.status);
        dispatch({ type: "pollFailed", slug, error: errorMessage(error), fatal });
        if (!fatal) {
          failures += 1;
          schedule(Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** failures));
        }
      } finally {
        running = false;
        again = false;
      }
    }

    const onWake = () => {
      if (document.visibilityState === "visible") schedule(0);
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    pokeRef.current = () => schedule(0);
    void tick();

    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
      pokeRef.current = () => {};
    };
  }, [slug, retryKey]);

  const refreshGroups = useCallback(() => void qc.invalidateQueries({ queryKey: GROUPS_KEY }), [qc]);

  const loadOlder = useCallback(async () => {
    const s = stateRef.current;
    if (s.status !== "ready" || !s.hasOlder || s.loadingOlder) return;
    const oldest = sortedMessages(s)[0];
    if (!oldest) return;
    dispatch({ type: "olderStarted", slug });
    try {
      const page = await chatApi.messages(slug, { before: oldest.id });
      dispatch({ type: "olderLoaded", slug, page });
    } catch {
      dispatch({ type: "olderFailed", slug });
    }
  }, [slug]);

  const deliver = useCallback(
    async (clientId: string, body: string, replyToId: string | null) => {
      try {
        const message = await chatApi.send(slug, { body, replyToId, clientId });
        dispatch({ type: "sent", slug, clientId, message });
        pokeRef.current();
        refreshGroups();
      } catch (error) {
        dispatch({ type: "sendFailed", slug, clientId, error: errorMessage(error) });
      }
    },
    [slug, refreshGroups],
  );

  const send = useCallback(
    (body: string, replyTo: ChatMessage | null) => {
      const clientId = newClientId();
      const preview: ChatReplyPreview | null = replyTo
        ? { id: replyTo.id, authorName: replyTo.author.displayName, excerpt: replyTo.body.slice(0, 140), deleted: false }
        : null;
      dispatch({
        type: "pending",
        slug,
        pending: { clientId, body, replyTo: preview, createdAt: new Date().toISOString(), status: "sending", error: null },
      });
      void deliver(clientId, body, replyTo?.id ?? null);
    },
    [slug, deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const p = stateRef.current.pending.find((x) => x.clientId === clientId);
      if (!p) return;
      dispatch({ type: "retrying", slug, clientId });
      void deliver(clientId, p.body, p.replyTo?.id ?? null);
    },
    [slug, deliver],
  );

  const discard = useCallback((clientId: string) => dispatch({ type: "discard", slug, clientId }), [slug]);

  const edit = useCallback(
    async (id: string, body: string) => {
      const message = await chatApi.edit(id, body);
      dispatch({ type: "upsert", slug, message });
      refreshGroups();
    },
    [slug, refreshGroups],
  );

  const remove = useCallback(
    async (id: string) => {
      await chatApi.remove(id);
      pokeRef.current();
      refreshGroups();
    },
    [refreshGroups],
  );

  const pin = useCallback(
    async (messageId: string | null) => {
      await chatApi.pin(slug, messageId);
      pokeRef.current();
    },
    [slug],
  );

  // Moves the read marker forward at most once a second, and clears the badge in the group list straight away.
  const readRef = useRef<{ slug: string; sent: string; queued: string | null; timer: ReturnType<typeof setTimeout> | null }>({
    slug,
    sent: "0",
    queued: null,
    timer: null,
  });
  const markRead = useCallback(
    (messageId: string) => {
      const r = readRef.current;
      if (r.slug !== slug) {
        if (r.timer) clearTimeout(r.timer);
        readRef.current = { slug, sent: "0", queued: null, timer: null };
      }
      const cur = readRef.current;
      if (compareIds(messageId, cur.queued ?? cur.sent) <= 0) return;
      cur.queued = messageId;
      qc.setQueryData<GroupListResponse>(GROUPS_KEY, (data) =>
        data && {
          ...data,
          groups: data.groups.map((g) =>
            g.slug === slug && compareIds(messageId, g.lastReadId) > 0 ? { ...g, unreadCount: 0, lastReadId: messageId } : g,
          ),
        },
      );
      if (cur.timer) return;
      cur.timer = setTimeout(() => {
        cur.timer = null;
        const id = cur.queued;
        if (!id || readRef.current !== cur) return;
        cur.queued = null;
        cur.sent = id;
        chatApi.markRead(slug, id).catch(() => {
          // A missed read marker only means the badge may come back; the next read moves it again.
          cur.sent = "0";
        });
      }, 1_000);
    },
    [slug, qc],
  );

  const messages = useMemo(() => sortedMessages(state), [state.messages]); // eslint-disable-line react-hooks/exhaustive-deps

  return { state, messages, loadOlder, send, retry, discard, edit, remove, pin, markRead, reload: bumpRetry };
}
