// Client entry: pages for the router and the one-time setup call.
export { configureAutomation, type AutomationDeps } from "./adapters";
export { AutomationPage } from "./AutomationPage";
export { SubscribePage } from "./SubscribePage";
export { SuccessPage } from "./SuccessPage";
export { RiskWarning, RISK_WARNING } from "./RiskWarning";
export { AUTOMATION_SEO } from "./seo";

/** Routes to add at the top level of the site's router. */
export const AUTOMATION_ROUTES = [
  { path: "automation", lazy: () => import("./AutomationPage").then((m) => ({ Component: m.AutomationPage })) },
  { path: "automation/subscribe", lazy: () => import("./SubscribePage").then((m) => ({ Component: m.SubscribePage })) },
  { path: "automation/success", lazy: () => import("./SuccessPage").then((m) => ({ Component: m.SuccessPage })) },
];
