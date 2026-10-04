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

### 2.2 ERD and Data Dictionary

#### 2.2.1 Entity-Relationship Diagram

![PriceLens entity-relationship diagram](images/erd.png)

The ERD presents the nine PriceLens tables, their primary and foreign keys, and the multiplicity of every relationship. Shared catalogue and observation tables are separated from user-owned tracking, alert and notification tables. The entity names, keys and relationships shown in the diagram must match the data dictionary below.


#### 2.2.2 Table Purposes

| Table | Purpose |
|---|---|
| `users` | Stores authenticated shopper accounts and provides the ownership root for user-specific PriceLens data. |
| `products` | Stores canonical product identity shared by all variants. |
| `product_variants` | Stores exact product configurations whose price-affecting attributes must remain distinct. |
| `retailers` | Stores supported e-commerce sources. |
| `retailer_offers` | Stores retailer listings that connect one retailer URL to one exact product variant. |
| `tracked_products` | Stores the exact product variant and normalised source URL tracked by a user. |
| `price_observations` | Stores immutable successful price and availability observations over time. |
| `price_alerts` | Stores user-defined target prices and the persisted state required to evaluate them. |
| `notifications` | Stores qualifying alert-notification records and their delivery outcomes. |

#### 2.2.3 Data Dictionary

Each table uses an entity-specific primary key implemented as `BIGINT GENERATED ALWAYS AS IDENTITY`. Foreign keys use the same entity-based name as the referenced primary key. All timestamps use `TIMESTAMPTZ` so that observations and delivery times remain unambiguous across environments.

##### `users`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `user_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal user identifier. |
| `email` | `VARCHAR(254)` | No | UQ | Normalised account email and notification address. |
| `password_hash` | `TEXT` | No | — | Secure hash used to verify the existing demonstration account. |
| `display_name` | `VARCHAR(120)` | No | — | Shopper name displayed by the application. |
| `account_status` | `VARCHAR(20)` | No | — | Account state, limited to `ACTIVE` or `DISABLED`. |
| `created_at` | `TIMESTAMPTZ` | No | — | Account creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | — | Most recent account update time. |

##### `products`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `product_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal product identifier. |
| `canonical_key` | `VARCHAR(200)` | No | UQ | Stable canonical identity used to prevent duplicate products. |
| `brand` | `VARCHAR(120)` | No | — | Product brand. |
| `model` | `VARCHAR(160)` | No | — | Product model. |
| `display_name` | `VARCHAR(255)` | No | — | Human-readable product name. |
| `created_at` | `TIMESTAMPTZ` | No | — | Record creation time. |

##### `product_variants`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `product_variant_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal variant identifier. |
| `product_id` | `BIGINT` | No | FK → `products.product_id` | Canonical product to which the variant belongs. |
| `variant_key` | `VARCHAR(200)` | No | UQ with `product_id` | Stable identity within the parent product. |
| `display_name` | `VARCHAR(255)` | No | — | Human-readable exact variant, such as `iPhone 15 — 256 GB`. |
| `attributes` | `JSONB` | No | — | Price-affecting attributes such as capacity, size, colour or specification. |
| `created_at` | `TIMESTAMPTZ` | No | — | Record creation time. |

##### `retailers`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `retailer_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal retailer identifier. |
| `source_code` | `VARCHAR(50)` | No | UQ | Stable code used to select a source adapter. |
| `name` | `VARCHAR(120)` | No | — | Retailer display name. |
| `domain` | `VARCHAR(255)` | No | UQ | Supported retailer domain. |
| `is_active` | `BOOLEAN` | No | — | Whether the source is currently supported. |
| `created_at` | `TIMESTAMPTZ` | No | — | Record creation time. |

##### `retailer_offers`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `retailer_offer_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal retailer-offer identifier. |
| `retailer_id` | `BIGINT` | No | FK → `retailers.retailer_id` | Retailer publishing the offer. |
| `product_variant_id` | `BIGINT` | No | FK → `product_variants.product_variant_id` | Exact variant represented by the offer. |
| `normalized_url` | `TEXT` | No | UQ with retailer and variant | Canonical offer URL after tracking parameters are removed. |
| `external_offer_id` | `VARCHAR(200)` | Yes | — | Source-specific listing identifier when available. |
| `last_refresh_attempt_at` | `TIMESTAMPTZ` | Yes | — | Most recent acquisition attempt, successful or failed. |
| `last_refresh_status` | `VARCHAR(20)` | Yes | — | Latest attempt result: `SUCCEEDED` or `FAILED`. |
| `last_refresh_error` | `TEXT` | Yes | — | Diagnostic summary for the latest failed attempt. |
| `created_at` | `TIMESTAMPTZ` | No | — | Record creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | — | Most recent offer-metadata update time. |

##### `tracked_products`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `tracked_product_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal tracked-product identifier. |
| `user_id` | `BIGINT` | No | FK → `users.user_id` | User who owns the watchlist record. |
| `product_variant_id` | `BIGINT` | No | FK → `product_variants.product_variant_id` | Exact variant selected by the user. |
| `retailer_offer_id` | `BIGINT` | No | FK → `retailer_offers.retailer_offer_id` | Retailer offer corresponding to the submitted source URL. |
| `normalized_source_url` | `TEXT` | No | UQ with `user_id` | Normalised URL used for per-user duplicate detection. |
| `tracking_status` | `VARCHAR(20)` | No | — | Current tracking state; initially `TRACKING`. |
| `created_at` | `TIMESTAMPTZ` | No | — | Time at which tracking began. |
| `updated_at` | `TIMESTAMPTZ` | No | — | Most recent tracked-record update time. |

The pair `(retailer_offer_id, product_variant_id)` must identify an offer for the same product variant. This invariant prevents the submitted source URL from referring to a different variant from the one selected by the user.

##### `price_observations`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `price_observation_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal observation identifier. |
| `retailer_offer_id` | `BIGINT` | No | FK → `retailer_offers.retailer_offer_id` | Offer observed by the source adapter. |
| `price_amount` | `NUMERIC(14,2)` | No | — | Positive observed price. |
| `currency_code` | `VARCHAR(3)` | No | — | ISO 4217 currency code, such as `VND`. |
| `availability_status` | `VARCHAR(20)` | No | — | Availability at observation time: `IN_STOCK` or `OUT_OF_STOCK`. |
| `observed_at` | `TIMESTAMPTZ` | No | UQ with `retailer_offer_id` | Time represented by the source observation. |
| `created_at` | `TIMESTAMPTZ` | No | — | Time at which PriceLens persisted the observation. |

Only successful, structurally valid source results create rows in `price_observations`. A failed refresh remains represented by the refresh metadata in `retailer_offers` and does not change the most recent successful observation time.

##### `price_alerts`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `price_alert_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal alert identifier. |
| `tracked_product_id` | `BIGINT` | No | FK → `tracked_products.tracked_product_id` | User-owned tracked product to which the alert applies. |
| `target_price` | `NUMERIC(14,2)` | No | — | Positive target price accepted under BR2. |
| `currency_code` | `VARCHAR(3)` | No | — | Currency used by the target and evaluated observation. |
| `status` | `VARCHAR(20)` | No | — | Lifecycle state: `ACTIVE`, `INACTIVE` or `EXPIRED`. |
| `last_threshold_state` | `VARCHAR(30)` | No | — | Latest evaluated state: `ABOVE_TARGET` or `AT_OR_BELOW_TARGET`. |
| `price_observation_id` | `BIGINT` | No | FK → `price_observations.price_observation_id` | Observation supporting the latest threshold evaluation. |
| `last_evaluated_at` | `TIMESTAMPTZ` | No | — | Time of the latest threshold evaluation. |
| `created_at` | `TIMESTAMPTZ` | No | — | Alert creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | — | Most recent alert update time. |

The referenced price observation must belong to an offer for the tracked product's exact variant and use the alert's currency.

##### `notifications`

| Column | PostgreSQL type | Null | Key | Description |
|---|---|:---:|---|---|
| `notification_id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | No | PK | Internal notification identifier. |
| `price_alert_id` | `BIGINT` | No | FK → `price_alerts.price_alert_id` | Alert that produced the notification. |
| `price_observation_id` | `BIGINT` | No | FK → `price_observations.price_observation_id` | Observation that caused the qualifying threshold crossing. |
| `recipient_email` | `VARCHAR(254)` | No | — | Recipient snapshot used for this delivery request. |
| `subject` | `VARCHAR(255)` | No | — | Email-subject snapshot. |
| `delivery_status` | `VARCHAR(20)` | No | — | Delivery state: `PENDING`, `SENT` or `FAILED`. |
| `qualified_at` | `TIMESTAMPTZ` | No | — | Time at which the threshold crossing qualified. |
| `sent_at` | `TIMESTAMPTZ` | Yes | — | Successful delivery-request time. |
| `provider_message_id` | `VARCHAR(255)` | Yes | — | Identifier returned by the email provider. |
| `failure_reason` | `TEXT` | Yes | — | Failure summary when delivery is unsuccessful. |
| `created_at` | `TIMESTAMPTZ` | No | — | Notification-record creation time. |

#### 2.2.4 Relationships and Delete Actions

| Foreign key | Parent relationship | Delete action | Rationale |
|---|---|---|---|
| `product_variants.product_id` | Product 1 → 1..N ProductVariant | `RESTRICT` | Prevents removal of a product while variants exist. |
| `retailer_offers.retailer_id` | Retailer 1 → 0..N RetailerOffer | `RESTRICT` | Preserves source identity for existing offers. |
| `retailer_offers.product_variant_id` | ProductVariant 1 → 0..N RetailerOffer | `RESTRICT` | Preserves exact-variant identity. |
| `tracked_products.user_id` | User 1 → 0..N TrackedProduct | `RESTRICT` | Account deletion is outside the current scope. |
| `tracked_products.product_variant_id` | ProductVariant 1 → 0..N TrackedProduct | `RESTRICT` | Prevents deletion of a tracked variant. |
| `tracked_products.retailer_offer_id` | RetailerOffer 1 → 0..N TrackedProduct | `RESTRICT` | Preserves the submitted source reference. |
| `price_observations.retailer_offer_id` | RetailerOffer 1 → 0..N PriceObservation | `RESTRICT` | Retains observation history. |
| `price_alerts.tracked_product_id` | TrackedProduct 1 → 0..N PriceAlert | `CASCADE` | Removes dependent alerts after confirmed tracked-product deletion under BR7. |
| `price_alerts.price_observation_id` | PriceObservation 1 → 0..N PriceAlert | `RESTRICT` | Preserves the observation supporting the latest alert evaluation. |
| `notifications.price_alert_id` | PriceAlert 1 → 0..N Notification | `CASCADE` | Removes dependent notification records with a deleted alert. |
| `notifications.price_observation_id` | PriceObservation 1 → 0..N Notification | `RESTRICT` | Preserves the observation that triggered the notification. |

#### 2.2.5 Constraints and Business-Rule Alignment

| Constraint | Enforcement | M1 rule |
|---|---|---|
| At most 20 `ACTIVE` alerts per user | Backend transaction locks the owning user, counts active alerts and rejects an operation that would exceed 20. | BR1 |
| `price_alerts.target_price > 0` | Database `CHECK`. | BR2 |
| Target price is lower than the eligible current price in the same currency | Backend transaction validates the derived price before inserting the alert. | BR2 |
| Stale status begins when the supporting successful observation is at least 24 hours old | Derived from `price_observations.observed_at`; failed refresh attempts do not reset it. | BR3 |
| One notification per alert and triggering observation | `UNIQUE (price_alert_id, price_observation_id)` together with persisted `last_threshold_state`. | BR4 |
| Tracked record, offer, observation and alert use the same exact variant and currency | Foreign keys, the composite origin-offer relationship and backend cross-table validation. | BR5 |
| One watchlist record per user and normalised URL | `UNIQUE (user_id, normalized_source_url)`. | BR6 |
| Confirmed tracked-product deletion removes dependent alerts | `ON DELETE CASCADE` from `tracked_products` to `price_alerts`, then to `notifications`; the backend performs deletion only after confirmation. | BR7 |
| Out-of-stock observations cannot become the lowest available offer | `availability_status` is constrained to `IN_STOCK` or `OUT_OF_STOCK`; lowest-offer queries filter to `IN_STOCK`. | BR8 |

### 2.3 Database Schema Implementation and Rule-Related Constraints

#### 2.3.1 Physical Schema Implementation

The physical schema is implemented as the versioned raw-SQL migration `database/migrations/001_initial_schema.sql`. PostgreSQL and raw SQL are team implementation choices; the migration translates the nine-table model from Sections 2.1–2.2 without redefining it. All statements run in one transaction so a failure cannot leave a partial schema. Deterministic demonstration data is maintained separately in `database/seeds/001_demo_data.sql`.

The migration uses the approved table, column, key and data-type definitions from the Data Dictionary. Valid creation states default to `ACTIVE` for users and alerts, `TRACKING` for tracked products, `ABOVE_TARGET` for new alerts and `PENDING` for notifications. A shared `BEFORE UPDATE` trigger maintains `updated_at` on mutable tables for both API and background-process writes.

#### 2.3.2 Constraints and Business-Rule Enforcement

PostgreSQL enforces row-local integrity and directly representable relationships. Rules that depend on multiple rows, derived prices or user confirmation remain transactional backend logic.

| Rule or invariant | Database enforcement | Backend enforcement |
|---|---|---|
| Account and catalogue integrity | Canonical lowercase email with `UNIQUE (email)`; unique product, variant and retailer-listing keys; nonblank required text; JSONB variant attributes must be objects | Normalise email and catalogue inputs before insertion |
| BR1 — Maximum 20 active alerts | Approved alert states and indexes supporting alert lookup | Lock the owning user, count owned `ACTIVE` alerts and reject creation or reactivation of a 21st alert |
| BR2 — Valid target price | `target_price > 0`, uppercase currency code and FK to a supporting observation | In one transaction, require the target to be below the current valid in-stock price for the same variant and currency |
| BR3 — Stale after 24 hours | Store immutable successful observations with `observed_at`; failed refreshes remain offer metadata | Mark data stale when the supporting observation is at least 24 hours old |
| BR4 — One notification per crossing | Approved threshold states and `UNIQUE (price_alert_id, price_observation_id)` | Lock the alert, detect the threshold transition, update its state and create at most one notification in the same transaction |
| BR5 — Exact variant matching | Composite FK ensures a tracked product's `retailer_offer_id` and `product_variant_id` refer to the same offer-variant pair | Accept observations and comparison offers only for the exact variant and currency |
| BR6 — One normalised URL per user | `UNIQUE (user_id, normalized_source_url)` | Remove approved tracking parameters and normalise the URL before insertion |
| BR7 — Confirmed deletion | `ON DELETE CASCADE` from tracked products to alerts and then notifications | Verify ownership and confirmation before deleting the tracked product |
| BR8 — Lowest available offer | Availability is restricted to `IN_STOCK` or `OUT_OF_STOCK` | Exclude out-of-stock observations when deriving the lowest available offer |

Additional checks keep refresh and notification metadata consistent with their states. `tracking_status` is currently restricted to the only approved value, `TRACKING`; future lifecycle states require a reviewed migration instead of accepting arbitrary text.

#### 2.3.3 Record Lifecycle and Delete Behaviour

Shared catalogue and price-history rows use `ON DELETE RESTRICT` while referenced. Price observations are append-only in normal application operation. User-owned records follow the BR7 path:

```text
tracked_products
        └── ON DELETE CASCADE → price_alerts
                                      └── ON DELETE CASCADE → notifications
```

Deleting a tracked product therefore removes only its alerts and notifications. Products, variants, retailers, offers and observations remain. Physical user deletion is outside the current milestone, so `tracked_products.user_id` also uses `ON DELETE RESTRICT`.

#### 2.3.4 Indexing Strategy

Primary-key and `UNIQUE` constraints already create indexes. Seven additional indexes cover the approved query paths without duplicating them:

| Query path | Indexes |
|---|---|
| Exact-variant offers | `idx_retailer_offers_variant_retailer` |
| Authenticated watchlist and affected tracked products | `idx_tracked_products_user_status_created`, `idx_tracked_products_product_variant` |
| Alert lookup and evaluation | `idx_price_alerts_tracked_product_status`, `idx_price_alerts_price_observation` |
| Notification history and evidence | `idx_notifications_alert_created`, `idx_notifications_price_observation` |

The unique index on `(retailer_offer_id, observed_at)` also supports offer history and latest-observation queries. Further indexes should be added only when later API queries demonstrate a need.

#### 2.3.5 Validation

The migration must run on an empty PostgreSQL database with stop-on-error enabled. Positive and negative tests must confirm that:

- all nine tables, keys and relationships match the ERD and Data Dictionary;
- duplicate canonical values, invalid prices, invalid states and mismatched offer-variant references are rejected;
- `updated_at` triggers and BR7 cascade behaviour work as specified;
- shared catalogue and observation rows remain after a tracked product is deleted.
