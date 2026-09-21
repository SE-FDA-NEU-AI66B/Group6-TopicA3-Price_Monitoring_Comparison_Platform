# Requirements Document

## 1. Product Vision

For online shoppers who struggle to monitor changing prices and compare equivalent products across different e-commerce sources, PriceLens tracks supported products over time, compares current offers and provides configurable price alerts, eliminating the slow and fragmented process of repeatedly checking each marketplace manually

## 2. Personas

### Persona 1 — Nguyễn Minh Anh: Budget-Conscious University Student

**Profile:** Minh Anh is a 20-year-old second-year university student living in Hanoi. She mainly uses her smartphone to shop online and has a limited monthly budget for study equipment and personal electronics.

*Role:* A budget-conscious student researching and purchasing study equipment online.

*Goal:* Track the price of a suitable laptop and receive a notification when it falls within her budget of approximately 15,000,000 VND.

**Blocked by:**

* She must repeatedly check Shopee, Lazada and official retailer websites.
* Prices and discount vouchers change frequently.
* She cannot determine whether a displayed discount is genuine without historical price data.
* She is unsure whether the displayed price was updated recently.

*Shopping behaviour:* Minh Anh normally checks three different sources and may monitor a product for several weeks before purchasing it.

*Notification preference:* She wants exactly one email when the product reaches or falls below her target price. She does not want repeated emails while the price remains below that target.

**In her words:**
"I can compare prices myself, but I do not have time to check three applications every day."

**Technical skill:** Comfortable using mobile shopping applications but unlikely to use complex configuration options.

**Interview note:** This persona was informed by an interview with Nguyễn Minh Anh, University Student, conducted via interview on 12/9/2026.

### Persona 2 — Trần Quốc Huy: Careful Big-Ticket Buyer

**Profile:** Quốc Huy is a 31-year-old software engineer living in Hanoi. He is technically experienced and researches expensive electronic products carefully before making a purchase.

*Role:* A working professional comparing high-value electronics across several online sources.

*Goal:* Compare the same product variant across trusted retailers and use price history to determine whether the current offer is a genuine deal.

**Blocked by:**

* Similar listings may refer to different storage capacities, specifications or warranty options.
* A lower displayed price may belong to a different product variant.
* Discounts can be misleading without historical price information.
* Checking multiple sources manually takes considerable time.

*Shopping behaviour:* Quốc Huy normally checks four sources, including major marketplaces and authorised retailers. For example, he may track an iPhone 15 with 256 GB of storage for one month before purchasing it.

*Notification preference:* He wants an email containing the product name, current price, target price and source. The system should notify him only when the price crosses the target.

**In his words:**
"A lower price is not useful if the system is comparing a different storage capacity or warranty option."

**Technical skill:** High; comfortable with detailed filters, charts and product specifications.

**Interview note:** This persona was informed by an interview with Trần Quốc Huy, Big-ticket buyer, conducted via interview on 10/9/2026.

### Persona 3 — Lê Thu Hà: Busy Repeat Online Shopper

**Profile:** Thu Hà is a 38-year-old office administrator living in Bắc Ninh. She regularly purchases household products and gifts online but has limited time to monitor prices manually.

*Role:* A busy repeat shopper who saves products for planned household and gift purchases.

*Goal:* Add products quickly using their URLs, organise them in one watchlist and receive one clear notification when a product reaches her preferred price.

**Blocked by:**

* She does not have time to reopen every saved product link.
* She may accidentally save the same product URL more than once.
* Products become difficult to find when her list grows.
* Excessive or repeated notifications cause her to ignore useful messages.

*Shopping behaviour:* Thu Hà normally checks two or three marketplaces. She often saves product links so that she can return to them later, such as when monitoring the price of an air fryer before buying it as a gift.

*Notification preference:* She wants one concise email containing the product name, new price and source link when the target price is reached.

**In her words:**
"I want to save the product once and receive one useful message when the price is right."

**Technical skill:** Average; primarily uses a smartphone and prefers simple interactions.

**Interview note:** This persona was informed by an interview with Lê Thu Hà, Online shopper, conducted via interview on 15/9/2026.

## 3. Scenarios

### Scenario 1 — Nguyễn Minh Anh sets a target price and receives a notification

*Persona:* Nguyễn Minh Anh — Budget-Conscious University Student

*Goal:* Track a laptop and receive a notification when its price falls within her budget.

*Steps:*

1. At the beginning of the week, Minh Anh is saving for a laptop that currently costs 15,000,000 VND.
2. She signs in to PriceLens and finds the laptop among the products she is tracking.
3. She sees that its price was updated 2 hours ago and confirms that the information is not marked as stale.
4. She reviews its prices over the previous 30 days and decides that she can afford it at 14,000,000 VND.
5. She provides 14,000,000 VND as her target price.
6. PriceLens confirms that the target is valid and saves the alert with the status "Active".
7. Several days later, PriceLens records a new valid price of 13,900,000 VND, which is below her target.
8. Within 5 minutes, Minh Anh receives exactly one email with the subject "Price Drop Alert: Laptop ABC".
9. She reviews the new price and decides whether to purchase the laptop.
10. When the next recorded price is 13,800,000 VND, she does not receive another email because the price has remained below the same target.

*Alternative flow:* If the target price is 0 VND, equal to or higher than the current price, or Minh Anh already has 20 active alerts, PriceLens rejects the request and explains the reason. If the product has not received a valid update for 24 hours, Minh Anh sees a "Stale data" warning before making her decision.

### Scenario 2 — Trần Quốc Huy evaluates and compares a high-value product

*Persona:* Trần Quốc Huy — Careful Big-Ticket Buyer

*Goal:* Determine whether the current price is a genuine deal and identify the lowest valid offer for the same product variant.

*Steps:*

1. Quốc Huy wants to purchase an iPhone 15 with 256 GB of storage.
2. He signs in to PriceLens and finds the product among the items he is tracking.
3. He confirms that the displayed price was updated recently.
4. He reviews the product's prices over the previous 30 days and compares the current price with its recent price range.
5. He reviews the current offers collected from supported sources.
6. PriceLens includes only offers for the iPhone 15 with 256 GB and excludes offers for variants such as the 128 GB model.
7. He sees that Source A offers the product for 18,900,000 VND while Source B offers it for 18,500,000 VND.
8. He identifies Source B as 400,000 VND cheaper and follows its source link to consider completing the purchase.

*Alternative flow:* If the product does not have enough valid records, PriceLens explains that a 30-day price history is not yet available. If only one matching offer exists, Quốc Huy is informed that no multi-source comparison can currently be made.

### Scenario 3 — Lê Thu Hà adds and later finds a tracked product

*Persona:* Lê Thu Hà — Busy Repeat Online Shopper

*Goal:* Save a product quickly and find it again without reopening multiple saved links.

*Steps:*

1. Thu Hà finds an air fryer that she may purchase as a gift from a supported online store.
2. She copies the product's URL and signs in to PriceLens.
3. She provides the URL so that PriceLens can begin monitoring the product.
4. PriceLens confirms that the URL is supported and adds the air fryer to her tracked products with the status "Tracking".
5. Several days later, Thu Hà has 15 tracked products and wants to find the air fryer again.
6. She searches using the words "air fryer".
7. PriceLens displays only the tracked products whose names match those words.
8. She chooses the correct air fryer and reviews its latest recorded price.
9. She clears the search text and sees all 15 tracked products again.

*Alternative flow:* If Thu Hà provides a malformed URL or a URL from an unsupported source, PriceLens rejects it and explains the reason. If the normalized URL already belongs to one of her tracked products, PriceLens does not create a duplicate record.

## 4. User Stories

### User Story Summary

| ID       | Story                             | Priority | Points |
| -------- | --------------------------------- | -------: | -----: |
| *US01* | Search tracked products           |       P1 |      3 |
| *US02* | View product price history        |       P0 |      5 |
| *US03* | Create a price alert              |       P0 |      5 |
| *US04* | Add a product using its URL       |       P0 |      3 |
| *US05* | Receive a price-drop notification |       P0 |      8 |
| *US06* | Identify stale price data         |       P1 |      3 |
| *US07* | Deactivate a price alert | P1 | 2 |
| *US08* | Delete a tracked product | P1 | 2 |
| *US09* | Compare prices across retailers | P0 | 8 |
| *US10* | Identify out-of-stock offers | P1 | 3 |
| *US11* | Track a specific product variant | P2 | 5 |
| *US12* | Export product price history | P2 | 3 |

### US01 — Search tracked products

*Priority:* P1

*Story Points:* 3

*Primary Persona:* Lê Thu Hà

*Related Scenario:* Scenario 3

As *Lê Thu Hà, a busy repeat online shopper*, I want to *search my tracked products by name* so that *I can quickly find a saved product without manually checking the entire watchlist*.

#### Acceptance Criteria

* Given Hà's watchlist contains 15 products and exactly 1 product name contains the words "Air Fryer", when she searches for "air fryer", then exactly that 1 product is displayed within 2 seconds.
* Given no product in Hà's watchlist matches "xyz123", when she searches for that text, then the system displays exactly "No products found matching 'xyz123'".
* Given a search filter is currently applied, when Hà clears the search text, then all 15 products in her watchlist are displayed again.

#### Related Business Rules

None.

### US02 — View product price history

*Priority:* P0

*Story Points:* 5

*Primary Persona:* Trần Quốc Huy

*Related Scenarios:* Scenario 1 and Scenario 2

As *Trần Quốc Huy, a careful buyer of high-value electronics*, I want to *view a tracked product's price history* so that *I can determine whether its current price is a genuine deal*.

#### Acceptance Criteria

* Given a tracked product has 30 valid daily price records, when Huy views its price history, then a line chart containing exactly 30 data points is displayed for the previous 30 calendar days.
* Given the 30-day history of a tracked product has a lowest price of 18,500,000 VND, a highest price of 20,000,000 VND and a current price of 18,900,000 VND, when Huy views the price history, then those three values are displayed exactly.
* Given a newly tracked product has only 1 valid price record, when Huy views its price history, then the system displays exactly "Insufficient data for a 30-day chart".
* Given a product has no valid price records, when Huy views its price history, then the system displays exactly "No price history available" instead of an empty chart.

#### Related Business Rules

None.

### US03 — Create a price alert

*Priority:* P0

*Story Points:* 5

*Primary Persona:* Nguyễn Minh Anh

*Related Scenario:* Scenario 1

As *Nguyễn Minh Anh, a budget-conscious university student*, I want to *set a target price for a tracked laptop* so that *I can be notified when the laptop becomes affordable within my budget*.

#### Acceptance Criteria

* Given the tracked laptop's current price is 15,000,000 VND and Minh Anh has fewer than 20 active alerts, when she submits a target price of 14,000,000 VND, then the alert is saved with the status "Active" and the target price is displayed as "14,000,000 VND".
* Given the tracked laptop's current price is 15,000,000 VND, when Minh Anh submits a target price of 16,000,000 VND, then the request is rejected with the message "Target price must be lower than the current price" (BR2).
* Given the tracked laptop's current price is 15,000,000 VND, when Minh Anh submits a target price of 0 VND, then the request is rejected with the message "Target price must be greater than 0" (BR2).
* Given Minh Anh already has 20 active price alerts, when she attempts to create a 21st active alert, then the request is rejected with the message "Maximum 20 active alerts reached" (BR1).

#### Related Business Rules

* BR1 — Maximum number of active price alerts
* BR2 — Valid target-price range

### US04 — Add a product using its URL

*Priority:* P0

*Story Points:* 3

*Primary Persona:* Lê Thu Hà

*Related Scenario:* Scenario 3

As *Lê Thu Hà, a busy repeat online shopper*, I want to *add a supported product using its URL* so that *PriceLens can track the product without requiring me to enter its information manually*.

#### Acceptance Criteria

* Given Hà's watchlist contains 4 products and she provides a valid supported URL for an air fryer that is not already in her watchlist, when she submits the URL, then her watchlist contains 5 products and the new product has the status "Tracking".
* Given Hà's watchlist already contains a product with the same normalized URL, when she submits that URL again, then the request is rejected with the message "This product URL is already being tracked" and the number of products in her watchlist remains unchanged (BR6).
* Given Hà provides a malformed URL or a URL from an unsupported source, when she attempts to add the product, then the request is rejected with the message "Unsupported or invalid product URL".

#### Related Business Rules

* BR6 — One watchlist record per normalized product URL

### US05 — Receive a price-drop notification

*Priority:* P0

*Story Points:* 8

*Primary Persona:* Nguyễn Minh Anh

*Related Scenario:* Scenario 1

As *Nguyễn Minh Anh, a budget-conscious university student*, I want to *receive one email when a tracked product reaches my target price* so that *I can decide whether to purchase it without repeatedly checking multiple shopping platforms*.

#### Acceptance Criteria

* Given Minh Anh has an active alert with a target price of 14,000,000 VND and the previously recorded laptop price was 15,000,000 VND, when PriceLens records a new valid price of 13,900,000 VND, then exactly 1 email notification is sent to her registered email address within 5 minutes (BR4).
* Given 1 notification has already been sent after the laptop price reached 13,900,000 VND, when the next recorded price is 13,800,000 VND and remains below the same target price, then no additional notification is sent (BR4).
* Given a notification is generated for a product named "Laptop ABC", when Minh Anh receives the email, then its subject is exactly "Price Drop Alert: Laptop ABC".
* Given the laptop price later rises to 14,200,000 VND and subsequently falls to 14,000,000 VND, when that new threshold crossing is recorded, then exactly 1 new email notification is sent within 5 minutes (BR4).

#### Related Business Rules

* BR4 — Price-alert notification trigger and repeat behaviour

### US06 — Identify stale price data

*Priority:* P1

*Story Points:* 3

*Primary Persona:* Nguyễn Minh Anh

*Related Scenario:* Scenario 1

As *Nguyễn Minh Anh, a budget-conscious university student*, I want to *see when a product's price was last successfully updated* so that *I can judge whether the displayed price is current and reliable*.

#### Acceptance Criteria

* Given a product's price was successfully updated 2 hours ago, when Minh Anh views the product in her watchlist, then the system displays exactly "Updated 2 hours ago" and does not display a stale-data warning.
* Given a product's last successful price update occurred at 08:00 on 15 September, when Minh Anh views the product at 08:00 on 16 September, then the price is marked with the warning "Stale data" because it is exactly 24 hours old (BR3).
* Given a product is currently marked as stale, when a new valid price is successfully recorded, then the "Stale data" warning is removed and the system displays exactly "Updated just now".

#### Related Business Rules

* BR3 — Stale price-data threshold

### US07 — Deactivate a price alert

*Priority:* P1

*Story Points:* 2

*Primary Persona:* Nguyễn Minh Anh

*Related Scenario:* Scenario 1 — extended alert-management flow

As *Nguyễn Minh Anh, a budget-conscious university student*, I want to *deactivate a price alert without deleting it* so that *I can stop its notifications while keeping the target price for future use*.

#### Acceptance Criteria

* Given Minh Anh has an active laptop alert with a target price of 14,000,000 VND, when she deactivates the alert, then its status changes to "Inactive" and its saved target price remains exactly "14,000,000 VND".
* Given the alert is inactive and PriceLens records a laptop price of 13,900,000 VND, when the price is processed, then no email notification is sent (BR4). 
* Given Minh Anh has 20 active alerts and 1 inactive alert, when she attempts to reactivate the inactive alert, then the request is rejected with the message "Maximum 20 active alerts reached" (BR1).
* Given Minh Anh has 19 active alerts and 1 inactive alert, when she reactivates the inactive alert, then its status changes to "Active" and her active-alert count becomes exactly 20 (BR1, BR4).

#### Related Business Rules

* BR1 — Maximum number of active price alerts 
* BR4 — Price-alert notification trigger and repeat behaviour

### US08 — Delete a tracked product

*Priority:* P1

*Story Points:* 2

*Primary Persona:* Lê Thu Hà

*Related Scenario:* Scenario 3 — extended watchlist-management flow

As *Lê Thu Hà, a busy repeat online shopper*, I want to *delete a product that I no longer need to track* so that *my watchlist remains organised and relevant*.

#### Acceptance Criteria

* Given Hà's watchlist contains 15 products, when she confirms the deletion of 1 tracked product, then the system displays exactly "Product removed from your watchlist" and her watchlist contains exactly 14 products.
* Given the tracked product has 2 active price alerts, when Hà requests to delete it, then the confirmation message states exactly "Deleting this product will also delete 2 price alerts" (BR7)
* Given Hà confirms the deletion of a tracked product with 2 active alerts, when the deletion is completed, then the product and both alerts are removed and her active-alert count decreases by exactly 2 (BR7)
* Given Hà cancels the deletion confirmation, when she returns to her watchlist, then all 15 products remain and the 2 related alerts retain the status "Active" (BR7)

#### Related Business Rules

* BR7 — Tracked-product deletion and associated-alert removal

### US09 — Compare prices across retailers

*Priority:* P0

*Story Points:* 8

*Primary Persona:* Trần Quốc Huy

*Related Scenario:* Scenario 2

As *Trần Quốc Huy, a careful buyer of high-value electronics*, I want to *compare current offers for the same product variant across supported retailers* so that *I can identify the lowest valid offer without comparing different variants*.

#### Acceptance Criteria

* Given Source A offers an iPhone 15 256 GB for 18,900,000 VND and Source B offers the same variant for 18,500,000 VND, when Huy views the comparison, then both offers are displayed, Source B appears first and the system shows that it is exactly 400,000 VND cheaper.
* Given Source C offers an iPhone 15 128 GB for 17,900,000 VND, when Huy compares offers for the iPhone 15 256 GB, then the 128 GB offer is excluded from the comparison (BR5).
* Given only 1 valid offer matches the selected product variant, when Huy views the comparison, then the system displays exactly "No multi-source comparison is currently available".

#### Related Business Rules

* BR5 — Product-variant consistency

### US10 — Identify out-of-stock offers

*Priority:* P1

*Story Points:* 3

*Primary Persona:* Trần Quốc Huy

*Related Scenario:* Scenario 2 — supporting comparison flow

As *Trần Quốc Huy, a careful buyer of high-value electronics*, I want to *see which retailer offers are currently out of stock* so that *I can distinguish purchasable offers from unavailable ones*.

#### Acceptance Criteria

* Given Retailer A has 0 available units of the selected product variant, when Huy views the comparison, then Retailer A's availability status is displayed exactly as "Out of stock" (BR8)
* Given Retailer A lists the product for 18,200,000 VND but is out of stock and Retailer B lists it for 18,500,000 VND and is in stock, when Huy views the comparison, then Retailer B is identified as the "Lowest available offer" (BR8)
* Given all supported retailers are out of stock for the selected product variant, when Huy views its offers, then the system displays exactly "Currently out of stock across all tracked sources" (BR8)

#### Related Business Rules

* BR8 — Out-of-stock offer eligibility

### US11 — Track a specific product variant

*Priority:* P2

*Story Points:* 5

*Primary Persona:* Trần Quốc Huy

*Related Scenario:* Scenario 2 — extended variant-selection flow

As **Trần Quốc Huy, a careful buyer of high-value electronics**, I want to **select the exact variant of a product that I intend to track** so that **prices from different capacities or specifications do not affect my tracked product**.

#### Acceptance Criteria

* Given an iPhone 15 is available with 128 GB, 256 GB and 512 GB capacities, when Huy adds the product and selects the 256 GB option, then exactly 1 tracked product is created with the variant displayed as "iPhone 15 — 256 GB" (BR5).

* Given the product has 3 available capacities and Huy has not selected one, when he attempts to start tracking, then the request is rejected with the message "Select 1 product variant to continue" (BR5).

* Given Huy is tracking the iPhone 15 256 GB at 20,000,000 VND, when the 128 GB variant falls to 18,000,000 VND, then the tracked price of the 256 GB variant remains exactly 20,000,000 VND (BR5).

* Given a retailer offers only the iPhone 15 128 GB, when Huy views offers for his tracked 256 GB variant, then that retailer's 128 GB offer is excluded (BR5).

#### Related Business Rules

* BR5 — Product-variant consistency

### US12 — Export product price history

*Priority:* P2

*Story Points:* 3

*Primary Persona:* Trần Quốc Huy

*Related Scenario:* Scenario 2 — supporting price-analysis flow

As *Trần Quốc Huy, a careful buyer of high-value electronics*, I want to *export a tracked product's price history as a CSV file* so that *I can analyse its long-term price changes offline*.

#### Acceptance Criteria

* Given a product has 60 valid daily price records, when Huy exports its price history, then the downloaded CSV contains exactly 1 header row followed by 60 data rows, for a total of 61 rows.
* Given the CSV export contains price-history data, when Huy opens the file, then its header is exactly "date,price_vnd" and every data row contains one date and one price value.
* Given a product has only 5 valid price records, when Huy exports its price history, then the downloaded CSV contains exactly 1 header row and 5 data rows, for a total of 6 rows.
* Given a product has 0 valid price records, when Huy attempts to export its price history, then no file is generated and the system displays exactly "No data to export".

#### Related Business Rules

None.

## 5. Business Rules

| ID | Rule | Worked example |
|---|---|---|
| **BR1** | A user may have no more than 20 active price alerts at the same time. Inactive, deleted or expired alerts do not count toward this limit. | Minh already has 20 active alerts. When he attempts to create a 21st active alert, the request is rejected and the number of active alerts remains 20. If he deactivates 1 alert, the number of active alerts becomes 19 and he may create 1 new active alert. |
| **BR2** | A target price must be greater than 0 and strictly lower than the product's current valid price at the time the alert is created. | The current price is 20,000,000 VND. A target price of 19,500,000 VND is accepted. Target prices of 20,000,000 VND, 20,500,000 VND and 0 VND are rejected. |
| **BR3** | Price data whose last successful update is 24 hours old or older must be marked as stale until a new valid price is recorded. | A product price was last updated at 08:00 on 15 September. At 07:59 on 16 September it is not stale. At 08:00 on 16 September it is exactly 24 hours old and must be marked `"Stale data"`. |
| **BR4** | An active price alert must send exactly one notification when a product's valid price changes from above the target price to equal to or below the target price. No additional notification may be sent while the price remains at or below that target. The alert may trigger again only after the price rises above the target and later falls to the target or below. | The target price is 5,000,000 VND. The price changes from 5,200,000 VND to 4,900,000 VND, so exactly 1 notification is sent. A later price of 4,800,000 VND sends no additional notification. If the price later rises to 5,100,000 VND and then falls to 5,000,000 VND, exactly 1 new notification is sent. |
| **BR5** | Each tracked-product record must identify exactly one product variant. A price or offer may update or be compared with that record only when it matches the same brand, model and selected variant attributes, such as capacity, size or specification. | Huy tracks an iPhone 15 256 GB. Offers from Source A at 18,900,000 VND and Source B at 18,500,000 VND may be compared because both refer to the 256 GB variant. An iPhone 15 128 GB offer at 17,900,000 VND must be excluded. |
| **BR6** | Each user may have only one watchlist record for the same normalized product URL. URL tracking parameters must be removed before duplicate checking. | Minh has 5 products in his watchlist, including `https://shop.example/product/123`. He submits `https://shop.example/product/123?utm_source=email`. After URL normalization, both URLs identify the same product, so the second request is rejected and his watchlist remains at exactly 5 products. |
| **BR7** | Deleting a tracked product must also permanently delete all price alerts associated with that product, but no deletion may occur until the user confirms the action. Cancelling the confirmation must leave both the product and its alerts unchanged. | Thu Hà has 15 tracked products. One product has 2 active alerts. After she confirms its deletion, her watchlist contains 14 products and both alerts are deleted. If she cancels instead, all 15 products and both active alerts remain unchanged. |
| **BR8** | An out-of-stock offer must not be identified as the lowest available offer. Only in-stock offers that match the selected product variant are eligible for that result. If every matching offer is out of stock, no lowest available offer may be selected. | Retailer A lists the selected variant for 18,200,000 VND but has 0 available units. Retailer B lists it for 18,500,000 VND and is in stock. Retailer B must be identified as the lowest available offer. If both retailers have 0 available units, the system displays "Currently out of stock across all tracked sources". |

## 6. Screens and Flow
### Screen Inventory

| Route | Purpose | Access | Priority |
|---|---|:---:|:---:|
| `/` | Introduce PriceLens and allow a guest to sign in | G | P0 |
| `/watchlist` | Display tracked products, search by product name, show price-update status and remove products from the watchlist (US01, US06, US08) | U | P0 |
| `/products/add` | Add a product using a supported URL and select the exact product variant to track (US04, US11) | U | P0 |
| `/products/:productId` | Display the current price and price history, create a price alert and export price-history data (US02, US03, US12) | U | P0 |
| `/products/:productId/compare` | Compare matching product offers, show availability and identify the lowest valid in-stock offer (US09, US10) | U | P0 |
| `/alerts` | Display active and inactive price alerts and allow users to deactivate or reactivate them (US07) | U | P1 |

**Access legend:**

- **G** — Guest
- **U** — Authenticated user
- **A** — Administrator

PriceLens does not currently require an Administrator screen because no approved persona, scenario or User Story defines administrator behaviour.

### Flow Notes

- A guest begins at `/` and reaches `/watchlist` after signing in.
- From `/watchlist`, a user can add a product, open a tracked product or manage price alerts.
- A valid product URL and selected variant lead from `/products/add` to the corresponding product details.
- An invalid, unsupported or duplicate URL keeps the user on `/products/add` and displays the relevant rejection message.
- From `/products/:productId`, the user can view price history, create an alert, export price data or open the offer comparison.
- Confirming product deletion returns the user to `/watchlist`; cancelling the confirmation leaves the product unchanged.
- Deactivating or reactivating an alert keeps the user on `/alerts` with the updated alert status.
- Price-drop emails are external notification outcomes defined by US05 and BR4, so they are not represented as application screens.

### Flow Diagram

```text
                                           ┌─────────────┐
                                           │      /      │  not signed in
                                           └──────┬──────┘
                                                  │ sign in
                                                  ▼
                                  ┌────────────────────────┐
                       ┌─────────▶│       /watchlist       │◀──────────────┐
                       │          └───┬────────┬───────────┘               │
                       │              │        │                           │
                cancel │   add product│        │open tracked product       │ back
                       │              ▼        ▼                           │
              ┌────────┴─────────┐  ┌─────────────────────────┐           │
              │  /products/add   ├─▶│  /products/:productId   ├───────────┘
              └────────┬─────────┘  └───────────┬─────────────┘
                       │                        │
      invalid URL      │ valid URL +            │ compare offers
      unsupported      │ exact variant          ▼
      or duplicate     │         ┌─────────────────────────────────┐
              ┌────────┘         │ /products/:productId/compare    │
              │                  └───────────────┬─────────────────┘
              └────── stay                       │ back
                     on                         └──────────────┐
              /products/add                                    │
                                                               │
                                  ┌─────────────────────────┐  │
                                  │  /products/:productId   │◀─┘
                                  └─────────────────────────┘


              ┌─────────────────────────────────────────────────────────┐
              │                                                         │
              │  From /watchlist: manage alerts                         │
              ▼                                                         │
        ┌─────────────┐                                                 │
        │   /alerts   ├─────────────────────────────────────────────────┘
        └──────┬──────┘                 back to watchlist
               │
               │ deactivate or reactivate
               ▼
        stay on /alerts


        System outcomes — not additional application screens:

        /products/:productId ── export price history ──▶ CSV downloaded (US12)

        active price alert ── target price crossed ──▶ price-drop email sent
                                                        within 5 minutes
                                                        (US05, BR4)
```
