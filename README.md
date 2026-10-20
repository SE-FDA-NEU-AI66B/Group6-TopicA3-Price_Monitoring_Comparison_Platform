# Price Monitoring Comparison Platform
## Role Assignment

| Name | GitHub username | Role |
| --- | --- | --- |
| Luong The Hieu | adcc17 | Scrum Master |
| Pham Ba Viet | davvph | Product Owner |
| Be Thanh Tien | Tienachilles | Member |
| Le Huy Hoang | helian16 | Member |
| Nguyen Huy Minh | minh7322 | Member |



Dưới đây là toàn bộ nội dung Pull Request của bạn đã được chuyển sang định dạng Markdown chuẩn của GitHub (bao gồm đầy đủ các khối code highlight, bảng biểu, danh sách, thứ tự thực thi và checkbox kiểm thử):

```markdown
## Summary

Completes **Issue #148** by providing and verifying a reproducible end-to-end **US05** price-drop notification demonstration.

The demonstrated flow starts from the real Product Details interface and continues through the actual PriceLens background-processing pipeline:

$$\text{Product Details} \longrightarrow \text{API-05 alert creation} \longrightarrow \text{BG-01 observation persistence} \longrightarrow \text{BG-02 BR4 evaluation} \longrightarrow \text{PENDING notification} \longrightarrow \text{BG-03 delivery} \longrightarrow \text{JSONL email evidence}$$

The flow verifies all US05 acceptance criteria without Postman, hidden browser APIs, manual notification inserts, or direct database state mutation.

### Core Deliverables Verified:
- Alert creation through the real Product Details UI
- Deterministic background price updates
- First above-to-below threshold crossing
- Exactly one notification for the first crossing
- Observable email delivery
- No repeated notification while the price remains below target
- Above-target threshold reset
- One later notification after a new downward crossing
- Exact notification subject
- Delivery within the five-minute requirement
- Reproducible Windows/PowerShell instructions
- Cross-platform equivalent commands
- Fresh-environment reset and cleanup behavior

*(This PR does not introduce new US05 business rules, frontend screens, public test endpoints, production scraping, production email infrastructure, or scheduler behavior.)*

---

## Demo Fixture

The demonstration uses the existing deterministic PriceLens fixture:

| Attribute | Value |
| :--- | :--- |
| **User** | `demo@pricelens.local` |
| **Product** | `Dell XPS 13 9340` |
| **Variant** | `16gb-512gb-silver` |
| **Normalized URL** | `https://techmart.example/dell-xps-13-9340-16-512-silver` |
| **Initial Current Price** | `34,990,000 VND` |
| **Alert Target** | `14,000,000 VND` |

### Expected Demonstration Sequence

```text
Price Progression:
34,990,000 VND → 13,900,000 VND → 13,800,000 VND → 14,200,000 VND → 14,000,000 VND

Threshold State Transitions:
ABOVE_TARGET → AT_OR_BELOW_TARGET → AT_OR_BELOW_TARGET → ABOVE_TARGET → AT_OR_BELOW_TARGET

Expected Cumulative Notification Count:
0 → 1 → 1 → 1 → 2

```

---

## What Changed & Flow Execution

### 1. Browser Alert Creation

The primary demo path begins through the real PriceLens UI:

1. Sign in using the deterministic demo account.
2. Open the **Dell XPS 13** tracked product from Watchlist $\rightarrow$ Product Details.
3. Enter `14,000,000 VND` as the alert target.
4. Select **Create price alert**.

**Verified UI Result:**

* **Product:** Dell XPS 13 9340
* **Variant:** XPS 13 16GB/512GB Silver
* **Current price:** 34,990,000 VND
* **Target:** 14,000,000 VND
* **Status:** Active
* **Confirmation:** Price alert created

### 2. Internal Price-Processing Command

Issue #148 adds a minimal internal command wrapper for the existing #146 processor:

```bash
npm run prices:process -- --url=<normalized-url> --amount=<decimal> --currency=VND --availability=IN_STOCK --observed-at=now

```

* Resolves the retailer offer through its normalized URL.
* Builds the existing acquisition-result contract and invokes `processPriceObservation()`.
* Does not duplicate BR4 logic or expose any public HTTP endpoint (no `/api/test` or `/api/process`).

### 3. Step-by-Step Flow Execution & Verification

#### Step 1: First Qualifying Crossing (`34.99M` $\rightarrow$ `13.9M VND`)

* **Action:** Process price `13,900,000 VND` (Target: `14,000,000 VND`).
* **Processor Result:** `PROCESSED`, `notificationCount: 1`.
* **State Transition:** `ABOVE_TARGET` $\rightarrow$ `AT_OR_BELOW_TARGET`.
* **Delivery Execution:** Run `npm run notifications:deliver -- --limit=10`.
* **Delivery Verification:**
* Status updated: `PENDING` $\rightarrow$ `SENT`.
* `sent_at` & `provider_message_id` populated.
* JSONL outbox records 1 ACCEPTED email.
* **Exact Subject:** `Price Drop Alert: Dell XPS 13 9340` (No prefix/suffix).
* **Latency Evidence:** `qualified_at: 15:44:01.917Z`, `sent_at: 15:44:09.370Z` ($\approx 7.45 \text{ seconds}$, well within the 5-minute requirement).



#### Step 2: Repeated-Below Verification (`13.9M` $\rightarrow$ `13.8M VND`)

* **Action:** Process price `13,800,000 VND` (Target: `14,000,000 VND`).
* **Processor Result:** `PROCESSED`, `notificationCount: 0`.
* **Verification:** Threshold remains `AT_OR_BELOW_TARGET`. Notification count remains 1. BG-03 selects zero new notifications. JSONL outbox remains unchanged (no repeated email).

#### Step 3: Above-Target Reset (`13.8M` $\rightarrow$ `14.2M VND`)

* **Action:** Process price `14,200,000 VND` (Target: `14,000,000 VND`).
* **Processor Result:** `PROCESSED`, `notificationCount: 0`.
* **State Transition:** `AT_OR_BELOW_TARGET` $\rightarrow$ `ABOVE_TARGET`.
* **Verification:** Threshold resets; no notifications generated or delivered.

#### Step 4: Second Qualifying Crossing (`14.2M` $\rightarrow$ `14.0M VND`)

* **Action:** Process price `14,000,000 VND` (Target: `14,000,000 VND`).
* **Processor Result:** `PROCESSED`, `notificationCount: 1`.
* **State Transition:** `ABOVE_TARGET` $\rightarrow$ `AT_OR_BELOW_TARGET`.
* **Delivery Execution:** Run `npm run notifications:deliver -- --limit=10`.
* **Verification:** Second notification transitioned to `SENT`. Second JSONL email entry created without duplicating the first email.

---

## Final Verified State

| Component | Final Verified State |
| --- | --- |
| **Alert Status** | `ACTIVE` |
| **Threshold State** | `AT_OR_BELOW_TARGET` |
| **Notifications Generated** | **2** |
| **SENT Notifications** | **2** |
| **JSONL Accepted Messages** | **2** |

---

## Story #40 Acceptance Criteria Matrix

| Criteria | Condition / Input | Verified Outcome |
| --- | --- | --- |
| **AC1 — First Downward Crossing** | `34.99M` $\rightarrow$ `13.9M` (Target: `14M`) | Exactly 1 notification, 1 delivered email, latency $\approx 7.45\text{s}$. |
| **AC2 — Remaining Below Target** | `13.9M` $\rightarrow$ `13.8M` (Target: `14M`) | 0 additional notifications, 0 additional emails. |
| **AC3 — Exact Subject** | Snapshot verification | Exactly `"Price Drop Alert: Dell XPS 13 9340"`. |
| **AC4 — Reset and Later Crossing** | `13.8M` $\rightarrow$ `14.2M` $\rightarrow$ `14.0M` | Above-target resets state without notification; equal-target crossing triggers 2nd notification/email. |

---

## Integration Defect Fixes

1. **ISO Timestamp Validation Fix:** Valid ISO 8601 UTC timestamps containing non-zero milliseconds (e.g., `2026-10-20T15:44:01.917Z`) were previously rejected. The validator was updated to accept non-zero milliseconds properly.
2. **Seed Reset Reproducibility:** Fixed seed conflict handling where existing runtime refresh metadata could persist instead of resetting to the deterministic fixture baseline.

---

## Files Changed

### Backend & Core Implementation:

* `backend/package.json`
* `backend/src/background/price-observation/price-observation.command.js`
* `backend/src/background/price-observation/price-observation.repository.js`
* `backend/src/background/price-observation/price-observation.validation.js`
* `backend/src/background/price-observation/price-observation.test.js`
* `backend/src/background/us05-demo.integration.test.js`
* `backend/src/database/seeds/001-demo-data.js`
* `backend/README.md`

### Documentation:

* `docs/SETUP.md`
* `docs/us05-demo.md` *(Dedicated step-by-step guide added)*

*(No frontend source files, package dependencies, or public API routes were added or modified.)*

---

## Verification & Automated Testing

* [x] **Automated End-to-End Integration Test:** Created a dedicated PostgreSQL-backed integration test exercising the complete sequence (`First Crossing` $\rightarrow$ `Delivery` $\rightarrow$ `Repeated Below` $\rightarrow$ `Reset` $\rightarrow$ `Second Crossing` $\rightarrow$ `Second Delivery`) using a temporary JSONL outbox.
* [x] **Backend Test Suite:** Passed all 61 tests.
```bash
Tests:      61 passed, 61 total
Snapshots:  0
Time:       1.78 s

```


* [x] **Syntax Check:** Verified syntax across 68 JavaScript files (`SYNTAX_OK=68`).
* [x] **Frontend Build Check:** Passed `npm run build` (Vite 8.3.2 transformed 22 modules).
* [x] **Regression Suite:** Verified Login, Watchlist, Add Product, Product Details, Price History, Compare, and Alert Creation without console errors.
* [x] **Fresh-Environment Reproducibility:** Verified whole flow from database reset and clean outbox on both PowerShell and macOS/Linux environments.

---

## Story and Parent Status

* **Story #40:** All Acceptance Criteria (AC1–AC4) satisfied end to end. Ready to close.
* **Parent #143:** All child issues (#144–#148) are complete. Ready for final review and merge into `main`.

---

## Scope Exclusions

This PR intentionally does **NOT** include:

* New US05 frontend screens or public test/process endpoints
* Postman collections or manual database state mutations
* Production retailer scrapers, schedulers, or queue systems (Redis/RabbitMQ)
* SMTP/SendGrid provider integrations or private credentials
* Final Milestone 3 PDF deliverable assets

---

Closes #148

Closes #40

Refs #143
