import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { ChatGroup, ChatViewerInfo } from "../../shared/types";
import { GroupAvatar } from "./Avatar";
import { Icon } from "./Icon";
import { listTime } from "./format";

export function GroupList({
  groups,
  viewer,
  activeSlug,
  basePath,
  onCreate,
}: {
  groups: readonly ChatGroup[];
  viewer: ChatViewerInfo | null;
  activeSlug: string | null;
  basePath: string;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? groups.filter((g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)) : groups;
  }, [groups, query]);

  return (
    <nav className="cc-sidebar" aria-label="Community groups">
      <div className="cc-sidebar__head">
        <h1 className="cc-sidebar__title">Community</h1>
        {viewer?.canManageGroups ? (
          <button type="button" className="cc-button cc-button--small cc-button--primary" onClick={onCreate}>
            <Icon name="plus" size={16} /> New group
          </button>
        ) : null}
      </div>
      <label className="cc-search">
        <Icon name="search" size={16} className="cc-search__icon" />
        <span className="cc-visually-hidden">Search groups</span>
        <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} autoComplete="off" />
      </label>

      {visible.length === 0 ? (
        <p className="cc-sidebar__empty">{query ? "No groups match." : "No groups yet."}</p>
      ) : (
        <ul className="cc-group-list" role="list">
          {visible.map((g) => (
            <li key={g.id}>
              <GroupRow group={g} active={g.slug === activeSlug} href={`${basePath}/${g.slug}`} />
            </li>
          ))}
        </ul>
      )}

      <p className="cc-sidebar__foot">
        Group chats only. Members cannot message each other privately. Messages are members’ own views, not financial advice.
      </p>
    </nav>
  );
}

function GroupRow({ group, active, href }: { group: ChatGroup; active: boolean; href: string }) {
  const last = group.lastMessage;
  const sender = last ? (last.mine ? "You" : last.author.displayName.split(" ")[0]) : null;
  const unread = group.unreadCount;
  return (
    <Link to={href} className={`cc-group${active ? " cc-group--active" : ""}${group.archived ? " cc-group--archived" : ""}`} aria-current={active ? "page" : undefined}>
      <GroupAvatar group={group} />
      <span className="cc-group__main">
        <span className="cc-group__top">
          <span className="cc-group__name">
            {group.postingPolicy === "admins" ? <Icon name="lock" size={13} className="cc-group__lock" label="Only admins can post" /> : null}
            {group.name}
          </span>
          {last ? <time className="cc-group__time" dateTime={last.createdAt}>{listTime(last.createdAt)}</time> : null}
        </span>
        <span className="cc-group__bottom">
          <span className="cc-group__preview">
            {group.archived ? (
              <span className="cc-tag">Archived</span>
            ) : last ? (
              <>
                <span className="cc-group__sender">{sender}: </span>
                {last.body}
              </>
            ) : (
              <span className="cc-muted">{group.description || "No messages yet"}</span>
            )}
          </span>
          {unread > 0 ? (
            <span className="cc-badge" aria-label={`${unread} unread`}>
              {unread >= 99 ? "99+" : unread}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
