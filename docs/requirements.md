# Requirements Document

## 1. Product Vision

For online shoppers who struggle to monitor changing prices and compare equivalent products across different e-commerce sources, PriceLens tracks supported products over time, compares current offers and provides configurable price alerts, eliminating the slow and fragmented process of repeatedly checking each marketplace manually

## 2. Personas

### Persona 1: Deal-Hunting Shopper

**Role:**
Frequent online shopper who buys electronics and household items and wants to pay the lowest possible price.

**Goals:**

* Track the products they plan to buy in a single watchlist.
* Know whether the current price is a genuine deal or just a fake discount.
* Be told immediately when a product reaches an affordable price.

**Blockers:**

* Checking each marketplace manually is slow and repetitive.
* Prices change without warning, so good deals are easily missed.
* Cannot tell whether a "sale" price is actually lower than the past price.

**Quote:**
"I don't have time to check five websites every day. I just want to know when the price is right."

**Interview Note:**

* Interviewee: An online shopper who buys electronics several times a year.
* Date: September 2026.
* Topic discussed: How they currently compare and monitor prices across marketplaces.
* Key finding: Shoppers want one place to track products and a clear signal when a price drops.

---

### Persona 2: Budget-Conscious Student

**Role:**
University student with a limited budget who is saving up for a laptop, phone or other study equipment.

**Goals:**

* Monitor several expensive products at once while saving money.
* Set a target price and be notified when it becomes affordable.
* Avoid overpaying for items they can wait for.

**Blockers:**

* Cannot afford to buy at full price and does not know when to buy.
* Forgets to revisit product pages over several weeks.
* Worries that the displayed price is outdated or wrong.

**Quote:**
"I can only buy when the price drops, so I need something that watches it for me."

**Interview Note:**

* Interviewee: A second-year university student saving for a laptop.
* Date: September 2026.
* Topic discussed: How they decide when to buy expensive items on a limited budget.
* Key finding: Students rely on price alerts and want to trust that the price data is current.

---

### Persona 3: Careful Big-Ticket Buyer

**Role:**
Working professional buying high-value items such as phones, appliances or furniture, who researches carefully before purchasing.

**Goals:**

* Compare offers for the exact same product variant across different sources.
* Review price history before committing to a large purchase.
* Keep a small, organized list of products under consideration.

**Blockers:**

* Listings for similar products (different capacity, size or model) are easily confused.
* Comparing prices across sites means opening many tabs and copying details manually.
* Hard to find one specific product again in a long list of bookmarks.

**Quote:**
"Before I spend 20 million VND, I want to be sure I'm comparing the same product and getting the best offer."

**Interview Note:**

* Interviewee: A working professional who recently bought a smartphone and a home appliance online.
* Date: September 2026.
* Topic discussed: Challenges when comparing offers for expensive products.
* Key finding: Buyers need accurate like-for-like comparison and price history to feel confident.

---

### Persona 4: Busy Gift Shopper

**Role:**
Employee with limited free time who buys gifts and household items for family and only shops when the price is good.

**Goals:**

* Add products quickly by pasting a link instead of entering details manually.
* Receive email notifications without needing to open the app regularly.
* Stay within a manageable number of active alerts.

**Blockers:**

* Has very little time to browse and compare prices.
* Gets annoyed by repeated or duplicate notifications for the same price drop.
* Loses track of which products are already being tracked.

**Quote:**
"I just want to paste a link, set a price and get an email when it's time to buy."

**Interview Note:**

* Interviewee: A full-time employee who shops online mainly for gifts and household items.
* Date: September 2026.
* Topic discussed: Expectations for a low-effort price tracking tool.
* Key finding: Users want quick setup and a single, clear notification rather than repeated alerts.

## 3. Scenarios

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