# PriceLens Design Document

## 1. Architecture

### 1.1 Architectural Drivers

The PriceLens architecture is driven by the approved Milestone 1 requirements and the Milestone 2 requirement to demonstrate a database-backed walking skeleton. These drivers define the capabilities and constraints that materially affect the system structure.

| ID | Architectural driver | Requirement source | Architectural implication |
|---|---|---|---|
| *AD1* | PriceLens must provide browser-based access while protecting user-specific data. | Scenarios 1–3; Section 6 — Screens and Flow | A browser frontend and backend authentication boundary are required. Every protected operation must enforce record ownership. |
| *AD2* | A shopper must be able to track a supported product by URL without creating a duplicate watchlist record. | US04; BR6 | The backend must validate and normalise URLs, check per-user uniqueness and persist accepted tracking data. |
| *AD3* | Tracking and comparison must preserve the exact selected product variant. | US09; US11; BR5 | Products, variants, retailer offers and tracked records require explicit relationships. Comparison logic must exclude mismatched variants. |
| *AD4* | Price data must support current-price, history, freshness and availability results. | US02; US06; US10; US12; BR3; BR8 | The system must retain timestamped price observations and availability data and support time-based queries. |
| *AD5* | Price alerts must enforce fixed limits and generate non-repeating threshold notifications. | US03; US05; US07; BR1; BR2; BR4 | Alert validation and notification state require authoritative backend logic and persistent data. |
| *AD6* | Confirmed product removal must preserve database consistency. | US08; BR7 | The tracked product and its dependent alerts must be removed in one controlled operation. |
| *AD7* | PriceLens supports selected e-commerce sources rather than every marketplace. | Product Vision; US04 | Source-specific acquisition logic must be isolated behind adapters, and invalid source data must not become valid observations. |
| *AD8* | Business Rules must produce the same result for user requests and background processing. | BR1–BR8 | Shared domain logic must remain independent of screens, jobs and external adapters. |
| *AD9* | Sprint 2 must prove a real page-to-database path. | Milestone 2 walking-skeleton requirement | One browser route must call the backend, read at least 10 seeded database records and render the returned data. |
| *AD10* | Configuration and secrets must remain outside committed source code. | Milestone 2 setup requirements | Environment-specific values must be documented in .env.example; real credentials must not be committed. |

The primary architectural priorities are requirement traceability, data integrity, separation of responsibilities, testability and incremental delivery. The walking skeleton proves the selected structure without requiring implementation of every approved User Story.

### 1.2 System Boundary

PriceLens owns the browser frontend, backend API, background price processing and database. It authenticates existing shoppers, manages user-owned tracking data, stores supported price information and enforces BR1–BR8. It does not sell products, control retailer inventory or complete purchases.

#### 1.2.1 Responsibilities Inside the Boundary

| Responsibility area | PriceLens responsibility |
|---|---|
| *Access control* | Authenticate an existing shopper, protect user-only operations, enforce record ownership and terminate authenticated state on sign-out. |
| *Product tracking* | Validate and normalise supported URLs, prevent per-user duplicates and preserve the selected product variant. |
| *Price data* | Store valid observations and provide current-price, 30-day history, freshness, availability and CSV-export data. |
| *Comparison* | Compare only equivalent variants and identify the lowest matching in-stock offer. |
| *Alerts* | Validate target prices, enforce the active-alert limit, maintain alert state and record qualifying notification events. |
| *External coordination* | Obtain supported product data through source adapters and request email delivery through an email adapter. |
| *Persistence* | Store users, catalogue data, tracked products, observations, alerts and notification records in PostgreSQL. |

#### 1.2.2 External Actors and Systems

| External element | Responsibility outside PriceLens |
|---|---|
| *Shopper* | Signs in, tracks products, inspects price information, compares offers and manages alerts. |
| *Browser and user device* | Provide the runtime environment used to access the PriceLens frontend. |
| *Supported e-commerce sources* | Publish product, variant, price, availability and retailer-link data consumed by supported integrations. |
| *Email delivery service* | Delivers notification messages requested by PriceLens. |
| *Retailer website or checkout system* | Allows the shopper to inspect an offer and independently complete a purchase after leaving PriceLens. |

The frontend belongs to PriceLens even though it runs in the shopper's browser. The device, browser software, network, retailer systems and email infrastructure remain outside the system boundary.

#### 1.2.3 Authentication and Data Ownership

Guests may access only the landing and sign-in path. Watchlist, product, comparison and alert operations require authenticated state. User is the ownership root for tracked products; alerts and notifications inherit ownership through their parent records. Each protected backend operation must resolve the authenticated user and restrict its query or mutation to records owned by that user.

Sprint 2 requires minimum authentication for existing users and at least one demonstration account. Registration, password recovery, social sign-in, multi-factor authentication, profile management and administrator account management remain outside the current milestone.

#### 1.2.4 Scope Exclusions and Open Decisions

PriceLens does not process payments, delivery, returns or refunds; guarantee support for every source; control external prices or inventory; or define administrator behaviour not approved in Milestone 1.

The following implementation choices remain for the relevant Architecture Decision Records:

- Authentication mechanism, session representation and credential-storage library.
- Frontend and backend frameworks.
- Background-job triggering mechanism.
- Source-specific acquisition methods.
- Email provider and delivery protocol.
- Physical deployment arrangement for PostgreSQL and the application components.
### 1.3 Components and Responsibilities

PriceLens uses a client-server architecture with separate frontend and backend applications. The frontend communicates with the backend through documented HTTP interfaces and does not access the database or external-service credentials directly.

#### 1.3.1 Component Inventory

| ID | Component | Runtime and ownership | Primary responsibility | Interfaces |
|---|---|---|---|---|
| *C1* | Browser-Based Frontend | PriceLens; shopper's browser | Presents screens, collects input and renders backend results. | HTTP with C2; external navigation to C7. |
| *C2* | Backend API | PriceLens; server process | Authenticates users, enforces ownership and domain rules, handles interactive operations and returns API responses. | HTTP with C1; database operations with C4; source-adapter calls to C5. |
| *C3* | Background Price Processor | PriceLens; independent server process | Refreshes prices and availability, stores observations, evaluates active alerts and requests notification delivery. | Database operations with C4; source-adapter calls to C5; email-adapter calls to C6. |
| *C4* | PostgreSQL Database | PriceLens; persistent data store | Stores application records and applies the constraints defined in Section 2. | Database-driver operations from C2 and C3. |
| *C5* | Supported E-commerce Sources | External | Supply supported product, variant, price and availability data. | Source-specific exchanges with adapters used by C2 and C3. |
| *C6* | Email Delivery Service | External | Delivers price-drop messages and returns delivery outcomes. | Delivery requests from C3. |
| *C7* | Retailer Website or Checkout System | External | Allows independent inspection and purchase of an offer. | Navigation from C1 through a retailer URL. |

C1, C2 and C4 form the required walking-skeleton path. C3 belongs to the target architecture but is not required to execute in the minimum Sprint 2 slice.

#### 1.3.2 Backend Modules

| Module | Responsibility | Related requirements |
|---|---|---|
| *API and Request Handling* | Parse HTTP requests and map application outcomes to JSON, file responses and status codes. | Section 3; US12 |
| *Authentication and Access Control* | Resolve authenticated identity, protect operations and enforce ownership. | Scenarios 1–3; protected screens |
| *Product Tracking* | Search tracked products, normalise URLs, preserve variants and coordinate confirmed deletion. | US01, US04, US08, US11; BR5–BR7 |
| *Pricing and Comparison* | Query price history, derive freshness and compare eligible matching offers. | US02, US06, US09, US10, US12; BR3, BR5, BR8 |
| *Alert and Notification* | Validate alerts, enforce active-count limits and evaluate threshold state. | US03, US05, US07; BR1, BR2, BR4 |
| *Persistence and Adapters* | Provide database transactions and isolate source-specific or email-provider communication. | Section 2; supported external integrations |

Request handlers, jobs and adapters coordinate inputs and outputs but do not define Business Rules. C2 and C3 reuse the applicable domain and persistence modules without making direct runtime calls to each other.

#### 1.3.3 Dependency Rules

1. C1 communicates with C2 only through documented HTTP contracts.
2. C2 and C3 are the only components permitted to access C4.
3. C2 and C3 invoke shared domain and persistence modules rather than duplicating Business Rules.
4. C2 accesses C5 only for interactive product registration; C3 accesses C5 for recurring observations.
5. Only C3 submits notification-delivery requests to C6.
6. External systems cannot read or modify C4 directly.
7. Server-side ownership and Business Rules remain authoritative even when C1 performs equivalent validation.

### 1.4 Communication Flows

#### 1.4.1 Component Communication

| Source | Destination | Interface | Data transferred |
|---|---|---|---|
| Shopper | C1 | User-interface interaction | Credentials, URLs, variants, search terms, target prices and confirmations. |
| C1 | C2 | HTTP request | Authentication evidence and application commands or queries. |
| C2 | C1 | HTTP response | JSON data, structured errors or a CSV file. |
| C2 | C4 | PostgreSQL queries and transactions | Users, ownership, tracked products, offers, observations and alerts. |
| C2 | C5 | Source-adapter request and result | Normalised URL, product metadata and available variants. |
| C3 | C4 | PostgreSQL queries and transactions | Refresh candidates, observations, alert state and notification records. |
| C3 | C5 | Source-adapter request and result | Source identifier, exact variant, price, currency, availability and observation time. |
| C3 | C6 | Email-adapter request and result | Recipient, subject, notification content and delivery outcome. |
| C1 | C7 | HTTPS navigation | Selected retailer-offer URL. |

#### 1.4.2 Interactive Request Flow

1. C1 sends an HTTP request to C2 and includes authentication evidence for a protected operation.
2. C2 resolves the authenticated user and applies ownership restrictions.
3. C2 validates the request through the appropriate domain module.
4. When product metadata or variant discovery is required, C2 uses the matching C5 adapter.
5. C2 reads or updates C4 within the required transaction boundary.
6. C2 returns JSON, a structured error or a CSV response for C1 to present.

A malformed URL, unsupported source, per-user duplicate, missing required variant or failed source acquisition does not create a tracked-product record.

#### 1.4.3 Background Price and Notification Flow

1. C3 selects tracked offers requiring refresh and requests current data through the relevant C5 adapter.
2. C3 validates the returned variant, price, currency, availability and observation time.
3. C3 records a valid observation in C4; failed or malformed results do not replace successful price data.
4. C3 derives the current price from the latest valid in-stock observations for the matching variant and currency.
5. C3 evaluates active alerts against the previous and newly derived current prices and records any qualifying BR4 event.
6. C3 requests delivery from C6 and stores the delivery outcome without treating a failed delivery as successful.
### 1.5 Container Architecture Diagram

![PriceLens container architecture](images/architecture.png)

C1, C2, C3 and C4 are inside the PriceLens system boundary; C5, C6 and C7 are external. Every connector in the diagram identifies both its direction and the data or protocol that crosses the boundary. The diagram presents container-level structure, while Sections 1.3 and 1.4 define responsibilities and flows.

### 2.1 Logical Data Model

#### 2.1.1 Data Model Approach

PriceLens uses PostgreSQL because its data is structured, relational and governed by constraints that span users, products, variants, retailer offers and tracked records. The model separates shared catalogue data from user-owned data and retains time-based observations for price history and freshness calculations. Variable product-variant attributes may use JSONB, while identity, ownership, price, currency, availability and relationships remain relational columns.

The logical model contains nine entities. Each entity uses an entity-specific surrogate primary key, such as `user_id` or `product_id`, implemented as `BIGINT GENERATED ALWAYS AS IDENTITY`. Foreign keys use the same entity-based name as the primary key they reference. Detailed PostgreSQL types and physical constraints are defined in the data dictionary; the ERD and data dictionary must use the same entities, keys and multiplicities established here.

#### 2.1.2 Entity Inventory

| Entity | Purpose | Principal data |
|---|---|---|
| **User** (`users`) | Represents an authenticated PriceLens shopper and provides the ownership root for user-specific records. | Email, account state and account timestamps. |
| **Product** (`products`) | Represents the canonical identity shared by all variants of a product. | Canonical key, brand, model and display name. |
| **ProductVariant** (`product_variants`) | Represents one exact price-affecting configuration of a product. | Product reference, variant key, display label and variant attributes. |
| **Retailer** (`retailers`) | Represents a supported e-commerce source. | Source code, name, domain and activation state. |
| **RetailerOffer** (`retailer_offers`) | Represents one retailer listing for one exact product variant. | Retailer reference, variant reference, normalised URL, external listing identifier and refresh metadata. |
| **TrackedProduct** (`tracked_products`) | Represents a user's decision to track an exact product variant from a submitted source URL. | User reference, variant reference, retailer-offer reference, normalised source URL, tracking state and creation time. |
| **PriceObservation** (`price_observations`) | Represents one immutable successful observation of an offer at a specific time. | Offer reference, positive price, ISO currency code, availability state and observation time. |
| **PriceAlert** (`price_alerts`) | Represents a target-price condition attached to a tracked product. | Tracked-product reference, target price, currency, lifecycle status, threshold state and last-evaluated observation reference. |
| **Notification** (`notifications`) | Represents the recorded outcome of one qualifying alert event. | Alert reference, triggering-observation reference, recipient and subject snapshots, delivery state and delivery timestamps. |

`RetailerOffer` records the source listing and refresh-attempt metadata. `PriceObservation` records successful time-dependent results and may have an availability state of `IN_STOCK` or `OUT_OF_STOCK`. Malformed responses and failed acquisition attempts are not stored as valid price observations.

#### 2.1.3 Relationships and Cardinalities

| Parent entity | Child entity | Multiplicity | Meaning |
|---|---|---|---|
| User | TrackedProduct | 1 : 0..N | A user may track no products or many products; every tracked product belongs to exactly one user. |
| Product | ProductVariant | 1 : 1..N | A persisted product has one or more exact variants; every variant belongs to exactly one product. |
| ProductVariant | RetailerOffer | 1 : 0..N | A variant may have no supported retailer offers or many; every offer identifies exactly one variant. |
| Retailer | RetailerOffer | 1 : 0..N | A retailer may publish many supported offers; every offer belongs to exactly one retailer. |
| ProductVariant | TrackedProduct | 1 : 0..N | The same variant may be tracked by multiple users; every tracked product identifies exactly one variant. |
| RetailerOffer | TrackedProduct | 1 : 0..N | An offer may be the submitted source of multiple users' tracked products; every tracked product references exactly one retailer offer. |
| RetailerOffer | PriceObservation | 1 : 0..N | An offer may accumulate observations over time; every observation belongs to exactly one offer. |
| TrackedProduct | PriceAlert | 1 : 0..N | A tracked product may have no alerts or many alerts; every alert belongs to exactly one tracked product. |
| PriceObservation | PriceAlert | 1 : 0..N | An observation may support the latest evaluation of multiple alerts; every persisted alert references exactly one last-evaluated observation. |
| PriceAlert | Notification | 1 : 0..N | An alert may produce no notifications or multiple notifications across separate threshold crossings; every notification belongs to exactly one alert. |
| PriceObservation | Notification | 1 : 0..N | An observation may trigger multiple users' alerts; every notification records exactly one triggering observation. |

The `PriceObservation`–`PriceAlert` relationship represents the observation used for the alert's most recent price evaluation. Because BR2 requires a current valid price when an alert is created, every persisted alert references exactly one price observation; therefore, `price_alerts.price_observation_id` is not nullable. This relationship does not require every observation to be associated with an alert: one observation may support no alerts or multiple alerts.

#### 2.1.4 Ownership and Integrity

All user-specific access begins with the authenticated `User`. `TrackedProduct.user_id` establishes direct ownership. Alert ownership follows `PriceAlert → TrackedProduct → User`, and notification ownership follows `Notification → PriceAlert → TrackedProduct → User`. Every protected query and mutation must include this ownership path; possession of a record identifier alone does not grant access.

| Data constraint | Purpose and requirement alignment |
|---|---|
| `UNIQUE (users.email)` | Preserves one account identity per email address. |
| `UNIQUE (products.canonical_key)` | Prevents duplicate canonical products. |
| `UNIQUE (product_variants.product_id, product_variants.variant_key)` | Prevents duplicate variants within the same product. |
| `UNIQUE (retailer_offers.retailer_id, retailer_offers.product_variant_id, retailer_offers.normalized_url)` | Prevents duplicate retailer listings for the same exact variant and URL. |
| `UNIQUE (tracked_products.user_id, tracked_products.normalized_source_url)` | Enforces per-user normalised-URL uniqueness under BR6. |
| `UNIQUE (price_observations.retailer_offer_id, price_observations.observed_at)` | Prevents duplicate observations for the same offer and observation time. |
| `CHECK (price_observations.price_amount > 0)` | Prevents invalid non-positive prices from becoming valid observations. |
| `CHECK (price_alerts.target_price > 0)` | Provides row-level support for BR2. The requirement that the target is lower than the derived current price is enforced by backend domain logic because it depends on other records. |
| `UNIQUE (notifications.price_alert_id, notifications.price_observation_id)` | Prevents the same alert and triggering observation from producing duplicate notification records under BR4. |

The following cross-table invariants must also hold:

- A tracked product's referenced retailer offer must identify the same product variant as the tracked product.
- An alert's referenced price observation must belong to an offer for the tracked product's exact variant and use the alert's currency.
- A notification's referenced price observation must be valid for the exact variant and currency of its parent alert and represent the qualifying threshold crossing.
- The number of `ACTIVE` alerts owned by one user must not exceed 20 under BR1.

The variant and currency invariants support BR5. They are enforced by backend domain logic and reinforced by composite database constraints where the physical schema permits. The BR1 limit spans multiple rows and is enforced atomically in the owning user's transaction rather than by a single-row `CHECK` constraint.

#### 2.1.5 Derived Data

The following values are derived from persisted records rather than duplicated as independently editable columns:

| Derived value | Definition |
|---|---|
| **Current price** | The lowest price among the latest valid `IN_STOCK` observations for offers matching the exact product variant and currency. |
| **Lowest available offer** | The retailer offer that supplies the derived current price. An `OUT_OF_STOCK` observation is retained but is not eligible under BR8. |
| **Daily price-history value** | The lowest valid in-stock price recorded for the exact variant and currency on one calendar day. The chart and CSV export use the same definition. |
| **Stale status** | The displayed price is stale when the supporting observation is at least 24 hours old. Failed refresh attempts do not change `PriceObservation.observed_at` or reset the BR3 period. |
| **Active-alert count** | The number of the user's `PriceAlert` records whose status is `ACTIVE`; inactive and expired records are excluded under BR1. |

`price_alerts.last_threshold_state` stores either `ABOVE_TARGET` or `AT_OR_BELOW_TARGET`, and `price_alerts.price_observation_id` references the observation supporting the latest evaluation. Together with the unique notification constraint, these fields provide the persistent state required by BR4 without adding a separate alert-event entity. If no eligible in-stock observation exists, no current price is derived and no new alert can satisfy BR2.

#### 2.1.6 Record Lifecycle

Shared catalogue entities (`Product`, `ProductVariant`, `Retailer` and `RetailerOffer`) are retained or deactivated rather than deleted while dependent records exist. `PriceObservation` records are immutable and retained because they support history, freshness, alert evaluation and notification evidence.

After the user confirms deletion, `TrackedProduct` and its dependent records are removed in one controlled transaction. Deleting a tracked product cascades to its `PriceAlert` records, and deleting those alerts cascades to their `Notification` records, enforcing BR7. The operation does not delete the shared product, variant, retailer, offer or observation records. Cancelling the confirmation performs no database mutation. Because the tracked-product record is removed, its per-user normalised URL no longer occupies the BR6 unique constraint and may be tracked again later.
