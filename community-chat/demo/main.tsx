import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, createMemoryRouter, Navigate, RouterProvider, useParams, Link } from "react-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { CommunityChatPage, configureCommunityChat } from "../web/src";
import { ACT_AS, actingAs, demoPhotoUrl, demoTransport, ready, setActingAs, startChatter } from "./mockServer";
import "./theme.css";

configureCommunityChat({ transport: demoTransport, groupPhotoUrl: demoPhotoUrl });

// Switching person remounts the whole app with an empty cache, as signing in as someone else would.
const VIEWER_EVENT = "demo-viewer-change";

function DemoBar() {
  const qc = useQueryClient();
  const who = actingAs().id;
  return (
    <header className="demo-bar">
      <span className="demo-bar__brand">VT Impact</span>
      <span className="demo-bar__tag">Community chat preview</span>
      <label className="demo-bar__as">
        Act as
        <select
          value={who}
          onChange={(e) => {
            setActingAs(e.currentTarget.value);
            qc.clear();
            window.dispatchEvent(new Event(VIEWER_EVENT));
          }}
        >
          {ACT_AS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName} ({p.role ?? "member"})
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="demo-shell">
      <DemoBar />
      <main className="demo-main">{children}</main>
    </div>
  );
}

function MemberStub() {
  const { handle } = useParams();
  return (
    <Shell>
      <p>
        In the app this is the member profile for @{handle}. <Link to="/app/community">Back to the community</Link>
      </p>
    </Shell>
  );
}

// The shareable preview runs inside a frame whose URL it can't control, so it keeps its route in memory.
const PREVIEW = import.meta.env.VITE_PREVIEW === "1";
const createRouter = PREVIEW ? (routes: Parameters<typeof createMemoryRouter>[0]) => createMemoryRouter(routes, { initialEntries: ["/app/community"] }) : createBrowserRouter;

const router = createRouter([
  { path: "/", element: <Navigate to="/app/community" replace /> },
  { path: "/app/community", element: <Shell><CommunityChatPage /></Shell> },
  { path: "/app/community/members/:handle", element: <MemberStub /> },
  { path: "/app/community/:slug", element: <Shell><CommunityChatPage /></Shell> },
]);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

function App() {
  const [viewer, setViewer] = useState(actingAs().id);
  useEffect(() => {
    const onChange = () => setViewer(actingAs().id);
    window.addEventListener(VIEWER_EVENT, onChange);
    return () => window.removeEventListener(VIEWER_EVENT, onChange);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider key={viewer} router={router} />
    </QueryClientProvider>
  );
}

void ready.then(() => {
  const params = new URLSearchParams(location.search);
  if (!params.has("quiet")) startChatter(Number(params.get("chatter")) || (PREVIEW ? 15_000 : undefined));
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
