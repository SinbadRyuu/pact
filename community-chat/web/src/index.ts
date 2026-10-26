import "./community-chat.css";

export { CommunityChatPage } from "./CommunityChatPage";
export type { CommunityChatPageProps } from "./CommunityChatPage";
export { configureCommunityChat, chatApi, ChatApiError } from "./api";
export type { ChatTransport } from "./api";
export type * from "../../shared/types";

// The app's router lazy-loads `CommunityPage` from the community chunk, so the chat can be dropped in under that name.
export { CommunityChatPage as CommunityPage } from "./CommunityChatPage";
