# Plans and Billing: research, audit and design (2026-11-03)

Owner: "billing and plans page is too cluttered and just bad ui ux. the buy buttons should have some
colors like gold should be gold. also the purchase buttons should be in the plans page too. ... for
the pages do a proper ui/ux research and refactor on all ends." Also: "add a subscribe button to the
top of the app for those who havent", which sells Premium monthly.

This covers the website (`/pricing`, `/billing`) and the Flutter app (Plans, Billing, and the new
Premium page) on Android and iPhone. Same day: free albums are kept forever, and a pass that ends goes
back to Free with up to 300 MB kept forever (backend #30, frontend #34).

## 1. Research

Sources were read on 2026-11-03. Canva's pricing page (403) and Duolingo's and Zola's plan screens
couldn't be read as text, so those points rely on search snippets and secondary sources.

### How good products show plans

| Product | Shape | Highlight | Buy button | Comparison / FAQ |
|---|---|---|---|---|
| Spotify Premium ([spotify.com/premium](https://www.spotify.com/us/premium/)) | 4 equal cards: name, billed price, 3–5 bullets | none on the cards | one per card, named ("Get Premium Duo") | none on the page |
| Notion ([notion.com/pricing](https://www.notion.com/pricing)) | 4 cards, each "Everything in X, and:" | exactly one "Recommended" | one per card | full table and FAQ below the cards |
| Google One ([one.google.com/about/plans](https://one.google.com/about/plans)) | 4 cards named by storage | exactly one "Recommended" | one per card | none |
| Telegram Premium ([core.telegram.org/api/premium](https://core.telegram.org/api/premium)) | single-plan paywall, one row per benefit | n/a | one Subscribe | none; opened from Settings and from limits |
| Joy ([withjoy.com/pricing](https://withjoy.com/pricing/)), Zola ([zola.com](https://www.zola.com/wedding-planning/website)) | free core; paid extras described in a line | none | per extra | none |

- NN/g: compare at most 5 options (3–4 is best); on a phone, two side by side is the realistic
  limit ([nngroup.com/articles/comparison-tables](https://www.nngroup.com/articles/comparison-tables/)).
  On mobile, use accordions over wide tables and show price and key features first
  ([smart-interface-design-patterns.com](https://smart-interface-design-patterns.com/articles/pricing-plans/)).
- People drop a plan when they can't find a specific feature quickly
  ([baymard.com](https://baymard.com/ecommerce-design-examples/plan-matrix)), so the full comparison
  stays available, collapsed.

### Plans page vs billing page

- Apple HIG: show the plan and its renewal date "without having to search for it", next to the
  manage option. "Always make it easy for customers to cancel." "Encourage a new subscription only
  when someone isn't already a subscriber"
  ([HIG: In-app purchase](https://developer.apple.com/design/human-interface-guidelines/apple-in-app-purchase)).
- Notion ([invoices](https://www.notion.com/help/invoices)), Canva
  ([manage Pro](https://www.canva.com/help/manage-pro-subscription/)), Spotify
  ([cancel Premium](https://support.spotify.com/kr-en/article/cancel-premium/)) and iCloud+
  ([support.apple.com/HT207594](https://support.apple.com/en-za/HT207594)) keep billing to these: the
  current plan, the renewal or end date, invoices, and change or cancel. A plan bought through a store
  is handed back to that store ("cancel through that platform").
- Google Play's manage link is
  `https://play.google.com/store/account/subscriptions?sku=<id>&package=<pkg>`
  ([Play subscriptions](https://developer.android.com/google/play/billing/subscriptions)).

### Paywall rules

- **Apple 3.1.2:** say clearly what the subscription gives for the price
  ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). The sign-up
  screen shows:
  - the subscription's name, its length and what you get each period
  - the billed amount, localised, as the most prominent price
  - a way to restore purchases
  - links to the Terms (EULA) and Privacy policy

  Sources: the HIG above and [App Store subscriptions](https://developer.apple.com/app-store/subscriptions/).
- **3.1.3:** apps may not steer people to other ways to buy outside the US storefront, so the Maldives
  app never links to web checkout. Venue stays off iPhone.
- **Prices come from the store:** StoreKit `displayPrice`
  ([docs](https://developer.apple.com/documentation/storekit/product/displayprice)) and Play
  `formattedPrice` ([docs](https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.PricingPhase)),
  never typed in.
- **Google Play:** the price, how often it bills, renewal and how to cancel must be visible up front.
  One-off items (Gold, Platinum) are in-app products, not subscriptions
  ([Play policy](https://support.google.com/googleplay/android-developer/answer/9900533)).

### Colour and accessibility

- WCAG 1.4.3 asks for 4.5:1 for text
  ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)). Gold text on white fails
  (#D4AF37 is 2.1:1), and so does silver (#A8ADB4 is 2.3:1). Both pass as fills with near-black text
  (8–14:1). So tier buttons are metal fills with dark text and never white text on gold.
- WCAG 1.4.1: colour can't be the only cue
  ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)), so the tier name is in the
  button's words.

### Anti-patterns

- In 2024, 76% of 642 subscription sites and apps used at least one possible dark pattern, most often
  hiding or obstructing auto-renew settings
  ([FTC/ICPEN](https://www.ftc.gov/news-events/news/press-releases/2024/07/ftc-icpen-gpen-announce-results-review-use-dark-patterns-affecting-subscription-services-privacy)).
- The EU's planned Digital Fairness Act aims to make cancelling as easy as signing up
  ([CMS](https://cms.law/en/aut/legal-updates/inside-the-eu-s-planned-digital-fairness-act-digital-design-subscription-traps-and-influencer-marketing)).
- None of these: countdown timers, a preselected pricier option, or upsell cards on the billing page.

## 2. Audit of what we had

Screenshots (production, 2026-11-03, before): `screenshots/plans-ux/before-*.jpg`. Each comes at 390
and 1440 px, light and dark.

### Plans (`/pricing`): about 14,800 px tall at 390 px, roughly 17 phone screens

| Element | Verdict | Why |
|---|---|---|
| Long intro paragraph (4 sentences) | clutter | says what the cards say again; one line is enough |
| Free card with 7 bullets, same size as the paid cards | clutter | Free isn't bought; it belongs in a single line ("every event starts free") |
| Gold, Platinum cards with 6–7 bullets each | partly useful | the lists repeat each other; "everything in Gold, plus" halves them |
| "Start your event" on every pass card | **wrong** | not a purchase; the owner asked for buy buttons on the plans page |
| Both badges ("One event", "For weddings") | clutter | two highlights; research says one at most |
| Add-ons block (Keep your photos, emails) | clutter here | bought for an existing event; belongs with the event (Billing) |
| Payment paragraph with card logos | needed | BML requires logos, refunds and terms near payment; can be compact |
| "By the month": Premium and Venue cards, each with 6 bullets, "Questions? Talk to us" | partly useful | Premium is a real choice; Venue is for a handful of businesses and shouldn't weigh as much as Premium |
| "What each event gets" 4-column table, always open | useful but heavy | cramped at 390 px; collapse it |
| Sending invitations / When a pass ends sections | useful | short explainers; keep, collapsed into the FAQ |
| FAQ (12 questions, collapsed) | useful | keep |
| Buttons all one colour | **wrong** | owner: gold should be gold |

### Billing (`/billing`)

| Element | Verdict | Why |
|---|---|---|
| "Your plan" card that sells Premium and Venue with prices | clutter | billing should state the plan; selling is one link |
| Every event card: Gold, Platinum, Keep photos, 100 emails buttons | **the main clutter** | 9 events made 36 buy buttons; drafts and finished events alike |
| "Keep photos a year" on Free events | **wrong now** | free events are kept forever; the server refuses it |
| "Emailed 0 of 0 invitations" on every event | noise | means nothing on Free; show only when there is an allowance |
| Plan badge per event | useful | keep, in the tier's colour |
| Payments list with status | useful | keep, as "Receipts" |
| No renewal or end date beside a store subscription on the web | missing | a store-billed plan should say where it is managed |

## 3. The new design

**Rules:**
- At most three things to buy in one view.
- One highlight.
- A tier-coloured buy button on every plan, with the tier's name in its words.
- Each price once, as billed.
- Plans sells; Billing states.
- Mobile first.

### Library first

The UI library (Angular and Flutter, same API) gets the following, and the apps colour nothing
themselves:
- Premium tier tokens next to Gold and Platinum: `--ui-tier-premium*` and
  `--ui-gradient-tier-premium`.
- `UiButton` `tier` (gold, platinum, premium): a metal fill, dark text, AA in every theme, and a
  platinum sheen that stops when reduced motion is set.
- `UiPlanCard` and `UiPlanGrid`: plan name and tier edge, billed price, period, note, short checklist,
  one optional highlight, a "Your plan" state, and an action slot aligned across cards.
- `UiPlanCompare`: a semantic comparison table with ✓ / – and screen-reader words, tier-underlined
  headers, and a sticky first column when it scrolls on a phone.

### Plans (website `/pricing`)

1. **Heading and one line:** "Every event starts free: invitations, replies and 300 MB of photos kept
   forever. Add a pass when one event needs more."
2. **For one event:** Gold and Platinum cards in `UiPlanGrid`.
   - Platinum carries the single highlight, "Best for weddings".
   - Platinum's list starts "Everything in Gold, plus".
   - Buttons: **Get Gold · MVR 199** (gold) and **Get Platinum · MVR 499** (platinum).
   - Pressing one asks which event it is for: a small dialog listing the account's events that can
     take it, plus "A new event" (which starts one). It then goes straight to checkout. Signed out, it
     signs in first and comes back. No detour through "Start your event".
3. **For every event:** the Premium card.
   - Button: **Subscribe · MVR 200 a month** (premium).
   - Renewal terms in one line of fine print.
   - Signed in on Premium: the card says "Your plan" and links to Billing instead of selling.
4. **Free:** a one-line strip above the passes: "You're on Free" when signed in, else "Free: MVR 0".
5. **Compare plans:** collapsed, with `UiPlanCompare` (Free, Gold, Platinum, Premium).
6. **Venue** (owner, 2026-11-12): a full plan card beside Premium under "For every event", in Premium's
   metal (venue events get a plan like Premium's; there is no Venue metal). "MVR 775 a month, about $50"
   from the live catalog; 10 GB on every event at the venue, no mark, face grouping, kept while on Venue,
   name and logo on albums, QR cards, Me, Inbox and the feed. Fine print: when it ends its events go back
   to Free like an ended Premium pass, and the couple can keep their photos with a Platinum pass.
   "Get Venue", or "Your plan" (to Billing) when on Venue. Staff accounts are never listed as a benefit.
7. **Payment line** (BML: logos, refunds, terms) in one compact block.
8. **FAQ, collapsed:** sending, what happens when a pass ends, keep photos and extra emails, which
   now live here as answers rather than cards.

### Billing (website `/billing`)

1. **Your plan:**
   - Free, Premium or Venue in its tier colour, and what it gives in one line.
   - Renews on *date* or ends on *date*, and where it is billed (card on this website, the App Store,
     or Google Play).
   - One action: turn off automatic renewal, or a sentence saying it is managed in the App Store or
     Google Play.
   - Free accounts get the page's one selling link: "See plans".
2. **Your events:** one compact row per event.
   - Title, date and plan badge.
   - Status in words: "Kept forever", "Gold pass until 3 Dec 2027", or a warning "Back to Free on
     *date*: about 1.2 GB above 300 MB will be removed".
   - Actions only where they mean something:
     - "Extend a year · MVR 99/349" once a pass is within 60 days of ending or has ended.
     - "Keep photos a year" only on an event whose pass has ended.
     - "Add 100 emails" only when the event has emailed at least 80% of its allowance.
     - "Add a pass" (a link to Plans with that event chosen) on a free, finished event.
   - Drafts say "Not finished" and offer nothing (passes are chosen at the plan step).
   - An event whose venue's plan has ended (`venueEnded`) says so with the cut date, and offers only
     "Platinum pass".
3. **Events you’re in** (`forYou`, 2026-11-12), only when there are any: events someone else set up that
   the account is in (one of the people it is for, or the venue it is at), with the same rows, why it is
   listed after the date, and the same actions except emails (the organiser's).
4. **Receipts:** payments with date, amount and status.

### App (Android and iPhone)

- **Plans:** the same order and the same library pieces.
  - Prices are the store's strings (Play `formattedPrice`, StoreKit `displayPrice`), never typed in.
  - Gold and Platinum ask which event (bottom sheet), then go to the store purchase.
  - Premium opens the Premium page.
  - iPhone hides Venue and anything web-only.
- **Billing:** the same as the website.
  - Store subscriptions say "Manage in Google Play" (the `sku`+`package` deep link) or "Manage in the
    App Store".
  - A card subscription bought on the website is described but not cancellable from the app.
  - Restore purchases on iPhone.
- **Get Premium:**
  - A compact premium-tier button in the top bar of the main screens, for signed-in accounts without
    Premium. It is hidden for Premium and Venue accounts and while a purchase is pending.
  - It opens the **Premium page**:
    - what Premium gives, from the live plan data (space per event, no mark, everything kept while
      subscribed)
    - the store price and period, the most prominent price on the page
    - "Renews every month until cancelled; cancel in your App Store / Google Play subscriptions"
    - Terms of Use and Privacy policy links
    - Restore purchases
    - the subscribe button
  - After purchase: a short "You're on Premium" state, and the top-bar button goes.
- **Website Premium entry:** the website gets no top-bar button. Its top bar already holds the main
  navigation, and on the web the Plans page is one tap away from the menu. A signed-in account without
  Premium sees the Premium card in place on Plans, and Billing's one "See plans" link. This keeps the
  site calm; the app needs the top-bar entry because it has no pricing page in its navigation.

## 4. After

`screenshots/plans-ux/after-*.jpg`: Plans and Billing at 390 and 1440, light and dark, from the
release build with real account data, plus the pass picker (`after-pass-picker-390.jpg`) and the open
comparison (`after-compare-390.jpg`).

- Plans at 390 px: about 3,400 px tall instead of about 7,400 (CSS pixels). The page is never wider
  than the screen, including with the comparison open; the table scrolls inside itself.
- Billing for the review account (9 events): 36 buy buttons before, now no buy buttons. "Add a pass"
  links appear on finished free events, and one "See plans" link sits on the plan card.
- Tier buttons: Gold on gold, Platinum on platinum, Premium on violet. The library's AA check covers
  every pair (premium white text is 9.03:1 on the base and 5.42:1 on the light stop).

## 5. The event dashboard's plan card (owner, 2026-11-04)

"the card in the event dashboard that shows passes and stuff. that also needs that refactor."

**Before** (`before-dash-*.jpg`): a "Plan" heading with a pill, then two big grey tiles ("Buy Gold
pass", "Buy Platinum pass") in no tier colour. Nothing said what Free gives, how much space was used
or how long the photos are kept. "Your pass ends soon" was a separate section above it. The album
settings panel listed plan sizes as links to "Ask us".

**After** (`after-dash-*.jpg`): one "Your plan" section, built only from library pieces (ui-badge
tier, ui-progress-bar, ui-alert, ui-button tier). In order:
1. The plan name in its tier's colour, and one plain line:
   - Free: "up to 300 MB … kept forever".
   - A pass: "Gold pass until …: everything kept until then, then up to 300 MB forever".
   - Premium: "kept while you subscribe".
   - Ended: "back on Free".
2. The event's space as "X of Y used" with a meter. At 90% it says almost full (warning), at 100% full
   (danger). On Platinum it adds that this is the largest pass.
3. The one warning that matters now, as in the retention rule. When a cut is coming: its date and
   size, download or extend. When a pass ends within 30 days: the date and what happens after.
4. The venue price, said once, at a venue.
5. Only the actions that mean something now, each a tier-coloured button:
   - Free and Premium events: Get Gold and Get Platinum.
   - Gold: Move up to Platinum.
   - Ending or ended: Extend a year in the pass's colour.
   - Ended and not kept: Keep everything a year (plain).

The decisions live in `shared/plan-status/plan-status.ts`, with a spec covering every state. The album
settings panel now says the plan and space in a line and links to "Plan and passes" on the
dashboard; the album size bar says "kept forever", "everything kept until …" or "back to Free on …".
The app's event screen follows the same rules (app `features/hosting`).

