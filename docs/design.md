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