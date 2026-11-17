// Client entry: pages for the router and the one-time setup call.
export { configureAutomation, type AutomationDeps } from "./adapters";
export { AutomationPage } from "./AutomationPage";
export { AutomationSections, type AutomationTab } from "./AutomationSections";
export { InstantImpactSection } from "./InstantImpactSection";
export { SniperBotSection } from "./SniperBotSection";
export { SubscribePage } from "./SubscribePage";
export { SuccessPage } from "./SuccessPage";
export { RiskWarning, RISK_WARNING } from "./RiskWarning";
export { AUTOMATION_SEO } from "./seo";

/**
 * Routes to add at the top level of the site's router. /automation itself already exists in the app (the strategy
 * builder): render <AutomationSections strategies={…} /> inside it rather than adding a second /automation route.
 * Use AutomationPage only if a site has no /automation page of its own.
 */
export const AUTOMATION_ROUTES = [
  { path: "automation/subscribe", lazy: () => import("./SubscribePage").then((m) => ({ Component: m.SubscribePage })) },
  { path: "automation/success", lazy: () => import("./SuccessPage").then((m) => ({ Component: m.SuccessPage })) },
];
