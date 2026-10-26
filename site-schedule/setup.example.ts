// Paste into the main site's entry file (the one that builds the router with the landing page, /app and sign-in),
// before `createRoot(...).render(...)`. The names on the right are whatever those modules are called in the source:
// they are the same ones the investment entry already passes to configureLiveCalls.
//
// If the investment entry already calls configureLiveCalls, this is the same call; both entries need it because
// each is its own page load.

import { configureLiveCalls } from "./investment/live-calls/adapters";
import { configureScheduleShell } from "./schedule/adapters";

configureLiveCalls({
  get: (path, opts) => api.get(path, opts), //               the shared API client every page uses
  post: (path, body, opts) => api.post(path, body, opts),
  useCanManage: () => useCan("admin.investment.manage"), //  the hook the admin menu uses for this permission
  useNow, //                                                 the shared 1-second clock hook (optional)
  usePageTitle, //                                           the hook pages call with their title (optional)
  notify: (message) => toast.success(message), //            optional
});

configureScheduleShell({
  useSession, //        the session hook the landing page uses ({ isPending, data: { state } })
  Logo, //              the IMPACT logo component the landing page shows (takes `inverse`)
  riskLine: copy.risk, // the risk sentence in every footer (optional)
});
