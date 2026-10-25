import type { CSSProperties } from "react";
import type { ChatAuthor, ChatGroup } from "../../shared/types";
import { GROUP_COLOR_VALUES, initials, memberColor } from "./format";

type Size = "sm" | "md" | "lg";

export function GroupAvatar({ group, size = "md" }: { group: Pick<ChatGroup, "name" | "emoji" | "color">; size?: Size }) {
  const style = { "--cc-avatar-color": GROUP_COLOR_VALUES[group.color] } as CSSProperties;
  return (
    <span className={`cc-avatar cc-avatar--${size} cc-avatar--group`} style={style} aria-hidden="true">
      {group.emoji ? <span className="cc-avatar__emoji">{group.emoji}</span> : initials(group.name)}
    </span>
  );
}

export function MemberAvatar({ author, size = "sm" }: { author: ChatAuthor; size?: Size }) {
  const style = { "--cc-avatar-color": GROUP_COLOR_VALUES[memberColor(author.id)] } as CSSProperties;
  if (author.avatarUrl) {
    return <img className={`cc-avatar cc-avatar--${size}`} src={author.avatarUrl} alt="" loading="lazy" decoding="async" />;
  }
  return (
    <span className={`cc-avatar cc-avatar--${size}`} style={style} aria-hidden="true">
      {initials(author.displayName)}
    </span>
  );
}
