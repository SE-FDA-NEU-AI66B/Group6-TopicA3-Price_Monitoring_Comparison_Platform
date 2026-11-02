# PriceLens

PriceLens helps online shoppers follow the price of a product across several
stores. It records price history, compares current offers for the exact same
product variant and sends an email when the price drops to a target the user
has set.

Group 6 · Topic A3: Price Monitoring and Comparison Platform

## Features

The five P0 user stories are implemented, tested and available in the demo.

| Story | What the user can do | Where to find it after signing in |
|---|---|---|
| US02 | See a product's price history for the last 30 days | Watchlist → **View** a product |
| US03 | Create a price alert with a target price | Watchlist → **View** → **Create price alert** |
| US04 | Add a product to the watchlist from its store URL | Watchlist → **Add product** |
| US05 | Receive an email when the price reaches the target | Create an alert, then follow [docs/us05-demo.md](docs/us05-demo.md) |
| US09 | Compare prices for the same variant across stores | Watchlist → **View** → **Compare offers** |

## Getting started

Follow **[docs/SETUP.md](docs/SETUP.md)**. One setup script installs Node.js
and PostgreSQL, creates the database with demo data and builds the website,
so a computer with nothing installed can run PriceLens in about 15 minutes.

After setup, open `http://localhost:4173/` and sign in with the demo account:

| Email | Password |
|---|---|
| `demo@pricelens.local` | `PriceLensDemo2026!` |

## Running the tests

```bash
npm test
```

30 automated tests, six for each P0 story, run in under a second without a
server or a database. [docs/testing.md](docs/testing.md) lists every test case
and explains what is tested and why.

## Tech stack

| Part | Technology |
|---|---|
| Backend | Node.js 22+, Express 5 |
| Database | PostgreSQL 17 |
| Frontend | HTML, CSS and JavaScript, built with Vite |
| Tests | Node.js built-in test runner (`node:test`) |

## Project structure

```text
backend/    API server, business rules, database setup and demo data
frontend/   Web pages, styles and browser code
tests/      Automated tests for the P0 stories
scripts/    One-command setup for Windows, macOS and Ubuntu
docs/       Requirements, design, setup, testing and sprint records
```

## Documentation

| Document | Contents |
|---|---|
| [Requirements](docs/requirements.md) | Product vision, personas, user stories and business rules |
| [Design](docs/design.md) | Architecture, data model and API contracts |
| [UI](docs/ui.md) | Screens and wireframes for the P0 stories |
| [Setup](docs/SETUP.md) | Install, run and test PriceLens on a new computer |
| [Testing](docs/testing.md) | Test strategy, test cases and results |
| [P0 acceptance](docs/p0-acceptance.md) | Manual check of every P0 acceptance criterion |
| [Traceability](docs/traceability.md) | Links from each screen and business rule to the issue and code that implement it |
| [Process](docs/process.md) | Development process and team practices |
| [Definition of Done](docs/definition-of-done.md) | When a story counts as finished |
| [Sprint log](docs/sprint-log.md) | Goals, results and velocity of every sprint |

## Team

| Name | GitHub |
|---|---|
| Luong The Hieu | [@adcc17](https://github.com/adcc17) |
| Pham Ba Viet | [@davvph](https://github.com/davvph) |
| Be Thanh Tien | [@Tienachilles](https://github.com/Tienachilles) |
| Le Huy Hoang | [@helian16](https://github.com/helian16) |
| Nguyen Huy Minh | [@minh7322](https://github.com/minh7322) |

## Sprint roles

The Scrum Master changes every sprint.

| Sprint | Product Owner | Scrum Master |
|---|---|---|
| Sprint 1 | Pham Ba Viet (`@davvph`) | Luong The Hieu (`@adcc17`) |
| Sprint 2 | Pham Ba Viet (`@davvph`) | Le Huy Hoang (`@helian16`) |
| Sprint 3 | Pham Ba Viet (`@davvph`) | Be Thanh Tien (`@Tienachilles`) |
| Sprint 4 | Pham Ba Viet (`@davvph`) | Nguyen Huy Minh (`@minh7322`) |
