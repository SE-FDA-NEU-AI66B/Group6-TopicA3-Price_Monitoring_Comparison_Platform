**Live Production URL:** https://pricelens-lll0.onrender.com · **Health Check:** https://pricelens-lll0.onrender.com/health

# PriceLens — Price Monitoring & Comparison Platform

[![CI](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/actions/workflows/ci.yml)

PriceLens helps online shoppers follow the price of a product across several stores. It records 30-day price history, compares current offers for the exact same product variant, and sends an email notification when the price drops to or below a user-defined target.

**Group 6 · Topic A3:** Price Monitoring and Comparison Platform

## Test accounts (Demo / Non-Production Credentials)

Sign in directly from the first page (https://pricelens-lll0.onrender.com/) using either pre-seeded demo account below (never a real password):

| Role / Scenario | Email | Password | Pre-loaded Seed State |
| :--- | :--- | :--- | :--- |
| **Standard Shopper (Default Demo)** | `demo@pricelens.local` | `PriceLensDemo2026!` | 10 tracked products, 30/1/0-day US02 history states, multi-retailer US09 offers, and 2 US05 notifications |
| **BR1 Boundary Tester (20 Alerts)** | `alert-boundary@pricelens.local` | `PriceLensDemo2026!` | 1 tracked product with 20 active alerts to test the BR1 maximum active-alert limit |

## P0 user stories and where each one starts

Every P0 story can be completed by clicking only, starting from the first page (`https://pricelens-lll0.onrender.com/`):

| Story | Priority | What the user can do | Where it starts (Click-only path from the first page) |
| :--- | :--- | :--- | :--- |
| **US02** | P0 | View 30-day price history chart, min/max/current summary, and 1-point / 0-point states | Landing (`/`) → **Sign in** → Watchlist (`/watchlist/`) → Click **View details** on *Apple MacBook Air M2* (30 points), *Kindle Paperwhite* (1 point), or *Sony WH-1000XM5* (0 points) |
| **US03** | P0 | Create a price alert below the current price (enforcing BR1 $\le 20$ alerts & BR2 target $<$ current) | Landing (`/`) → **Sign in** → Watchlist (`/watchlist/`) → Click **View details** on *Dell XPS 13 9340* → Fill **Target price (VND)** → Click **Create price alert** |
| **US04** | P0 | Add a product to the watchlist from a supported store URL and choose an exact variant | Landing (`/`) → **Sign in** → Watchlist (`/watchlist/`) → Click **Add product** (`/products/add/`) → Paste store URL → Click **Check URL** → Select variant → Click **Start tracking** |
| **US05** | P0 | Receive an email notification when a tracked product's price drops to or below the target price | Landing (`/`) → **Sign in** → Watchlist (`/watchlist/`) → Click **View details** on *Apple iPhone 15* or *Nintendo Switch OLED* to inspect `AT_OR_BELOW_TARGET` alerts & notifications (see [docs/us05-demo.md](docs/us05-demo.md)) |
| **US09** | P0 | Compare current prices for the exact same product variant across retailers (enforcing BR8 stock rules) | Landing (`/`) → **Sign in** → Watchlist (`/watchlist/`) → Click **Compare offers** on *Apple iPhone 15* (multi-source + BR8 out-of-stock) or *Canon EOS R50* (single offer) |

## Team

| Member | GitHub | Primary Responsibilities |
| :--- | :--- | :--- |
| Luong The Hieu | [@adcc17](https://github.com/adcc17) | End-to-end integration, US09 automated tests, documentation, release management & Sprint 1 / Sprint 5 Scrum Master |
| Pham Ba Viet | [@davvph](https://github.com/davvph) | Product Owner, shared backend validation, US02 automated tests, CI/CD pipeline & branch protection |
| Be Thanh Tien | [@Tienachilles](https://github.com/Tienachilles) | US02/US04/US09 backend & frontend flows, US03 automated tests, production data & cross-device verification, Sprint 3 Scrum Master |
| Le Huy Hoang | [@helian16](https://github.com/helian16) | System architecture, shared UI design system, US04 automated tests, cloud hosting & production DB configuration, Sprint 2 Scrum Master |
| Nguyen Huy Minh | [@minh7322](https://github.com/minh7322) | PostgreSQL schema & migrations, US03/US05 alert & notification engine, `/health` endpoint & production monitoring, Sprint 4 Scrum Master |

### Sprint roles

| Sprint | Product Owner | Scrum Master |
| :--- | :--- | :--- |
| Sprint 1 | Pham Ba Viet (`@davvph`) | Luong The Hieu (`@adcc17`) |
| Sprint 2 | Pham Ba Viet (`@davvph`) | Le Huy Hoang (`@helian16`) |
| Sprint 3 | Pham Ba Viet (`@davvph`) | Be Thanh Tien (`@Tienachilles`) |
| Sprint 4 | Pham Ba Viet (`@davvph`) | Nguyen Huy Minh (`@minh7322`) |
| Sprint 5 | Pham Ba Viet (`@davvph`) | Luong The Hieu (`@adcc17`) |

## Local setup & running the tests

Follow **[docs/SETUP.md](docs/SETUP.md)** to install Node.js 22+ and PostgreSQL, initialize the database (`npm run db:init`), and start PriceLens locally.

```bash
npm test                        # 72 acceptance tests across US01–US12 (no server or DB required)
npm --prefix frontend test      # 8 frontend unit tests
npm --prefix backend test       # 76 backend unit & PostgreSQL integration tests
```

## Tech stack & project structure

| Layer | Technology | Directory | Purpose |
| :--- | :--- | :--- | :--- |
| Backend & API | Node.js 22+, Express 5 | `backend/` | REST API, business rules, `/health` probe, DB migrations & seeds |
| Database | PostgreSQL 16/17 | `backend/src/database/` | 10-table schema, triggers, and deterministic demo data |
| Frontend | HTML, CSS, JS, Vite 8 | `frontend/` | Responsive browser UI for landing, watchlist, details, add & compare |
| Automated Tests | `node:test` | `tests/` | 72 acceptance tests for US01–US12 + unit/integration suites |
| Operations & Docs | GitHub Actions, Render | `docs/`, `scripts/` | Architecture, setup, testing, operations runbook & verification scripts |

## Documentation index

| Document | Contents |
| :--- | :--- |
| [Operations Runbook](docs/operations.md) | Production deployment, CI/CD pipeline, `/health` & monitoring, known risks, maintenance plan & lessons learned |
| [Requirements](docs/requirements.md) | Product vision, personas, user stories (US01–US12) and business rules (BR1–BR8) |
| [Design](docs/design.md) | Container architecture, PostgreSQL ERD, data dictionary and API contracts |
| [UI](docs/ui.md) | Screen inventory, wireframes, responsive breakpoints and cross-device verification |
| [Setup](docs/SETUP.md) | Step-by-step installation, database initialization and local run guide |
| [Testing](docs/testing.md) | Test strategy, test cases, boundary proofs and execution instructions |
| [P0 Acceptance](docs/p0-acceptance.md) | End-to-end verification of all 5 P0 stories and production sample data |
| [Traceability](docs/traceability.md) | Mapping from screens and business rules to issues, modules and tests |
| [Process](docs/process.md) & [DoD](docs/definition-of-done.md) | Team workflow, PR review rules and Definition of Done |
| [Sprint Log](docs/sprint-log.md) | Committed stories, completed work, velocity and retrospectives across Sprints 1–5 |
