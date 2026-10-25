// /app/community and /app/community/:slug. A Telegram-style layout: the group list on the left and the open
// chat on the right; on phones the list and the chat are separate screens.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatGroup, GroupListResponse } from "../../shared/types";
import { chatApi, errorMessage, setSessionCsrfSource } from "./api";
import { ChatView } from "./ChatView";
import { GroupDialog } from "./GroupDialog";
import { GroupList } from "./GroupList";
import { Icon } from "./Icon";
import { GROUPS_KEY } from "./useThread";

const WIDE = "(min-width: 56rem)";
const GROUPS_POLL_MS = 15_000;

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

export interface CommunityChatPageProps {
  /** Where the chat is mounted. Group links are `${basePath}/${slug}`. */
  basePath?: string;
  /** Link to a member's profile from their name. */
  memberHref?: (handle: string) => string;
  /** Appended to the document title. */
  titleSuffix?: string;
}

export function CommunityChatPage({
  basePath = "/app/community",
  memberHref = (handle) => `/app/community/members/${encodeURIComponent(handle)}`,
  titleSuffix = " · VT Impact",
}: CommunityChatPageProps) {
  const { slug = null } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const wide = useMediaQuery(WIDE);
  const [dialog, setDialog] = useState<{ group: ChatGroup | null } | null>(null);

  // Reuse the app's session query for the CSRF token unless configureCommunityChat set one.
  useEffect(() => {
    setSessionCsrfSource(() => {
      const session = qc.getQueryData<{ state?: string; session?: { csrfToken?: string }; csrfToken?: string }>(["session"]);
      return session?.session?.csrfToken ?? session?.csrfToken ?? null;
    });
  }, [qc]);

  const query = useQuery({
    queryKey: GROUPS_KEY,
    queryFn: ({ signal }) => chatApi.groups(signal),
    refetchInterval: GROUPS_POLL_MS,
    staleTime: 5_000,
  });
  const groups = query.data?.groups ?? [];
  const viewer = query.data?.viewer ?? null;
  const active = slug ? (groups.find((g) => g.slug === slug) ?? null) : null;

  // On wide screens, open the first group instead of an empty chat pane.
  useEffect(() => {
    if (wide && !slug && groups[0]) navigate(`${basePath}/${groups[0].slug}`, { replace: true });
  }, [wide, slug, groups, basePath, navigate]);

  useEffect(() => {
    document.title = `${active ? `${active.name} · ` : ""}Community${titleSuffix}`;
  }, [active, titleSuffix]);

  function onSaved(group: ChatGroup | null, change: "created" | "updated" | "reordered") {
    void qc.invalidateQueries({ queryKey: GROUPS_KEY });
    if (change === "reordered") return;
    if (group && change === "created") {
      qc.setQueryData<GroupListResponse>(GROUPS_KEY, (data) => data && { ...data, groups: [...data.groups, group] });
      navigate(`${basePath}/${group.slug}`);
    } else if (group) {
      qc.setQueryData<GroupListResponse>(GROUPS_KEY, (data) => data && { ...data, groups: data.groups.map((g) => (g.id === group.id ? { ...g, ...group, lastMessage: g.lastMessage, unreadCount: g.unreadCount, lastReadId: g.lastReadId } : g)) });
    }
    setDialog(null);
  }

  const showList = wide || !slug;
  const showChat = wide || !!slug;

  let chatPane: ReactNode = null;
  if (showChat) {
    if (query.isPending) {
      chatPane = (
        <div className="cc-chat cc-chat--placeholder">
          <div className="cc-state" role="status">
            <span className="cc-spinner" aria-hidden="true" /> Loading…
          </div>
        </div>
      );
    } else if (query.isError && !query.data) {
      chatPane = (
        <div className="cc-chat cc-chat--placeholder">
          <div className="cc-state" role="alert">
            <Icon name="alert" size={28} />
            <p>{errorMessage(query.error)}</p>
            <button type="button" className="cc-button" onClick={() => void query.refetch()}>
              <Icon name="refresh" size={16} /> Try again
            </button>
          </div>
        </div>
      );
    } else if (active && viewer) {
      chatPane = (
        <ChatView
          key={active.slug}
          group={active}
          viewer={viewer}
          memberHref={memberHref}
          onBack={wide ? null : () => navigate(basePath)}
          onEditGroup={viewer.canManageGroups ? () => setDialog({ group: active }) : null}
        />
      );
    } else if (slug) {
      chatPane = (
        <div className="cc-chat cc-chat--placeholder">
          <div className="cc-state">
            <Icon name="users" size={28} />
            <p>This group isn’t available.</p>
            <p className="cc-muted cc-small">It may have been archived or renamed.</p>
            <button type="button" className="cc-button" onClick={() => navigate(basePath)}>
              Back to all groups
            </button>
          </div>
        </div>
      );
    } else {
      chatPane = (
        <div className="cc-chat cc-chat--placeholder">
          <div className="cc-state">
            <Icon name="users" size={28} />
            <p>{groups.length ? "Choose a group to start chatting." : "No groups yet."}</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className={`cc${!wide && slug ? " cc--chat-open" : ""}`}>
      {showList ? (
        <GroupList groups={groups} viewer={viewer} activeSlug={slug} basePath={basePath} onCreate={() => setDialog({ group: null })} />
      ) : null}
      {chatPane}
      {viewer?.canManageGroups ? (
        <GroupDialog
          open={dialog !== null}
          group={dialog?.group ?? null}
          groups={groups}
          basePath={basePath}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}
