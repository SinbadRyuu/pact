-- Community chat: Telegram-style group chats.
--
-- Rules the schema supports (the service enforces them):
--   * Only admins create, edit, reorder and archive groups.
--   * Every message belongs to a group. There is no table for one-to-one conversations, so members cannot message each other privately.
--   * A group's posting_policy is 'everyone' (all members can post) or 'admins' (an announcement-style group).
--
-- Live updates use a per-group revision counter. Every insert, edit and delete takes the next value of
-- community_chat_groups.last_rev under that group's row lock, so revisions commit in order and a client
-- that polls "everything after revision N" never misses a change.
--
-- author_id, created_by, deleted_by and user_id are text so they work whatever type the users table uses.
-- Add foreign keys to your users table if you want them.

CREATE TABLE IF NOT EXISTS community_chat_groups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE
                    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 40),
  name              text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 60),
  description       text NOT NULL DEFAULT '' CHECK (char_length(description) <= 280),
  emoji             text NOT NULL DEFAULT '' CHECK (char_length(emoji) <= 16),
  color             text NOT NULL DEFAULT 'cyan'
                    CHECK (color IN ('cyan', 'violet', 'magenta', 'mint', 'gold', 'rose', 'blue', 'orange')),
  posting_policy    text NOT NULL DEFAULT 'everyone' CHECK (posting_policy IN ('everyone', 'admins')),
  sort_order        integer NOT NULL DEFAULT 0,
  pinned_message_id bigint,
  last_rev          bigint NOT NULL DEFAULT 0,
  created_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  archived_at       timestamptz
);

CREATE TABLE IF NOT EXISTS community_chat_messages (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id    uuid NOT NULL REFERENCES community_chat_groups (id) ON DELETE CASCADE,
  author_id   text NOT NULL,
  body        text NOT NULL CHECK (char_length(body) <= 2000),
  reply_to_id bigint REFERENCES community_chat_messages (id) ON DELETE SET NULL,
  client_id   text CHECK (char_length(client_id) <= 64),
  rev         bigint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz,
  deleted_at  timestamptz,
  deleted_by  text
);

-- Latest page and "older than" pages.
CREATE INDEX IF NOT EXISTS community_chat_messages_group_id_idx ON community_chat_messages (group_id, id DESC);
-- "Changed since revision N" polls.
CREATE INDEX IF NOT EXISTS community_chat_messages_group_rev_idx ON community_chat_messages (group_id, rev);
-- Per-member rate limit.
CREATE INDEX IF NOT EXISTS community_chat_messages_author_idx ON community_chat_messages (author_id, created_at DESC);
-- A retried send with the same client id returns the first message instead of posting twice.
CREATE UNIQUE INDEX IF NOT EXISTS community_chat_messages_client_id_idx
  ON community_chat_messages (author_id, client_id) WHERE client_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_chat_groups_pinned_message_fk') THEN
    ALTER TABLE community_chat_groups
      ADD CONSTRAINT community_chat_groups_pinned_message_fk
      FOREIGN KEY (pinned_message_id) REFERENCES community_chat_messages (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_chat_read_state (
  user_id              text NOT NULL,
  group_id             uuid NOT NULL REFERENCES community_chat_groups (id) ON DELETE CASCADE,
  last_read_message_id bigint NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

-- Starting groups. Keep in sync with shared/defaultGroups.ts.
INSERT INTO community_chat_groups (slug, name, description, emoji, color, posting_policy, sort_order)
VALUES
  ('general-chat', 'VT Impact General Chat',
   'Say hello, ask questions and talk markets with the whole community.', '💬', 'cyan', 'everyone', 10),
  ('results', 'VT Impact Results',
   'Share your wins, losses and what you learned from them.', '🏆', 'gold', 'everyone', 20),
  ('beginners-signals', 'VT Impact Beginners Signal Group',
   'Signals explained step by step for members who are starting out.', '📈', 'mint', 'everyone', 30)
ON CONFLICT (slug) DO NOTHING;
