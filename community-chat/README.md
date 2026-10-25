# Community chat

Replaces the post board at [vtimpact.com/app/community](https://www.vtimpact.com/app/community) with Telegram-style group chats. It starts with three groups:

| Group | Link |
| --- | --- |
| 💬 VT Impact General Chat | `/app/community/general-chat` |
| 🏆 VT Impact Results | `/app/community/results` |
| 📈 VT Impact Beginners Signal Group | `/app/community/beginners-signals` |

Admins add more from the app, without code changes.

## Who can do what

| | Member | Moderator | Admin |
| --- | :-: | :-: | :-: |
| Read and send messages in groups | ✓ | ✓ | ✓ |
| Reply, edit own messages (48 hours), delete own messages | ✓ | ✓ | ✓ |
| Delete anyone's message, pin messages | | ✓ | ✓ |
| Create, rename, reorder and archive groups | | | ✓ |
| Post in an "Only admins" group | | | ✓ |
| Message another member privately | ✗ | ✗ | ✗ |

The server enforces every rule; hiding a button is never the only check. There are no private messages: every message must belong to a group, and the API has no route that addresses a member. Sending needs the same `community.post` permission the forum uses, so a suspended member can still read but cannot post.

## What it does

- **Telegram layout.** The group list is on the left, with the last message, time and unread badge. The open chat is on the right. On phones the list and the chat are separate screens, and an open chat fills the screen.
- **Messages.** Bubbles grouped by sender, with day labels that stay on screen while you scroll, an "Unread messages" line, replies with a quote you can tap to jump to, an "edited" label, links you can tap, and a pinned message bar.
- **Composer.** Enter sends and Shift+Enter starts a new line (on phones Enter starts a new line and the button sends). Up arrow edits your last message and Escape cancels. Drafts are kept per group.
- **Live updates.** New messages, edits, deletions and pins show up within about 3 seconds. Messages appear as soon as you send them; if one fails, you can retry or discard it. A message is never posted twice, even if a retry overlaps the first attempt.
- **Group settings (admins).** Name, link, description, emoji icon, colour, who can send messages ("Everyone" or "Only admins"), position in the list, and archive or restore.
- **Safety.** A rate limit of 6 messages per 10 seconds applies to members but not staff. Message length is capped at 2,000 characters on both the server and the database. Text is rendered as plain text, so there is no HTML injection. Only `http` and `https` links become clickable, and they open with `noopener nofollow ugc`.

## What's in this folder

| Path | What it is |
| --- | --- |
| `server/migrations/0001_community_chat.sql` | Tables, indexes and the three starting groups. Safe to run twice. |
| `server/src/service.ts` | Every rule (who can post, edit, delete, manage groups). |
| `server/src/http.ts` | The API routes, plus adapters for Express-style and fetch-style servers. |
| `server/src/pgStore.ts` | Postgres queries. Takes any `pg`-compatible client. |
| `web/src/` | The page (`CommunityPage`), its components and `community-chat.css`. |
| `shared/` | Types, limits and the default groups, used by both sides. |
| `demo/` | A local preview with a fake backend running in the browser. |

## Install in the vtimpact.com app

The app's source isn't in this repository, so these steps describe where each piece goes.

### 1. Database

Run `server/migrations/0001_community_chat.sql` against the app's Postgres, the same way other migrations are run. It only creates `community_chat_*` tables and doesn't touch the forum tables, so old posts stay in the database.

### 2. API

Copy `server/` and `shared/` into the API project and mount the handler at `/api/v1/community/chat`, **after** the existing session, CSRF and rate-limit middleware:

```ts
import { CommunityChatService, PgChatStore, createChatHttpHandler, toNodeMiddleware } from "./community-chat/server/src";

const chat = new CommunityChatService({
  store: new PgChatStore(pool), // the app's pg Pool
  directory: {
    // Names and avatars for message authors. Adjust to the users table.
    async lookup(ids) {
      const { rows } = await pool.query(
        `SELECT id::text, handle, display_name, avatar_url, roles FROM users WHERE id::text = ANY($1)`,
        [ids],
      );
      return new Map(rows.map((u) => [u.id, {
        handle: u.handle,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        role: u.roles.includes("admin") ? "admin" : u.roles.includes("moderator") ? "moderator" : null,
      }]));
    },
  },
});

const handle = createChatHttpHandler(chat);

// Express-style:
app.use("/api/v1/community/chat", express.json(), toNodeMiddleware(handle, {
  getViewer: (req) => req.session?.user
    ? { id: String(req.session.user.id), roles: req.session.user.roles, permissions: req.session.user.permissions }
    : null,
}));

// Fetch-style (Hono, Next route handlers, Bun): toFetchHandler(handle, { mountPath: "/api/v1/community/chat", getViewer })
```

`getViewer` must return the signed-in member's `id`, `roles` (containing `"admin"` or `"moderator"` for staff) and `permissions`: the same values the app sends to the browser in `/auth/session`. Errors use the app's `{ error: { code, message, fields } }` format.

### 3. Page

Copy `web/` and `shared/` into the web app. Then, in the router, point the `/app/community` routes at the chat:

```ts
// Before: community, community/new, community/posts/:id, community/posts/:id/edit, community/members/:handle
{ path: "community", lazy: () => import("./community-chat/web/src").then((m) => ({ Component: m.CommunityPage })) },
{ path: "community/:slug", lazy: () => import("./community-chat/web/src").then((m) => ({ Component: m.CommunityPage })) },
{ path: "community/members/:handle", /* keep the existing member profile route */ },
```

- Remove `community/new` and the `community/posts/...` routes, or keep them for a while so old links still open.
- In the quick actions list, change "New Post" (`/app/community/new`) to "Community chat" (`/app/community`).
- The CSRF token is read from the app's `["session"]` query automatically. To use the app's own API client instead, call `configureCommunityChat({ transport })` once at startup.
- The chat fills the page height. If it's too tall or too short inside the app shell, set `--cc-offset` on `.cc` (it defaults to the app bar height plus the page padding).
- The public `/community` page still describes the old post board. Update its copy to mention the group chats.

No new libraries are needed: it uses React, React Router and TanStack Query, which the app already has. No Content Security Policy changes are needed either: requests are same-origin, and there is no inline script and no WebSocket.

## Adding a group

**In the app (admins):** Community → **New group**. Pick a name, an icon, a colour, and whether everyone or only admins can send messages. The ⚙ button in a group's header edits, reorders or archives it.

**In SQL:**

```sql
INSERT INTO community_chat_groups (slug, name, description, emoji, color, posting_policy, sort_order)
VALUES ('crypto', 'VT Impact Crypto', 'Crypto talk.', '🪙', 'violet', 'everyone', 40);
```

Colours: `cyan`, `violet`, `magenta`, `mint`, `gold`, `rose`, `blue`, `orange`. Posting policy: `everyone` or `admins`.

## How live updates work

Each group keeps a revision counter. Every send, edit and delete takes the next number under the group's row lock, so the numbers are committed in order. The browser asks for "everything after revision N" every 3 seconds while the chat is open and visible, pauses when the tab is hidden, and backs off up to 30 seconds after errors. The group list refreshes every 15 seconds.

Polling works with several API instances on Railway and needs no extra services. One open chat makes about 24 requests a minute, well under the 300 a minute the API allows. If the community grows large enough that this matters, the same cursor can feed Server-Sent Events or WebSockets without changing the database.

## Develop

```bash
cd community-chat
npm install
npm test                 # service rules, HTTP routes and client state (in-memory store)
TEST_DATABASE_URL=postgres://localhost/chat_test npm test   # also runs the Postgres store against a throwaway database
npm run typecheck
npm run demo             # http://localhost:5175: the chat with sample members; "Act as" switches between admin, moderator and member
```

The demo adds a message from a sample member every 25 seconds so you can see live updates. Add `?quiet` to the URL to turn that off, or `?chatter=5000` to make it every 5 seconds.
