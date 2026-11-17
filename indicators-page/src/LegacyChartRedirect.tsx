// Client-side fallback for the old chart page URL. The real 301 lives on the host (see redirects/ and README);
// this only catches people who arrive inside the already-loaded app, e.g. from an old in-app link.
import { useEffect } from "react";

export function LegacyChartRedirect() {
  useEffect(() => {
    window.location.replace(`/indicators${window.location.search}`);
  }, []);
  return null;
}

export default LegacyChartRedirect;
