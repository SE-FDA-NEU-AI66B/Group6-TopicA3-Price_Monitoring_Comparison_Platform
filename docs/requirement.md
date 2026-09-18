# Requirements Document

## 1. Product Vision

For online shoppers who struggle to monitor changing prices and compare equivalent products across different e-commerce sources, PriceLens tracks supported products over time, compares current offers and provides configurable price alerts, eliminating the slow and fragmented process of repeatedly checking each marketplace manually

## 2. Personas

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


## 6. Screens and Flow