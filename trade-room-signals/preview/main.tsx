// Preview harness: the real form and card on a Trade Room style page, with an in-memory server. Not shipped.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { configureSignals } from "../src/adapters";
import { NewSignalForm } from "../src/NewSignalForm";
import { SignalCard } from "../src/SignalCard";
import type { NewSignal, Signal } from "../src/signal";

const NOW = Date.parse("2026-10-26T14:06:00Z");
let store: Signal[] = [
  {
    id: "sig_1",
    channelId: "vt-capital",
    channelName: "VT Capital",
    direction: "BUY",
    pair: "XAUUSD",
    entryFrom: 4118,
    entryTo: 4121,
    takeProfits: [4128, 4135, 4150],
    stopLoss: 4114,
    notes: null,
    chartUrl: null,
    autoManage: true,
    createdAt: new Date(NOW - 2 * 3600_000).toISOString(),
    status: "active",
    targetsHit: 1,
  },
];
const listeners = new Set<() => void>();

configureSignals({
  loadChannels: async () => [
    { id: "vt-capital", name: "VT Capital" },
    { id: "vt-gold", name: "VT Gold" },
  ],
  publish: async (s: NewSignal) => {
    await new Promise((r) => setTimeout(r, 400));
    const id = `sig_${store.length + 1}`;
    store = [{ ...s, id, createdAt: new Date(NOW).toISOString(), status: "active", targetsHit: 0 }, ...store];
    listeners.forEach((fn) => fn());
    return { id };
  },
  uploadChart: async (file) => URL.createObjectURL(file),
  openChannelChat: () => toast("Channel chat would open here"),
  backOfficeHref: "#back-office",
  notify: toast,
});

function toast(msg: string) {
  const el = document.getElementById("toast")!;
  el.textContent = msg;
  el.dataset.on = "1";
  setTimeout(() => (el.dataset.on = "0"), 2200);
}

function App() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  return (
    <main className="pv">
      <NewSignalForm />
      <h2 className="pv-h">Gold signals</h2>
      <div className="pv-list">
        {store.map((s) => (
          <SignalCard key={s.id} signal={s} now={NOW} badge={s.id === "sig_1" ? "Example template" : undefined} onOpen={() => toast(`Open ${s.id}`)} />
        ))}
        <SignalCard
          now={NOW}
          signal={{
            id: "sig_demo6",
            channelId: "vt-capital",
            direction: "SELL",
            pair: "XAUUSD",
            entryFrom: 4115.5,
            entryTo: 4112,
            takeProfits: [4105, 4100, 4095, 4090, 4085, 4080],
            stopLoss: 4120,
            notes: "Rejection at London high, sweep of Asia range. Partials at TP2.",
            chartUrl: null,
            autoManage: true,
            createdAt: new Date(NOW - 40 * 60_000).toISOString(),
            status: "active",
            targetsHit: 2,
          }}
        />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
