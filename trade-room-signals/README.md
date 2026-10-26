# Trade Room: New Signal form and signal cards

The **Post signal** form and the **signal cards** for the Trade Room › Signals page on the VT Impact gateway, rebuilt to the new layout. Same structure, fields and behaviour as the reference signal generator, in VT Impact colours.

## The form

A 4-column grid, row by row:

| Row | Columns |
| --- | --- |
| 1 | **Send to channel** (full width, with the channel icon) |
| 2 | **Direction** · **Pair / Currency** · **Entry (single or zone) \*** (two columns wide) with a **–** button that turns a single price into a zone and back |
| 3 | **TP1 \*** · TP2 (opt) · TP3 (opt) · TP4 (opt) |
| 4 | TP5 (opt) · TP6 (opt) · **Stop loss \*** |
| 5 | **Notes** (full width, optional) |

Then **Attach Chart Analysis**, the **Post Signal** button with "Posting broadcasts immediately, app push to every member.", and the **Auto-manage** checkbox ("marks TP hits and closes on your stop", default plan, link to the Back office dashboard). **Channel Chat** sits top right.

- Entry takes `4115.5`, `4115.5 - 4112`, `4115.5-4112` or `4,115.5 – 4,112`.
- Entry, TP1 and stop loss are required. Empty optional TPs are skipped, the rest keep their order.
- If the stop or a TP is on the wrong side of entry for the direction, an amber note shows. It doesn't block posting.
- After posting, the prices clear and channel, direction and pair stay for the next one.
- On phones it drops to two columns with a full-width Post button.

## The card

Pair and name, BUY/SELL pill, time posted, **Entry range** and **Stop loss**, then **up to six TPs** three per row (green tick once hit), notes and the chart screenshot if there is one, and the progress line ("Target 2 hit", "All targets hit", "Stopped out", "Closed at breakeven", "Closed manually") with one dot per TP.

## Files

| File | What it is |
| --- | --- |
| `src/NewSignalForm.tsx` | The form |
| `src/SignalCard.tsx` | The card |
| `src/signal.ts` | Types, entry parsing, checks and formatting |
| `src/adapters.ts` | The one place it connects to the app (channels, publish, chart upload, chat, toast) |
| `src/icons.tsx` | Line icons |
| `src/signals.css` | Styles, all scoped under `sg-` so Tailwind and the rest of the app are untouched |
| `src/signal.test.ts` | Tests for parsing and checks |
| `preview/` | A working preview with a mock server |
| `LOVABLE_PROMPT.md` | Paste-ready prompt for the Lovable project |

## Install in the gateway app (React + Supabase)

1. **Copy `src/`** to `src/components/signals/`.

2. **Database.** The signals table needs room for six TPs, zones, notes and the chart. Run once in Supabase (rename the table if yours differs):

   ```sql
   alter table public.signals
     add column if not exists entry_from numeric,
     add column if not exists entry_to numeric,
     add column if not exists take_profits numeric[] not null default '{}',
     add column if not exists notes text,
     add column if not exists chart_url text,
     add column if not exists auto_manage boolean not null default true,
     add column if not exists targets_hit int not null default 0;
   ```

   And a public storage bucket called `signal-charts` for the screenshots.

3. **Connect it once** in `src/main.tsx` before rendering:

   ```ts
   import { configureSignals } from "@/components/signals/adapters";
   import { supabase } from "@/integrations/supabase/client";
   import { toast } from "sonner";

   configureSignals({
     loadChannels: async () => {
       const { data, error } = await supabase.from("channels").select("id, name, icon_url").order("name");
       if (error) throw error;
       return data.map((c) => ({ id: c.id, name: c.name, iconUrl: c.icon_url }));
     },
     publish: async (s) => {
       const { data, error } = await supabase
         .from("signals")
         .insert({
           channel_id: s.channelId, direction: s.direction, instrument: s.pair,
           entry_from: s.entryFrom, entry_to: s.entryTo, take_profits: s.takeProfits,
           stop_loss: s.stopLoss, notes: s.notes, chart_url: s.chartUrl, auto_manage: s.autoManage,
         })
         .select("id")
         .single();
       if (error) throw new Error(error.message);
       return data;
     },
     uploadChart: async (file) => {
       const path = `${crypto.randomUUID()}-${file.name}`;
       const { error } = await supabase.storage.from("signal-charts").upload(path, file);
       if (error) throw new Error(error.message);
       return supabase.storage.from("signal-charts").getPublicUrl(path).data.publicUrl;
     },
     openChannelChat: (id) => window.location.assign(`/trade-room/chat/${id}`),
     backOfficeHref: "/back-office",
     notify: (m) => toast.success(m),
   });
   ```

   Leave out `uploadChart` or `openChannelChat` to hide those buttons.

4. **Swap the components** on the Signals page: the "New signal" dialog body becomes `<NewSignalForm onPosted={refetch} onClose={close} />`, and each item in the Gold Signals list becomes `<SignalCard signal={s} onOpen={openDetail} />` (map the row's snake_case columns to the `Signal` type).

5. **Tests:** `npx tsx --test src/components/signals/signal.test.ts`

No new packages: React only.

## Preview

```bash
cd trade-room-signals
npm i -D esbuild react react-dom
npx esbuild preview/main.tsx --bundle --format=esm --jsx=automatic --outdir=preview/dist
npx serve preview
```
