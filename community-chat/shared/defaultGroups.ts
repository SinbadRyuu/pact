// The groups the community starts with. The SQL migration seeds the same three rows; admins add more from the app.

import type { GroupColor, PostingPolicy } from "./limits";

export interface DefaultGroup {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  color: GroupColor;
  postingPolicy: PostingPolicy;
  sortOrder: number;
}

export const DEFAULT_GROUPS: readonly DefaultGroup[] = [
  {
    slug: "general-chat",
    name: "VT Impact General Chat",
    description: "Say hello, ask questions and talk markets with the whole community.",
    emoji: "💬",
    color: "cyan",
    postingPolicy: "everyone",
    sortOrder: 10,
  },
  {
    slug: "results",
    name: "VT Impact Results",
    description: "Share your wins, losses and what you learned from them.",
    emoji: "🏆",
    color: "gold",
    postingPolicy: "everyone",
    sortOrder: 20,
  },
  {
    slug: "beginners-signals",
    name: "VT Impact Beginners Signal Group",
    description: "Signals explained step by step for members who are starting out.",
    emoji: "📈",
    color: "mint",
    postingPolicy: "everyone",
    sortOrder: 30,
  },
];
