import { useState, type CSSProperties } from "react";
import type { ChatAuthor, ChatGroup } from "../../shared/types";
import { groupPhotoUrl } from "./api";
import { GROUP_COLOR_VALUES, initials, memberColor } from "./format";

type Size = "sm" | "md" | "lg";

type GroupLook = Pick<ChatGroup, "name" | "emoji" | "color"> & Partial<Pick<ChatGroup, "slug" | "photoVersion">>;

/**
 * The group's picture when an admin uploaded one, otherwise its emoji (or initials) on its colour.
 * `src` overrides the picture, e.g. to preview an upload before it is saved; null forces the emoji.
 */
export function GroupAvatar({ group, size = "md", src }: { group: GroupLook; size?: Size; src?: string | null }) {
  const photo = src !== undefined ? src : group.slug && group.photoVersion ? groupPhotoUrl(group.slug, group.photoVersion) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const style = { "--cc-avatar-color": GROUP_COLOR_VALUES[group.color] } as CSSProperties;

  if (photo && failed !== photo) {
    return <img className={`cc-avatar cc-avatar--${size} cc-avatar--photo`} src={photo} alt="" decoding="async" onError={() => setFailed(photo)} />;
  }
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
