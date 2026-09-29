# Shamba OS — Web Portal Design

**Version:** Draft 1 · **Date:** 29 September 2026 · **Stage:** SDLC Stage 3, Design · **Sources:** `mvp.md`, `backend-architecture.md`, Shamba OS colour palette

The web portal is where owners and managers see how the farm is doing and manage the business side: money, stock, customers, suppliers and people. Daily field recording happens in the Flutter app; the portal is for reviewing, correcting, selling, buying and deciding.

build frontend on Vite + TypeScript with zustand and React Query 

Brand line: **Manage. Grow. Thrive.**

---

## 1. Who the portal is for

| Persona | Why they open the portal | What they need first |
| --- | --- | --- |
| Owner-operator | Weekly check on the farm; recording sales and purchases in bulk; exporting records | "What is making money?" on one screen |
| Absentee owner | Seeing what happens on a farm they don't visit daily | Trust: who recorded what, stock alerts, money owed |
| Manager | Running operations for assigned farms | Today's alerts, open batches and seasons, stock levels |
| Field worker | Rarely; if they log in, they see only recording and stock quantities | No prices, sales or profit anywhere (ACC-04) |
| Shamba OS staff | Catalogue and support | Separate internal admin, not this portal |

Design for a laptop in a farm office or town, and for a phone browser as the fallback. The portal is online-only; field data arrives from Flutter devices through sync.

---

## 2. Design direction

### The idea: the farm as a ledger you can read at a glance

Shamba OS answers one question better than a notebook: which part of the farm is making money. The portal's visual identity is built around that. Every enterprise (the dairy herd, the layers batch, this season's maize) is treated as a row in a ledger, with its costs and revenue side by side. The portal's single memorable element is the **enterprise strip** on the dashboard (section 7.1): a stacked list of enterprises, each with a cost-versus-revenue bar and its profit. Everything around it stays quiet, disciplined and calm.

### Principles

1. **Money is always the answer, never decoration.** Numbers are large only when they are the point of the screen. Profit, cost and revenue always use the same colours everywhere (section 3.3).
2. **Earthy, not corporate.** Greens and warm neutrals from the palette carry the brand. Accent colours are reserved for meaning: amber means revenue and harvest, terracotta means cost, sky means weather.
3. **Quiet surfaces, clear hierarchy.** Cream page, white working surfaces, Stone hairlines. Depth comes from borders and background steps, not shadows.
4. **Plain language in two languages.** Every screen works in Swahili and English, and layouts leave room for Swahili's longer words.
5. **History is visible.** Corrections show as reversals, never silent edits, so the owner can trust the numbers.
6. **The module switch is real.** A farm that keeps only poultry and maize never sees cattle screens, menus or empty charts about cows.

### What we deliberately avoid

- Identical rounded cards for everything. Cards are used for distinct objects (a batch, a customer); the dashboard's main content is a ledger list, not a card grid.
- Decorative gradients. Gradients from the palette appear in only two places (section 3.4).
- All-caps labels and labels above every heading. Section titles are sentence case, and a heading only appears when it helps someone find something.
- Arrows appended to button text, and meta strings joined with dots.

---

## 3. Colour

### 3.1 Palette tokens

All colours come from the Shamba OS palette. Define them once as CSS custom properties and never use raw hex in components.

**Primary**

| Token | Hex | Name | Use |
| --- | --- | --- | --- |
| `--green-900` | `#1F382C` | Deep Forest | Sidebar, headings, dark surfaces |
| `--green-800` | `#355442` | Forest Green | Primary buttons, links, focus ring, selected nav |
| `--green-600` | `#4F765B` | Leaf Green | Secondary actions, active states, positive numbers as text |
| `--green-400` | `#78A66A` | Fresh Green | Success fills, growth indicators, profit bars |
| `--green-100` | `#DCE8DE` | Soft Sage | Selected rows, subtle fills, active nav background on light surfaces |

**Neutral**

| Token | Hex | Name | Use |
| --- | --- | --- | --- |
| `--bg` | `#F8F7F2` | Cream | Page background |
| `--surface` | `#FFFFFF` | Warm White | Panels, tables, modals, inputs |
| `--surface-2` | `#EEEBDD` | Sand | Secondary backgrounds, table headers, grouped sections |
| `--border` | `#D8D6C8` | Stone | Borders, dividers, table lines |
| `--text-muted` | `#7B817A` | Muted Gray | Icons, placeholders, disabled text (see 3.2) |
| `--text` | `#202722` | Charcoal | Primary text |

**Semantic and accent**

| Token | Hex | Name | Meaning |
| --- | --- | --- | --- |
| `--amber` | `#D99A32` | Harvest Amber | Revenue, harvests, pending actions, attention |
| `--terracotta` | `#B96545` | Earth Terracotta | Costs, expenses, losses, critical alerts |
| `--sky` | `#5C91A6` | Sky Blue | Weather, water, rainfall |
| `--health` | `#4D9561` | Health Green | Animal health, treatments, completed tasks |
| `--lavender` | `#8A7CC7` | Lavender | Insights and information (AI in Phase 3) |

### 3.2 Accessible text variants

Several palette colours are too light to use as small text on white or cream. Approximate contrast ratios on white:

| Colour | Ratio on white | Safe as |
| --- | --- | --- |
| Forest Green `#355442` | about 8.4:1 | Any text; white text on it |
| Leaf Green `#4F765B` | about 5.1:1 | Any text; white text on it |
| Harvest Amber `#D99A32` | about 2.3:1 | Fills and bars only, never text |
| Earth Terracotta `#B96545` | about 4.2:1 | Large text (18 px+, or 14 px bold) and fills |
| Sky Blue `#5C91A6` | about 3.5:1 | Large text and fills |
| Health Green `#4D9561` | about 3.6:1 | Large text and fills |
| Lavender `#8A7CC7` | about 3.6:1 | Large text and fills |
| Fresh Green `#78A66A` | about 2.8:1 | Fills and bars only |
| Muted Gray `#7B817A` on Cream | about 3.8:1 | Icons, placeholders, large text |

Add an "ink" variant for each accent so text in that colour passes WCAG AA (4.5:1). Proposed values, to confirm with a contrast checker:

| Token | Hex | Pairs with |
| --- | --- | --- |
| `--amber-ink` | `#8A5A10` | Revenue figures, harvest labels |
| `--terracotta-ink` | `#9A4F33` | Cost figures, loss, error text |
| `--sky-ink` | `#3F6F82` | Weather text on light surfaces |
| `--health-ink` | `#3A7549` | Health status text |
| `--lavender-ink` | `#6456A8` | Information text |
| `--text-secondary` | `#5F655E` | Secondary body text (replaces Muted Gray for text) |

Rule: **fills use the palette colour; text uses the ink.** Chips use a 12% tint of the palette colour as background with the ink as text.

### 3.3 Money colours (fixed everywhere)

| Meaning | Bar or fill | Text |
| --- | --- | --- |
| Revenue | `--amber` | `--amber-ink` |
| Cost | `--terracotta` | `--terracotta-ink` |
| Profit (positive) | `--green-400` | `--green-600` |
| Loss (negative profit) | `--terracotta` | `--terracotta-ink`, with a minus sign |

This follows the palette's semantic definitions (amber for revenue, terracotta for costs). The "Expenses vs Revenue" usage example on the palette sheet shows revenue in green and profit in amber, which conflicts; this spec uses the semantic definitions consistently. Update the palette sheet to match.

Never rely on colour alone: profit and loss always show a sign and a word ("Profit", "Loss") alongside the colour.

### 3.4 Gradients

The palette's three gradients are used only here:

| Gradient | Used on |
| --- | --- |
| `#1F382C → #4F765B` | Sign-in and onboarding background panel |
| `#5C91A6 → #8FBED0` | Weather panel (small text sits over the darker end, or uses a Deep Forest scrim) |
| `#D99A32 → #F2C861` | Not used in the MVP portal; reserved for harvest celebration moments in the app |

---

## 4. Typography

**Typeface: Figtree** (open licence, Google Fonts), one family for the whole portal. It is friendly and round without being childish, reads well at small sizes, and has clear figures. Fallback stack: `Figtree, "Segoe UI", Roboto, system-ui, sans-serif`.

- All numbers in tables, stat figures and inputs use **tabular figures** (`font-variant-numeric: tabular-nums`) so columns of shillings line up.
- Weights: 400 regular, 500 medium, 700 bold. No other weights.

| Style | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Display | 32 / 40 | 700 | The one key figure on a screen (dashboard profit) |
| Title | 24 / 32 | 700 | Page titles |
| Heading | 18 / 26 | 700 | Section headings inside a page |
| Body | 15 / 24 | 400 | Default text |
| Body strong | 15 / 24 | 500 | Table row labels, emphasis |
| Small | 13 / 20 | 400 | Secondary text, captions, help text |
| Figure | 15 / 24 | 500, tabular | Money and quantities in tables |

All text is sentence case. Body line length stays under 80 characters.

---

## 5. Space, shape and depth

| Token | Value | Use |
| --- | --- | --- |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48, 64 px | All margins and padding |
| `--radius-control` | 8 px | Buttons, inputs, selects |
| `--radius-panel` | 12 px | Panels, cards, modals |
| `--radius-chip` | 999 px | Status chips only |
| Borders | 1 px Stone | Panels, tables, inputs |
| Elevation | None on the page; one shadow for modals and menus only | Depth comes from Cream → White → Sand steps |

Focus ring: 2 px Forest Green outline with 2 px offset, on every interactive element.

---

## 6. Layout and navigation

### 6.1 App shell

```
┌────────────────┬──────────────────────────────────────────────────────────┐
│  Shamba OS     │  [Kamau farm ▾]   [This month ▾]      [EN|SW]  [🔔 3]  [JK]│
│                ├──────────────────────────────────────────────────────────┤
│  Dashboard     │                                                          │
│  Farm          │  Page title                         [Primary action]     │
│  Animals       │                                                          │
│  Poultry & fish│  ┌────────────────────────────────────────────────────┐  │
│  Crops         │  │                                                    │  │
│  Stock         │  │                 Page content                       │  │
│  Sales         │  │           (full width, edges aligned with top bar)        │  │
│  Purchases     │  │                                                    │  │
│  Money         │  └────────────────────────────────────────────────────┘  │
│  Weather       │                                                          │
│                │                                                          │
│  Settings      │                                                          │
└────────────────┴──────────────────────────────────────────────────────────┘
```

- **Sidebar:** Deep Forest background, white text, 240 px wide. The selected item uses a Forest Green fill with a 4 px Fresh Green left edge. The logo mark sits at the top.
- **Top bar:** White with a Stone bottom border. Farm switcher (and organisation switcher when the user has several, ACC-07), date range, language toggle, alerts, and the user menu.
- **Content:** Cream background, full width with 32 px padding, so its edges line up with the top bar.

### 6.2 Navigation and modules

| Menu item | Contains | Shown when | Capability |
| --- | --- | --- | --- |
| Dashboard | Farm overview (J6) | Always | `money.read` for money figures |
| Farm | Farms, plots, structures, plot history | Always | Owner, manager |
| Animals | Herds and animals | Dairy, beef, goats or sheep enabled | Any |
| Poultry & fish | Batches | Layers, broilers or fish enabled | Any |
| Crops | Seasons, activities, harvests | Any crop enabled | Any |
| Stock | Items, balances, movement history, stock counts, transfers | Always | Quantities: any; values: `money.read` |
| Sales | Sales, customers, money owed | Always | `money.read` |
| Purchases | Purchases, suppliers, money we owe | Always | `money.read` |
| Money | Other income and expenses, profit, cost per unit, export | Always | `money.read` |
| Weather | Forecast and history per farm | Always | Any |
| Settings | Farm details, what you keep, members, language | Always | Owner; managers see a reduced set |

Items for disabled modules are removed from the menu, not greyed out (ONB-04). A field worker who signs in sees only Animals, Poultry & fish, Crops, Stock (quantities) and Weather.

### 6.3 Responsive behaviour

| Width | Layout |
| --- | --- |
| 1280 px and up | Full sidebar, two-column dashboard |
| 1024 to 1279 px | Full sidebar, single column |
| 768 to 1023 px | Sidebar collapses to icons with tooltips |
| Below 768 px | Sidebar becomes a menu drawer; tables become stacked rows; primary action becomes a bottom bar button |

---

## 7. Key screens

### 7.1 Dashboard (J6, FIN-04)

The dashboard answers "what is making money?" before anything else.

```
Kamau farm · This month                                                    
┌──────────────────────────────────────────────────────────────────────────┐
│ Profit this month                                                        │
│ KES 120,300          Revenue KES 245,600   Costs KES 125,300             │
│ Profit, up 12% on last month                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ Enterprise             Costs ▮▮▮▮▮  Revenue ▮▮▮▮▮▮▮▮▮▮     Profit        │
│ Dairy herd             ▮▮▮▮▮▮▮      ▮▮▮▮▮▮▮▮▮▮▮▮▮▮        KES 64,200    │
│ Layers, batch 3        ▮▮▮▮▮▮▮▮▮    ▮▮▮▮▮▮▮▮▮▮▮▮▮         KES 38,900    │
│ Maize, long rains      ▮▮▮▮▮▮       ▮▮                    Loss KES 9,100│
│ Broilers, batch 7      ▮▮▮          ▮▮▮▮▮▮▮▮              KES 26,300    │
└──────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Needs attention                 │ │ Weather, next 7 days                 │
│ ● Layers mash low: 2 bags left  │ │ Today 22°C light rain                │
│ ● Mortality up in batch 7       │ │ Thu  heavy rain expected             │
│ ● Vaccinate batch 7 by Friday   │ │ ...                                  │
├─────────────────────────────────┤ └──────────────────────────────────────┘
│ Money owed to you               │
│ KES 18,400 from 4 customers     │
│ Oldest: 23 days (Mama Wanjiru)  │
└─────────────────────────────────┘
```

- **Headline figure:** profit for the period in Display type, coloured by sign (3.3), with revenue and costs beside it in Body strong. This replaces a set of equal stat cards.
- **Enterprise strip (the signature element):** one row per enterprise, sorted by profit. Each row pairs a terracotta cost bar and an amber revenue bar on a shared scale, then profit or loss with its word. Clicking a row opens the enterprise. Closed batches and seasons in the period appear with a "Closed" chip.
- **Needs attention:** alerts from the alerts module, most severe first, each with one action ("Record purchase", "View batch").
- **Money owed:** total receivables, count of customers, oldest debt.
- **Weather:** compact forecast with the sky gradient; heavy-rain days flagged.
- **Field-worker view:** the headline figure and enterprise strip are replaced by today's records per enterprise and stock quantities.

### 7.2 Enterprise detail (batch, herd or season)

```
Layers, batch 3                                  [Record day] [Close batch]
Started 12 Mar 2026 · Poultry house 2 · 480 of 500 birds
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Laying rate  │ Feed per tray│ Cost per tray│ Mortality    │
│ 86%          │ 2.1 kg       │ KES 212      │ 4.0%         │
└──────────────┴──────────────┴──────────────┴──────────────┘
[Daily records] [Health] [Stock used] [Sales] [Money]
Date      Eggs (trays)  Feed        Deaths  Recorded by        
28 Sep    14            1 bag       0       Otieno (phone)     
27 Sep    15            1 bag       1       Otieno (phone)     
```

- Four key numbers specific to the enterprise type (from BAT-07, CRP-05, FIN-03), in a single bordered row, not four floating cards.
- Tabs for records, health, stock used, sales and money. The money tab is hidden without `money.read`.
- Every record shows who recorded it and from which device, supporting the absentee owner's need for trust.
- Close batch or season shows a summary sheet of cost, revenue, profit and the type's key ratios before confirming.

### 7.3 Stock and the ledger view (INV-*)

- **Balances table:** item, store, quantity in the farmer's unit (with base unit on hover), value (with `money.read`), low-stock status chip.
- **Movement history:** a chronological ledger per item. Reversals appear as a linked pair: the original row is struck through lightly with a "Corrected" chip, and the reversal row sits directly beneath it. Nothing disappears.
- **Negative stock** shows the quantity in terracotta ink with the note "Recorded use before the purchase arrived. Record the purchase to fix this."
- **Actions:** Record purchase, Stock count, Transfer between enterprises.

### 7.4 New sale with M-Pesa (J4, SAL-*)

A side panel over the sales list, so the owner keeps context.

1. Customer (search or add new with name and phone)
2. Lines: product, quantity with unit selector, price per unit; the enterprise is filled from the stock's owner and can be changed
3. Total in Display type
4. Payment: **M-Pesa request**, Cash, or Credit

M-Pesa payment states, shown inline in the panel and on the sale row afterwards:

| State | Chip colour | Message |
| --- | --- | --- |
| Sending request | Amber | "Request sent to 0712 345 678. Ask the customer to enter their M-Pesa PIN." |
| Paid | Health | "Paid. M-Pesa receipt RJK4XY1234." |
| Failed or cancelled | Terracotta | "The customer cancelled the payment. Try again, take cash, or save as credit." |
| No response yet | Amber | "Still waiting for M-Pesa. We'll update this sale when the payment arrives." |

If the organisation uses manual confirmation (payment option C), the M-Pesa choice asks for the confirmation code instead.

### 7.5 Crops and plots

- **Plot list** with area, tenure and what is growing now; a map view shows drawn boundaries (FRM-03) with each plot filled by crop status.
- **Season detail** follows the enterprise pattern (7.2): activities timeline, inputs used, harvests, and yield per acre on close. Intercropped seasons show their area share.

### 7.6 Settings

- **What you keep:** the same picture-tile grid as onboarding (ONB-05). Removing a type asks: "Hide broilers? Past records stay in your reports."
- **Members:** list with role and farms; invite by phone; remove with a clear consequence: "Otieno will lose access now. His phone will clear this farm's data the next time it connects."
- **Farm details:** name, location pin, plots and structures.
- **Language:** personal setting, separate from anyone else on the farm.

### 7.7 Sign-in and account setup

Split screen: the left panel uses the Deep Forest gradient with the logo and "Manage. Grow. Thrive." in the chosen language; the right panel holds the form.

1. Choose language (ONB-01)
2. Phone number and one-time code (ACC-01)
3. Farm name and location (FRM-01)

Account setup ends with a short confirmation, "Your farm is set up", and goes straight to choosing what the farmer is dealing with (7.8). The dashboard is not shown until that step is done.

### 7.8 Choose what you're dealing with (first run)

Right after account setup, the farmer chooses what their farm keeps and grows. This is a required step: at least one choice is needed before the portal opens, because every menu, screen and dashboard figure depends on it (ONB-02, ONB-04).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ What's on your farm?                                                     │
│ Choose everything you keep or grow. You can change this later.           │
│                                                                          │
│ Animals                                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│ │ [image]  │ │ [image]  │ │ [image]  │ │ [image]  │                      │
│ │Dairy cows│ │Beef      │ │Dairy     │ │Sheep     │                      │
│ │        ✓ │ │cattle    │ │goats     │ │          │                      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                      │
│ Poultry and fish                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                                   │
│ │Layers  ✓ │ │Broilers  │ │Fish      │                                   │
│ └──────────┘ └──────────┘ └──────────┘                                   │
│ Crops                                                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│ │Maize   ✓ │ │Beans     │ │Rice      │ │Wheat     │                      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                      │
│ Coming soon                                                              │
│ Pigs, rabbits, tomatoes, kales, bananas, avocados        [I keep these]  │
│ Something else? [ type it here                          ]                │
│                                                                          │
│                                             [Continue with 3 choices]    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Tiles**

- Large picture tiles (160 × 140 px on desktop, two per row on phones) with a photo or illustration and the name in the farmer's language.
- Grouped under three plain headings: Animals, Poultry and fish, Crops.
- Unselected: white surface, Stone border. Selected: Soft Sage fill, 2 px Forest Green border, a check icon in the corner. The tile is a toggle button, announced to screen readers as "Dairy cows, selected".
- Multiple choice. Keyboard: Tab between tiles, Space to toggle.

**Coming soon and something else**

- Types planned for Phase 2 appear as a short list the farmer can mark ("I keep these"). They are not enabled, but the choice is recorded so the team knows demand and can notify the farmer when the type arrives.
- A free-text field captures anything missing. This feeds the catalogue backlog (ONB-06).
- A farmer who picks only coming-soon types or only "something else" sees: "We don't support these yet. Choose at least one of the types above to start, or we'll let you know when yours is ready." They can still sign out and be notified.

**Continue**

- The button is disabled until at least one supported type is chosen, and shows the count ("Continue with 3 choices") so the farmer can see their selection is registered.

**Quick counts (next screen, ONB-03)**

One row per choice, every question optional:

| Choice | Question |
| --- | --- |
| Dairy cows, beef cattle, dairy goats, sheep | How many do you have? |
| Layers, broilers | How many birds are in your current flock? |
| Fish | How many fish did you stock? |
| Maize, beans, rice, wheat | Roughly how many acres? |

Buttons: "Start using Shamba OS" and a quiet "Skip for now".

**What happens next**

- The portal opens on a dashboard showing only the chosen types, with one suggested first action for the first choice ("Record today's milk", "Start your layers batch", "Start your maize season").
- Behind the scenes the onboarding service enables a module per choice, creates an enterprise for each, loads the matching products and units, and subscribes the farm to weather (backend section 6).

**Rules**

- If the farmer leaves before choosing, the next sign-in returns them to this screen, not an empty dashboard.
- Invited managers and field workers skip this step; they join a farm whose choices are already made.
- A farmer with several farms makes these choices per farm. Adding a new farm later runs this same screen for that farm.
- Changing choices later uses the same tile screen in Settings, What you keep (7.6). Removing a type hides it but keeps its history (ONB-05).

---

## 8. Components

### 8.1 Buttons

| Type | Style | Use |
| --- | --- | --- |
| Primary | Forest Green fill, white text | One per screen or panel |
| Secondary | White fill, Stone border, Forest Green text | Other actions |
| Quiet | No border, Leaf Green text | Inline and table actions |
| Destructive | Terracotta-ink text on white; filled terracotta only inside confirmation dialogs | Remove member, reverse a record |

Labels say what happens: "Record sale", "Close batch", "Invite member". The button that says "Record sale" produces a message that says "Sale recorded".

### 8.2 Inputs

- 40 px high, 8 px radius, Stone border, Forest Green border and focus ring when focused.
- **Money input:** "KES" prefix in muted text, right-aligned tabular figures, thousands separators on blur.
- **Quantity input:** number plus a unit selector showing only units valid for the product (bags, debes, kg for maize; trays and pieces for eggs).
- **Date input:** defaults to today; the farm's time zone.
- Errors appear under the field in terracotta ink with the fix: "Enter a quantity greater than zero."

### 8.3 Status chips

Pill shape, 12% tint background, ink text, with an icon so meaning never depends on colour alone.

| Chip | Colour | Examples |
| --- | --- | --- |
| Positive or done | Health | Paid, Completed, Healthy, Closed |
| Attention or pending | Amber | Credit, Due soon, Awaiting payment |
| Problem | Terracotta | Overdue, Low stock, Failed, Loss |
| Information | Lavender | Corrected, Imported, Conflict to review |
| Weather | Sky | Rain expected |
| Neutral | Sand background, Charcoal text | Draft, Hidden |

### 8.4 Tables

- White surface, Sand header row, Stone row dividers, 48 px rows.
- Text left aligned; numbers and money right aligned with tabular figures; units in the header ("Quantity (bags)").
- Sort, filter by farm and enterprise, and cursor-based "Load more" to match the API.
- Row hover uses Soft Sage at low opacity; the selected row uses Soft Sage.
- On narrow screens each row becomes a stacked block with label and value pairs.

### 8.5 Charts

- Library: Recharts, styled with the tokens above.
- Revenue amber, cost terracotta, profit green, loss terracotta (3.3); weather in sky.
- No 3D, no chart shadows, Stone gridlines, axis labels in Small text with units.
- Every chart has a text summary above it ("Milk income rose 8% this month") so the point doesn't depend on reading the chart.

### 8.6 Alerts

In-app inbox from the bell, and the "Needs attention" list on the dashboard. Each alert has an icon, one-line message in the reader's language, the farm and enterprise, and a single action. Field workers never see money alerts.

---

## 9. States

| State | Treatment |
| --- | --- |
| Loading | Skeleton rows in Sand matching the final layout; no spinners for page loads |
| Empty | An invitation to act, never a mood: "No sales yet this month. Record a sale to see revenue here." with the primary button |
| Error | What happened and how to fix it: "The M-Pesa request didn't go through. Check the phone number and try again." Errors never apologise and are never vague |
| No permission | "Only the farm owner can manage members." No broken screens or empty tables |
| Module hidden | Screen is unreachable from the menu; direct links show "Broilers are hidden on this farm. Turn them on in Settings." |
| Data from the field | Records synced from phones show the device and when it synced; conflicts show a lavender "Review" chip that opens a side-by-side comparison |
| Offline browser | A top banner: "You're offline. Changes can't be saved until you reconnect." |

---

## 10. Language and copy

- Interface text comes from translation files keyed by code; the API returns codes, not sentences (backend section 16).
- Allow for Swahili strings about 30% longer than English: no fixed-width buttons, and navigation labels that wrap to two lines if needed.
- Money: "KES 245,600" with thousands separators and no decimals unless the value has cents. Dates: "28 Sep 2026" in English, "28 Sep 2026" in Swahili with Swahili month names where the locale provides them.
- Voice: plain verbs, sentence case, short sentences, no jargon ("money owed to you", not "accounts receivable").

Starting glossary, to be reviewed by a native Swahili speaker with farming experience:

| English | Swahili |
| --- | --- |
| Dashboard / overview | Muhtasari |
| Sales | Mauzo |
| Purchases | Manunuzi |
| Customers | Wateja |
| Suppliers | Wasambazaji |
| Costs / expenses | Gharama |
| Profit | Faida |
| Loss | Hasara |
| Money owed | Madeni |
| Livestock / animals | Mifugo |
| Crops | Mazao |
| Weather | Hali ya hewa |
| Settings | Mipangilio |

---

## 11. Accessibility

- WCAG 2.1 AA: text meets 4.5:1 using the ink tokens (3.2); large text and icons at least 3:1.
- Full keyboard use; visible focus ring on everything; logical tab order; Escape closes panels and menus.
- Colour is never the only signal: money has signs and words, chips have icons.
- Charts have text summaries and an accessible data table behind them.
- Respect reduced motion; the only motion is panels sliding in and bars growing once on first load of the dashboard.
- Minimum target size 40 × 40 px on touch screens.

---

## 12. Implementation notes

- **Stack:** React with TypeScript, TypeScript types generated from the backend OpenAPI schema (drf-spectacular).
- **Tokens:** a single `tokens.css` with the custom properties in section 3 to 5; components never use raw hex.
- **Organisation header:** every API call sends `X-Org-Id` for the active organisation; switching organisation clears cached data.
- **Capabilities:** the navigation and screens read capabilities from the session (`money.read`, `members.manage` and so on). Hiding money in the UI is a convenience only; the server already redacts it (backend section 5).
- **Modules:** the navigation payload from the API decides which menu items exist.
- **Dashboard caching:** the client refetches on farm, date-range or organisation change; do not share cached payloads between users on the same browser.

---

## 13. Open questions

| # | Question | Needed for |
| --- | --- | --- |
| W1 | Confirm the ink colour values with a contrast checker and add them to the palette sheet | Design tokens |
| W2 | Update the palette's "Expenses vs Revenue" example to the semantic colours (amber revenue, green profit) | Brand consistency |
| W3 | Is Figtree acceptable, or is there an existing brand typeface? | Typography |
| W4 | Should field workers be allowed on the web portal at all, or only in the app? | Navigation, permissions |
| W5 | Which payment option ships first (till, manual code, or aggregator) | New sale flow |
| W6 | Native-speaker review of the Swahili glossary | Localisation |
| W7 | Is a dark mode needed for the portal? The MVP assumes light mode only | Tokens |