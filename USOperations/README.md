# US Operations · Imporlan

Internal mission-control dashboard for Imporlan's US opportunity-boat
flow: source a deal, negotiate it, buy it, pick it up, refit it, and
flip it for profit — either in the US or by importing it to Chile.

Lives at `/USOperations/`. English-language UI by design (we work
hand-in-hand with US-based collaborators).

---

## Layout

```
USOperations/
├── index.html       # The deal desk (one boat at a time)
├── ops.css          # All styles (tokens, layout, components, print)
├── ops.js           # State, pipeline, forms, KPIs, P&L, exports
├── insights.js      # Comps card + import-to-Chile bridge
├── scraper.js       # Quick-fill listing-text parser (modal)
├── sync.js          # Optional backend sync layer (multi-user mode)
└── deals/
    └── index.html   # Cross-deal listing + roll-up KPIs
```

The matching backend ships in:

```
api/us_operations_api.php
api/migrations/create_us_operations.php
```

---

## Two operating modes

### 1) Local-only (default)

Open `/USOperations/`. Everything is stored in the browser via
`localStorage` under the `imporlan.us_operations.v1` key. **Export**
and **Import** in the header round-trip the deal as a JSON file so
the team can share state by email or chat.

### 2) Cross-device sync (multi-user)

1. Run the migration once on the server:
   `https://www.imporlan.cl/api/migrations/create_us_operations.php`
2. Configure the shared secret in `/home/wwimpo/deploy_config.php`:
   ```php
   define('US_OPS_TOKEN', 'pick-a-long-random-string');
   ```
3. In the dashboard, click **Sync** in the header and paste the same
   token. From then on every change pushes to the server (debounced
   800ms) and pulls remote state on boot.

The status pill in the header reflects the sync state:
`Synced HH:MM` · `Saving…` · `Offline — local only` ·
`Offline — token rejected`.

---

## Sections of the deal desk

| Section | Purpose |
|---------|---------|
| **Target** | Hero card with the listing photo, specs, known issue + KPI strip (asking, target, all-in, resale, projected profit). |
| **Pipeline** | 6-stage Sourcing → Negotiation → Purchase → Pickup → Refit → Sale flow with progress bar and one-click Advance / Back. |
| **Negotiation** | Price anchors (asking / walk-away / target / opening) plus an offer log with us/seller side, dates and notes. |
| **Insights** | Comparable-sales card (auto-filtered by hero make/model/year) + US-flip vs import-to-Chile bridge with a "Recommend best path" button. |
| **Purchase** | Closing checklist + agreed price, deposit, payment method, closing date, title notes. |
| **Pickup** | Route, hauler, transport mode, distance + transport / fuel / storage costs and a pickup-day checklist. |
| **Refit** | Work-item table (parts + labor + status) with live totals chip. |
| **Sale** | List-price / floor / channels / draft description, sale checklist, buyer-inquiry log. |
| **Collaborators** | The US-based team for this deal (name, role, contact, location). |
| **P&L** | Live cost-stack vs revenue with profit / margin and color-coded outcome panel. |

---

## Multi-deal usage

- `/USOperations/deals/` — index of every saved deal with a roll-up
  KPI strip across the portfolio.
- `/USOperations/?deal=US-2026-002` — open any deal in the same desk
  (the frontend reads the query param and the sync layer pulls the
  matching record).

The seed deal `US-2026-001` ships with the migration and points to
the Facebook Marketplace target boat
([item 976023998340848](https://www.facebook.com/marketplace/item/976023998340848/)).

---

## Quick-fill from a listing

The vessel-card header has a **Quick fill** button. Paste the listing
text from any source (FB Marketplace, Craigslist, BoatTrader, broker
email, dealer PDF) and we'll detect: make + model, year, length,
engine, hours, US location, trailer status, title status and asking
price. Conservative — better to skip a field than write garbage.

---

## Print / PDF

Header → **Print / PDF** → save as PDF. The print stylesheet hides
forms, the toast and editing chrome, and switches the cards to a
paper-friendly look so the resulting one-pager is investor-ready.

---

## Deploy

This repository has the standard Imporlan deploy flow:

- Test:        `/api/deploy.php?env=test&token=$DEPLOY_TOKEN`
- Production:  `/api/deploy.php?env=prod&token=$DEPLOY_TOKEN&confirm=yes`

After the production deploy, run the schema migration once:

```
curl https://www.imporlan.cl/api/migrations/create_us_operations.php
```

---

## Roadmap (not yet shipped)

- Real comps via NADA / BoatTrader sold-listings API.
- Photos / docs uploads (title scan, bill of sale) per deal.
- Email notifications on stage advance.
- Per-collaborator access tokens (rather than one shared token).
