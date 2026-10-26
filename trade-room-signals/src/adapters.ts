// The only place the Trade Room signal pieces touch the rest of the app. Call `configureSignals` once at start-up,
// before the Trade Room renders. The README shows the exact lines for the Lovable (Supabase) app.
import type { Channel, NewSignal, Pair } from "./signal";

export interface SignalsDeps {
  /** Channels the signed-in person may post to, e.g. VT Capital. */
  loadChannels: () => Promise<Channel[]>;
  /** Pairs for the Pair / Currency picker. Leave out to use DEFAULT_PAIRS. */
  pairs?: Pair[];
  /** Saves the signal and sends the app push. Throw an Error with a readable message if it fails. */
  publish: (signal: NewSignal) => Promise<{ id: string }>;
  /** Uploads the chart screenshot and returns its public URL. Leave out to hide Attach Chart Analysis. */
  uploadChart?: (file: File) => Promise<string>;
  /** Opens the chat for a channel. Leave out to hide the Channel Chat link. */
  openChannelChat?: (channelId: string) => void;
  /** Where "Back office dashboard" links to. */
  backOfficeHref?: string;
  /** Shows a success toast. */
  notify?: (message: string) => void;
}

let deps: SignalsDeps | null = null;

export function configureSignals(next: SignalsDeps) {
  deps = next;
}

export function signalsDeps(): SignalsDeps {
  if (!deps) throw new Error("configureSignals() has not been called. See trade-room-signals/README.md.");
  return deps;
}
