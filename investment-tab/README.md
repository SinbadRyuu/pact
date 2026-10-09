# PACT — Investment Tab

A complete, drop-in **Investment** section for the website. It's one file with no external libraries, so it can be pasted straight into any site.

## What's included

- **Disclaimer gate.** Visitors must tick "this is not financial advice" and click *I agree* before they can see anything. The browser remembers this, so they only do it once.
- **Get Started page** with:
  - an intro video
  - your track-record highlight, which always shows a past-performance warning
  - the 7 foundation modules: outgoings vs income, saving & habits, safer starter investments, diversifying, compounding, multiple incomes, and reinvesting for freedom
- **Calculators tab:**
  - a **compound interest calculator** with a **live graph** that redraws as the visitor types, plus an optional target amount that shows whether they're on track and how much a month they'd need to add
  - an **income vs outgoings calculator** showing money left over, savings rate, a 50/30/20 check and an emergency fund target. Its *"Invest my left-over each month"* button sends the visitor's left-over money into the compound calculator.
- **Topic tabs.** Each opens its own page with information, an optional video and an optional "My experience" box:
  Trading · Gold/Silver/Copper · Stocks (safer vs higher risk) · Crypto (safer vs higher risk) · Collectibles (Pokémon) · Property · Market Crashes
- **Taxes tab** with tax basics and an **accountant card**: services, an optional fee, a booking button and a referral disclosure.
- The section works on phones and desktops, uses the dark PACT purple theme, and is fully scoped, so it won't change the rest of the website.

## Files

| File | What it is |
|---|---|
| `pact-investment-tab.html` | **The file to copy into the website.** |
| `preview.html` | Open it in a browser to preview the section. Don't copy this one. |
| `build-preview.js` | Optional. Run `node build-preview.js` to refresh the preview after editing. |

## How to add it to the website (about 2 minutes)

1. Open `pact-investment-tab.html` and copy **everything** in it.
2. On the website, create the Investment page (or open the page where the section should go).
3. Add an **HTML / Embed / Custom Code** block and paste the code in. Platform specifics:
   - **WordPress:** use a "Custom HTML" block.
   - **Squarespace:** use a "Code" block, with "Display Source" turned off.
   - **Wix:** use "Embed Code", then "Embed HTML". Make the box tall (e.g. 2000px+), because Wix puts it in a frame.
   - **Webflow:** use an "Embed" element. Note that Webflow embeds have a 50,000-character limit. If the code doesn't fit, paste the `<style>` part into *Page settings → Custom code → Head* and the rest into the Embed.
   - **Shopify:** use a "Custom Liquid" section.
   - **Plain HTML site:** paste it anywhere inside `<body>`.
4. Publish.

Only paste it **once** per page.

## Changing videos, text, accountant, currency

Search the file for **`CONFIG`**. Everything you'd normally change is in that one block near the bottom.

```js
videos: {
  intro: "https://www.youtube.com/watch?v=XXXXXXXX",   // YouTube, Vimeo or .mp4 links
  trading: "",                                         // "" = no video shown
  ...
},
trackRecord: "My investments, taken together, have beaten the S&P 500 ...",   // "" hides it
experience: {
  trading: "Write your personal experience here.\nNew line like this.",      // "" hides the box
  ...
},
accountant: {
  name: "...", intro: "...", services: ["...", "..."],
  fee: "From £150 — optional",                  // "" hides it
  bookingUrl: "https://calendly.com/...",       // "" shows "Booking opens soon"
  disclosure: "We may receive a referral fee ..."
}
```

- **Video links:** paste the normal YouTube/Vimeo page link. It's converted to an embed automatically.
- **Empty fields are hidden,** so nothing half-finished shows on the live site.
- **Currency:** change `currency: "GBP"` to `"USD"`, `"EUR"` and so on, and `locale` to match.

## Business notes (not shown on the site)

- **Accountant revenue share.** The page only links to the accountant's booking/payment page. Any optional fee, and the agreed split (e.g. 20% to PACT, or 40/40 with the accountant), should be in a **written agreement with the accountant** and paid by them. The split isn't shown publicly. To track referrals, add a code to the booking link (e.g. `https://calendly.com/accountant?utm_source=pact`).
- **Referral disclosure.** The accountant card says PACT may receive a referral fee. Keep this line: telling customers about referral fees is good practice and is expected under UK consumer rules.
- **Performance claims.** The S&P 500 track-record line is a financial promotion. In the UK, the FCA regulates financial promotions. Keep evidence of the figures, and keep the past-performance warning (the page always shows it). If unsure, check with a compliance professional before going live.
- **Disclaimer.** The disclaimer gate is a good protection, but it doesn't replace proper terms of use. Consider linking the site's full Terms/Disclaimer page as well.
