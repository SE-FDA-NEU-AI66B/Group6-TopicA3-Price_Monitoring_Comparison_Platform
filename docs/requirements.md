# Requirements Document

## 1. Product Vision

For online shoppers who struggle to monitor changing prices and compare equivalent products across different e-commerce sources, PriceLens tracks supported products over time, compares current offers and provides configurable price alerts, eliminating the slow and fragmented process of repeatedly checking each marketplace manually

## 2. Personas

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

---

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

---

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

---

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

---

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

### 4.1 User Story Summary

| ID | Story | Priority | Points |
|---|---|---:|---:|
| **US01** | Search tracked products | P1 | 3 |
| **US02** | View product price history | P0 | 5 |
| **US03** | Create a price alert | P0 | 5 |
| **US04** | Add a product using its URL | P0 | 3 |
| **US05** | Receive a price-drop notification | P0 | 8 |
| **US06** | Identify stale price data | P1 | 3 |

### US01 - Search tracked products

As a shopper, I want to search the products in my watchlist by name so that I can quickly find a product without manually scrolling through the entire list.

**Acceptance criteria**

* Given my watchlist contains 15 products and exactly 3 product names contain the word "MacBook", when I search for "macbook", then exactly those 3 products are displayed within 2 seconds.
* Given no product in my watchlist matches "xyz123", when I search for that text, then the system displays exactly `"No products found matching 'xyz123'"`.
* Given I clear the search text, when the search is updated, then all 15 products in my watchlist are displayed again.

### US02 - View product price history

As a shopper, I want to view a product's price history so that I can determine whether its current price is a genuine deal.

**Acceptance criteria**

* Given a tracked product has 30 valid daily price records, when I view its price history, then a line chart containing exactly 30 data points is displayed for the previous 30 calendar days.
* Given a newly tracked product has only 1 valid price record, when I view its price history, then the system displays exactly `"Insufficient data for a 30-day chart"`.
* Given a product has no valid price records, when I view its price history, then the system displays exactly `"No price history available"` instead of an empty chart.

### US03 - Create a price alert

As a shopper, I want to set a target price for a tracked product so that I can be notified when the product becomes affordable.

**Acceptance criteria**

* Given the current product price is 15,000,000 VND and I have fewer than 20 active alerts, when I submit a target price of 14,000,000 VND, then the alert is saved with the status `"Active"` and the target price is displayed as `"14,000,000 VND"`.
* Given the current product price is 15,000,000 VND, when I submit a target price of 16,000,000 VND, then the request is rejected with the message `"Target price must be lower than the current price"` (BR2).
* Given the current product price is 15,000,000 VND, when I submit a target price of 0 VND, then the request is rejected with the message `"Target price must be greater than 0"` (BR2).
* Given I already have 20 active price alerts, when I attempt to create a 21st active alert, then the request is rejected with the message `"Maximum 20 active alerts reached"` (BR1).

### US04 - Add a product using its URL

As a shopper, I want to add a supported product using its URL so that PriceLens can track its price in my watchlist.

**Acceptance criteria**

* Given my watchlist contains 4 products and I provide a valid supported URL that is not already in my watchlist, when I add the product, then my watchlist contains 5 products and the new product has the status `"Tracking"`.
* Given my watchlist already contains a product with the same normalized URL, when I submit that URL again, then the request is rejected with the message `"This product URL is already being tracked"` and the number of products in my watchlist remains unchanged (BR6).
* Given I provide a malformed URL or a URL from an unsupported source, when I attempt to add it, then the request is rejected with the message `"Unsupported or invalid product URL"`.

### US05 - Receive a price-drop notification

As a shopper, I want to receive an email notification when a product reaches my target price so that I can decide whether to purchase it.

**Acceptance criteria**

* Given my active alert has a target price of 5,000,000 VND and the previously recorded price was 5,200,000 VND, when PriceLens records a new valid price of 4,900,000 VND, then exactly 1 email notification is sent to my registered email address within 5 minutes (BR4).
* Given 1 notification has already been sent after the price reached 4,900,000 VND, when the next recorded price is 4,800,000 VND and remains below the same target price, then no additional notification is sent (BR4).
* Given a notification is sent for a product named "Laptop ABC", when I receive the email, then its subject is exactly `"Price Drop Alert: Laptop ABC"`.
* Given the price later rises above 5,000,000 VND and subsequently falls to 5,000,000 VND or below, when that new threshold crossing is recorded, then exactly 1 new notification is sent (BR4).

### US06 - Identify stale price data

As a shopper, I want to see when a product's price was last updated so that I can judge whether the displayed information is current and reliable.

**Acceptance criteria**

* Given a product's price was successfully updated 2 hours ago, when I view the product in my watchlist, then the system displays exactly `"Updated 2 hours ago"` and does not display a stale-data warning.
* Given a product's last successful price update occurred at 08:00 on 15 September, when I view the product at 08:00 on 16 September, then the price is marked with the warning `"Stale data"` because it is 24 hours old (BR3).
* Given a product is currently marked as stale, when a new valid price is successfully recorded, then the `"Stale data"` warning is removed and the system displays exactly `"Updated just now"`.


## 5. Business Rules

| ID | Rule | Worked example |
|---|---|---|
| **BR1** | A user may have no more than 20 active price alerts at the same time. Inactive, deleted or expired alerts do not count toward this limit. | Minh already has 20 active alerts. When he attempts to create a 21st active alert, the request is rejected and the number of active alerts remains 20. If he deactivates 1 alert, the number of active alerts becomes 19 and he may create 1 new active alert. |
| **BR2** | A target price must be greater than 0 and strictly lower than the product's current valid price at the time the alert is created. | The current price is 20,000,000 VND. A target price of 19,500,000 VND is accepted. Target prices of 20,000,000 VND, 20,500,000 VND and 0 VND are rejected. |
| **BR3** | Price data whose last successful update is 24 hours old or older must be marked as stale until a new valid price is recorded. | A product price was last updated at 08:00 on 15 September. At 07:59 on 16 September it is not stale. At 08:00 on 16 September it is exactly 24 hours old and must be marked `"Stale data"`. |
| **BR4** | An active price alert must send exactly one notification when a product's valid price changes from above the target price to equal to or below the target price. No additional notification may be sent while the price remains at or below that target. The alert may trigger again only after the price rises above the target and later falls to the target or below. | The target price is 5,000,000 VND. The price changes from 5,200,000 VND to 4,900,000 VND, so exactly 1 notification is sent. A later price of 4,800,000 VND sends no additional notification. If the price later rises to 5,100,000 VND and then falls to 5,000,000 VND, exactly 1 new notification is sent. |
| **BR5** | PriceLens may compare offers only when they refer to the same product variant, including the same brand, model and capacity or size attributes that affect the price. | An iPhone 15 with 128 GB from Source A priced at 18,900,000 VND may be compared with an iPhone 15 with 128 GB from Source B priced at 18,500,000 VND. An iPhone 15 with 256 GB priced at 21,000,000 VND must not be included in that comparison. |
| **BR6** | Each user may have only one watchlist record for the same normalized product URL. URL tracking parameters must be removed before duplicate checking. | Minh has 5 products in his watchlist, including `https://shop.example/product/123`. He submits `https://shop.example/product/123?utm_source=email`. After URL normalization, both URLs identify the same product, so the second request is rejected and his watchlist remains at exactly 5 products. |



## 6. Screens and Flow