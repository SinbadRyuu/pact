// Bridge to the Live calls module (the weekly lineup). It already lives in the app if the /investment/calls page was
// installed from `investment-live-calls/` (the README suggested `src/investment/live-calls/`). If you copied it
// somewhere else, change the three paths below. Nothing else in this folder needs editing.
export { LiveCallsPage } from "../../investment-live-calls/src/LiveCallsPage";
export { configureLiveCalls } from "../../investment-live-calls/src/adapters";
export { Icon } from "../../investment-live-calls/src/icons";
