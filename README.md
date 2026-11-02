# PriceLens

PriceLens is a price monitoring and comparison application. Sprint 3 covers five P0 stories backed by PostgreSQL.

## Where to start each P0 story

Sign in at `http://localhost:4173/`, then use the normal page links shown below. The setup guide includes the local test account.

| Story | Starts from | User action |
|---|---|---|
| US02: View product price history | Watchlist → Product Details | Select **View** on a tracked product and review its 30-day history. |
| US03: Create a price alert | Watchlist → Product Details | Select **View**, enter a target below the current price, then select **Create price alert**. |
| US04: Add a product using its URL | Watchlist → Add Product | Select **Add product**, resolve a supported URL, choose the exact variant, then add it. |
| US05: Receive a price-drop notification | Watchlist → Product Details → Create Alert | Create an active alert, then follow the documented background and email demo. |
| US09: Compare prices across retailers | Watchlist → Product Details → Compare | Select **View**, then **Compare offers**. |

## Run the application

Follow [docs/SETUP.md](docs/SETUP.md) from top to bottom. It covers prerequisites, local configuration, database initialization, startup, the demo account, P0 checks and the optional US05 notification flow.

Supporting records:

- [P0 UI and wireframes](docs/ui.md)
- [P0 acceptance evidence](docs/p0-acceptance.md)
- [US05 notification demo](docs/us05-demo.md)

## Sprint 3 roles

| Role | Member |
|---|---|
| Product Owner | Pham Ba Viet (`@davvph`) |
| Scrum Master | Be Thanh Tien (`@Tienachilles`) |

The Sprint 3 Scrum Master differs from Sprint 1 (`@adcc17`) and Sprint 2 (`@helian16`).

## Team

| Name | GitHub username |
|---|---|
| Luong The Hieu | `@adcc17` |
| Pham Ba Viet | `@davvph` |
| Be Thanh Tien | `@Tienachilles` |
| Le Huy Hoang | `@helian16` |
| Nguyen Huy Minh | `@minh7322` |

## Repository documents

- [Requirements](docs/requirements.md)
- [Design](docs/design.md)
- [Setup](docs/SETUP.md)
- [Sprint log](docs/sprint-log.md)
