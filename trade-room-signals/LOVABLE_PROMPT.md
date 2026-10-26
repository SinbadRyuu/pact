# Paste this into Lovable (vt-impact-gateway)

Copy everything below the line into the Lovable chat in one message.

---

Rebuild the Post signal form and the signal cards on Trade Room > Signals. Keep the VT Impact colours (dark navy surfaces, cyan to magenta gradient for the main button, cyan for links and the bolt icon, gold border and gold icon on gold cards). Change nothing else on the page.

**1. Database (Supabase migration)**
Add to the signals table: `entry_from numeric`, `entry_to numeric` (null for a single entry), `take_profits numeric[] default '{}'` (up to 6), `notes text`, `chart_url text`, `auto_manage boolean default true`, `targets_hit int default 0`. Create a public storage bucket `signal-charts`. Keep existing rows working by copying their old entry/TP1/TP2/TP3 values into the new columns.

**2. New Signal form**
Replace the current "New signal" modal content with this exact layout. Panel with 12px radius, 1px navy border, 20px padding. Labels are 10.5px uppercase, letter-spaced, muted grey. Inputs are 40px tall, near-black background, 1px border, 7px radius. Number inputs keep the up/down spinners.

- Header row: bolt icon + "New Signal" on the left. "Channel Chat" link with a chat bubble icon on the right (cyan). Close X when shown as a modal.
- A 4-column grid (2 columns on phones):
  - Row 1, full width: **SEND TO CHANNEL** select with a small channel icon on the left, channel names in capitals (e.g. VT CAPITAL).
  - Row 2: **DIRECTION** select (BUY / SELL) | **PAIR / CURRENCY** select (XAUUSD, XAGUSD, EURUSD, GBPUSD, USDJPY, GBPJPY, US30, NAS100, BTCUSD) | **ENTRY (SINGLE OR ZONE) \*** text input spanning 2 columns, placeholder "4115.5 or 4115.5 - 4112", with a small square "-" button on its right that adds " - " to make it a zone (or removes the second price if it already is one).
  - Row 3: **TP1 \*** | **TP2** (opt) | **TP3** (opt) | **TP4** (opt). "(opt)" in lower case and fainter. Placeholders TP1, TP2 and so on.
  - Row 4: **TP5** (opt) | **TP6** (opt) | **STOP LOSS \*** | empty.
  - Row 5, full width: **NOTES** text input, placeholder "Notes (optional)".
- "Attach Chart Analysis" button: small, cyan text on a faint cyan tint, chart icon. Picks a PNG/JPG/WebP, then shows a thumbnail, the file name and an X to remove. Uploads to `signal-charts` on post.
- Row with a large **Post Signal** button (48px tall, gradient, white text) and beside it in small faint text: "Posting broadcasts immediately, app push to every member."
- Checkbox (ticked by default) with a small robot icon: "Auto-manage this signal from live market prices: marks TP hits and closes on your stop". Under it in smaller faint text: "Using the default plan (TP hits + your stop only). Want SL → breakeven or trailing? Create a strategy in the Back office dashboard." with "Back office dashboard" linking to the Back Office page.
- Rules: entry accepts `4115.5`, `4115.5 - 4112`, `4115.5-4112` or `4,115.5 – 4,112`. Entry, TP1 and stop loss are required, with red messages under the field. Empty optional TPs are skipped and the rest keep their order. If the stop loss or any TP is on the wrong side of entry for the direction, show an amber note but still allow posting. After a successful post: toast "Signal posted to <channel>", clear the prices, keep channel, direction and pair, refresh the list.

**3. Signal card**
Keep the current card look (gold border, gold-bar icon in a circle, pair + full name, BUY/SELL pill with arrow, clock + time ago, "EXAMPLE TEMPLATE" style label in the top border when set). Change:
- ENTRY RANGE | STOP LOSS row stays. Show "ENTRY" instead of "ENTRY RANGE" for a single price. Zones show low – high with thousands separators.
- Show **every TP the signal has, up to six**, three per row (two per row on phones), with thin dividers. A TP that has been hit shows a green tick icon; one not yet hit shows a grey target icon.
- If the signal has notes, show them under the TPs with a note icon. If it has a chart, show it as a rounded image that opens full size.
- Bottom progress bar: tick icon, label and one dot per TP (gold when hit), chevron on the right. Labels: "Running", "Target N hit", "All targets hit", "Stopped out" (red), "Stopped after target N", "Closed at breakeven", "Closed manually". Green border when at least one target is hit, red when stopped.

The Status filter options stay the same: Any status, Active, Take profit, Stop loss, Breakeven, Manual close.
