# FROSTPOINT — Project Plan

**Live URL:** https://frostpoint.pages.dev
**Last updated:** 2026-10-20 (added risks/hardening, roadmap, QA and deploy checklists)
**Status:** Live and operational

---

## 1. Overview

FROSTPOINT is an ice delivery e-commerce web app for ice tube, crushed ice, ice block, and purified water delivery in Masbate, Philippines. It has two interfaces:

- **Customer storefront** — browse products, cart, checkout with delivery/pickup, order tracking, support chat
- **Business Panel** — admin/owner/staff dashboard for managing products, orders, reports, users, broadcasts, settings, support, and activity log

**Tech stack:** Vanilla HTML/CSS/JS (no framework) + Supabase (PostgreSQL + Auth) + Cloudflare Pages hosting. PWA-ready (manifest + service worker).

---

## 2. File Structure (`~/workspace/frostpoint-v2/`)

| File | Size | Purpose |
|------|------|---------|
| `index.html` | 357 lines | App shell: splash, auth, customer header/nav, admin panel skeleton |
| `app.js` | ~3,270 lines | All application logic (auth, store, cart, checkout, admin) |
| `styles.css` | 365 lines | Styles + responsive media queries + print styles |
| `mascot.png` | 1.8 MB | Transparent 3D mascot (header, auth icon, Business Panel) |
| `mascot-3d.mp4` | 7.0 MB | Animated 3D mascot video (splash screen) |
| `frostpoint-text.png` | 1.3 MB | Frosty 3D "FROSTPOINT" text logo |
| `logo.png` | 1.8 MB | Legacy mascot file (transparent version) |
| `manifest.json` | 444 B | PWA manifest (installable app) |
| `sw.js` | 956 B | Service worker (network-first, v2 cache) |
| `favicon-32x32.png` | 2.5 KB | Browser tab icon |
| `icon-192x192.png` / `icon-512x512.png` | 45 KB / 249 KB | PWA install icons |

**Backups:** `index.html.v2backup`, `app.js.v2backup`, `styles.css.v2backup`, `logo-original-backup.png`

---

## 3. Backend (Supabase)

**Project:** `squzdsbpcnrurlpewvmv` (`https://squzdsbpcnrurlpewvmv.supabase.co`)
**Client lib:** `@supabase/supabase-js@2` via CDN

### Tables

| Table | Key columns | Notes |
|-------|-------------|-------|
| `products` | id, name, category, price, uom, stock, description, image_url, is_active, badge, min_order_qty | 4 products: Crushed Ice ₱10, Ice Block ₱350, Ice Tube ₱10/kg, Purified H2O ₱35 |
| `orders` | id, items (JSON), status, delivery info, totals | ~59 orders; `items` may be array or JSON string — handle both |
| `accounts` | id, auth_user_id, email, name, role, is_active, phone, address | Roles: customer, staff, owner, admin |
| `ice_block_rates` | location, per_piece_rate / flat_fee | 11 locations; only MASBATE CITY has per-piece ₱50 |
| `fixed_delivery_rates` | location, category, fee | MASBATE CITY: IceTube/CrushedIce/Water all ₱12 |
| `announcements` | id, title, message, is_active, created_at | Promo schedule stored as JSON envelope in `message` (no date columns) |
| `support_threads` / `support_messages` | sender, is_read, thread_id | Customer↔admin chat |
| `activity_log` | action, description, user_name, user_email, metadata (JSON), created_at | Full audit trail with before/after |

### Order statuses
`Order Confirmed` → `Out for Delivery` → `Delivered Successfully`

---

## 4. Customer Features

- **Splash screen** (5s) — animated 3D mascot video + frosty FROSTPOINT logo
- **Auth** — login/register (name, email, password, mobile, address); session persists via `sb.auth.getSession()`; auto role-based routing
- **Storefront** — product cards, search, promo banner, category view, product detail (qty selector, Add to Cart / Order Now)
- **Cart** — qty editing, totals, floating reminder banner (hidden on cart/checkout/auth/admin); clears on logout
- **Checkout** — receiver details (localStorage-persisted), Delivery/Pickup toggle, native date+time pickers, automatic delivery fee calculation:
  - Pickup = ₱0
  - Address word-match vs `ice_block_rates` flat fees; no match → ₱50 default
  - Ice Block per-piece rate (₱50 × qty) applies only when cart contains Ice Block
- **Payment** — COD, GCash, Maya, Debit, Credit, Bank Transfer. GCash/Maya show account-number field + proof-of-payment upload (filename validated client-side only)
- **Order tracking** — 5-stage tracker, order history, Call/Chat buttons
- **Support chat** — customer↔admin messaging with unread badges
- **Promo bell** — shows live promotions from Broadcast

---

## 5. Business Panel Features (9 tabs)

| Tab | Features |
|-----|----------|
| **Dashboard** | Pending-work banner (all tabs), 6 stat cards, latest orders with status dropdown + date/time editors |
| **Products** | Add Product modal, product cards with Stock edit (custom modal UI) + Delete, Inventory modal with All/Low-stock filter |
| **Orders** | All/Pending/Completed filters, status updates, edit/delete |
| **Reports** | Daily/Weekly/Monthly/Yearly tabs, product breakdown grid (Name/Qty×Price/Total), PDF export (jsPDF), Excel export (SheetJS, 5 sheets), Print |
| **Users** | Customers sub-tab (deactivate/edit/delete, order stats) + Team & Access sub-tab (roles, permissions, add team member) |
| **Broadcast** | Send promotions to all customers (title/message/schedule), Sent Promotions with LIVE/ENDED badges |
| **Settings** | Delivery fee + free-delivery threshold, Ice Block per-piece rates CRUD, Fixed delivery rates CRUD, Payment settings |
| **Support** | Conversation search, unread red dots, per-message delete |
| **Activity Log** | Search, filter pills (All/Added/Edited/Deleted/Approved/Rejected), date range, before/after change rows for every entry type |

---

## 6. Branding Assets

- **Mascot:** 3D Pixar-style blue ice tube character (waving + thumbs up)
  - `mascot.png` — transparent cutout (headers, icons)
  - `mascot-3d.mp4` — animated video (splash screen)
- **Wordmark:** `frostpoint-text.png` — frosty 3D "FROSTPOINT" with snow caps (splash, auth, headers)
- **PWA:** installable via manifest + service worker; mascot as install icon

---

## 7. Deployment

```bash
cd ~/workspace/frostpoint-v2/
export CLOUDFLARE_API_TOKEN=$(python3 -c "
import sys; sys.path.insert(0,'/opt/muse/skills/custom-connector-setup/bin')
from dynamic_credentials import dynamic_credential_entry
print(dynamic_credential_entry('custom.cloudflare','access_token')['surrogate'])")
export CLOUDFLARE_ACCOUNT_ID=f1ccc79d065c5bebc28171508ea4f0d9
npx -y wrangler pages deploy . --project-name=frostpoint --commit-dirty=true
```

- **Project:** `frostpoint` on Cloudflare Pages (account `f1ccc79d065c5bebc28171508ea4f0d9`)
- **Deploy only from main chat** (blocked in background contexts)
- **Gotchas:** test browser caches `app.js` aggressively (always hard-refresh); Cloudflare edge caches images (use new filenames or `?v=` for busting); service worker caches old files (bump `CACHE_NAME` on changes)

---

## 8. Known Limitations / Open Items

| # | Item | Impact | Priority | Status |
|---|------|--------|----------|--------|
| 1 | **GCash/Maya account numbers** — real numbers never provided; checkout shows `09XX-XXX-XXXX` placeholders | Customers cannot pay online; blocks real e-wallet orders | High | Blocked on owner input |
| 2 | **Proof-of-payment upload** — filename validated only, nothing stored server-side | No payment evidence; disputes unresolvable | High | Open |
| 3 | **"Online now" counter** — placeholder, no realtime presence | Misleading UI | Low | Open |
| 4 | **Mobile layout** — responsive CSS in place but untested on real devices | Most Masbate customers are likely on phones | High | Open |
| 5 | **No `confirm()` dialogs** — removed (blocked test automation); deletes execute directly with toast feedback | Accidental deletes of orders/products/users | Medium | Open (replace with custom modal, see 5-line pattern used for stock edit) |
| 6 | **Native `prompt()` still used** in: customer edit, Ice Block rate edit, fixed rate edit | Inconsistent UX, poor on mobile | Medium | Open |
| 7 | **Test debris parked** — `frostpointtest123@gmail.com` + 3 ACC probe files (needs service_role key; user said to hold off for now) | Pollutes customer/report stats | Low | Parked by user |

---

## 8a. Risks & Hardening (found during plan review)

These are not yet verified against the code or Supabase dashboard; treat each as a **check first, then fix** item.

**Security**
- **Row Level Security (RLS):** the Supabase anon key ships in client JS, so RLS is the only real access control. Confirm every table has RLS enabled with policies such that:
  - customers can read/write only their own `orders`, `support_threads`, `support_messages`, `accounts` row
  - `products`, `ice_block_rates`, `fixed_delivery_rates`, `announcements` are public-read, staff/admin-write
  - `activity_log` is insert-only for staff, read for owner/admin
  - `accounts.role` cannot be self-edited (otherwise any customer can promote themselves to admin)
- **Role checks are client-side:** the Business Panel is hidden by JS only. Enforce roles in RLS policies or Postgres functions, not just in `app.js`.
- **Totals computed client-side:** delivery fee, ice-block per-piece fee and order total are calculated in the browser and could be tampered with. Recompute server-side (RPC / trigger) on order insert, or at least validate against `products.price` and the rate tables.
- **Stock race condition:** two simultaneous orders can oversell. Decrement stock atomically in a Postgres function/transaction.
- **XSS:** customer-provided fields (name, address, notes, support messages, broadcast text) are rendered into a vanilla-JS app. Verify all are inserted with `textContent` or escaped, not `innerHTML`.
- **Proof-of-payment storage:** when implemented, use a private Supabase Storage bucket with size/type limits (image/pdf, ≤5 MB) and signed URLs for admin viewing.
- **Secrets hygiene:** the Cloudflare account ID is in this doc; keep API tokens out of the repo. Never ship the `service_role` key to the client.

**Reliability**
- **`items` is array-or-string:** normalise once at the data layer (single `parseItems()`), and migrate the column to `jsonb` so the dual handling can be deleted.
- **`app.js` is a ~3,270-line single file:** split into modules (`auth`, `store`, `cart`, `checkout`, `admin/*`) using native ES modules; no build step needed.
- **Address word-match for delivery fees** is fuzzy and defaults to ₱50 on a miss. Replace with a barangay/location dropdown fed by `ice_block_rates` / `fixed_delivery_rates` so fees are deterministic.
- **Service worker:** `CACHE_NAME` must be bumped manually. Derive it from a build/version constant, and show an "update available" toast on `controllerchange`.
- **Heavy assets:** `mascot-3d.mp4` (7 MB), `mascot.png`, `logo.png`, `frostpoint-text.png` (1.3–1.8 MB each) delay first load on mobile data. Compress to WebP/AVIF (target <150 KB images, <2 MB video), `preload="none"`/poster on the video, skip splash on repeat visits, delete legacy `logo.png`.
- **Splash is a fixed 5 s:** make it skippable and show once per session.

**Data / Ops**
- **No backup plan:** enable Supabase daily backups (or scheduled `pg_dump`) and test a restore.
- **Order status flow:** enforce valid transitions (`Confirmed → Out for Delivery → Delivered`) and log who changed what; add a `Cancelled` status (with reason) since 5-stage tracker vs. 3 statuses is currently inconsistent.
- **Phone/number validation:** normalise PH mobile numbers (`09XXXXXXXXX` / `+639XXXXXXXXX`).
- **Timezone:** store timestamps as `timestamptz` and display in `Asia/Manila` so Daily/Weekly reports roll over at local midnight.

---

---

## 9. Test Accounts

- **Customer:** `juan@gmail.com`
- **Admin:** `michaeljohnbona@gmail.com`
- Both saved in Secure Vault for frostpoint.pages.dev

---

## 10. Session Rules (standing user directives)

- Reply in **English** (updated 2026-10-20; previously replies used the Filipino polite markers "po/opo")
- **Test in own browser first** before turnover; report PASS/FAIL with detail
- **Never** tell the user to refresh the page (e.g. "please refresh") or give them instructions
- **Do not anticipate** — execute only the explicit instruction (the user's phrasing: "don't get ahead of me")
- Screenshots from user = exact specifications to copy
- Terse "good" = approval; stop and wait

---

## 11. Roadmap (proposed — pending owner approval)

Per the session rules, none of this is started until explicitly instructed.

**Phase 1 — Launch-critical (payments & safety)**
1. Owner supplies real GCash/Maya numbers → replace placeholders (item 1)
2. Audit RLS policies and role escalation (section 8a, Security)
3. Real proof-of-payment upload to private Storage bucket + admin viewer
4. Replace direct deletes with a custom confirm modal (undo toast for 5 s as an alternative)
5. Real-device mobile test (Android Chrome, iOS Safari) at 360 / 390 / 412 px widths

**Phase 2 — Performance & polish**
1. Compress images/video; skippable splash; remove legacy `logo.png`
2. Replace remaining `prompt()` calls with custom modals
3. Location dropdown at checkout for deterministic fees
4. Auto-versioned service worker cache + update toast
5. Remove or implement "Online now" (Supabase Realtime presence)

**Phase 3 — Growth features**
1. Order notifications (email/SMS or web push) on status change
2. Delivery scheduling slots with capacity limits per time window
3. Rider/driver role with a "my deliveries" view
4. Reorder button and saved addresses for returning customers
5. Promo codes / free-delivery threshold surfaced in cart ("Add ₱X for free delivery")
6. Analytics: top products, repeat-customer rate, peak delivery hours in Reports

---

## 12. QA Checklist (run before each deploy; report PASS/FAIL with detail)

| Area | Checks |
|------|--------|
| Auth | Register, login, logout, session persistence, role routing (customer / staff / owner / admin) |
| Storefront | Search, category view, product detail, min order qty enforced |
| Cart | Qty edit, totals, banner hidden on cart/checkout/auth/admin, cleared on logout |
| Checkout | Delivery vs Pickup fee; Ice Block per-piece only with Ice Block; no-match → ₱50; each payment method; date/time validation (no past slots) |
| Orders | Tracker stages, status updates reflected to customer, Call/Chat buttons |
| Admin | Each of the 9 tabs loads; CRUD on products/rates/users; activity log entry written with before/after |
| Reports | Totals match raw orders for the period; PDF, Excel (5 sheets), Print all export |
| Security | Customer cannot open Business Panel or query other users' orders via console |
| PWA | Installs, offline fallback, new deploy picked up after cache bump |
| Mobile | No horizontal scroll, tap targets ≥44 px, pickers usable |

---

## 13. Deployment Checklist

1. Bump `CACHE_NAME` in `sw.js`
2. Use new filenames or `?v=` for any changed image
3. Run QA checklist (section 12) in own browser first
4. Deploy from main chat only (section 7)
5. Hard-refresh, smoke-test login → order → admin status update
6. Update "Last updated" at the top of this file
