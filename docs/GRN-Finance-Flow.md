# GRN Finance Flow — Where to See What

This document explains **what happens in the Finance module automatically** at every stage of the procurement cycle: from receiving goods (GRN) to paying the vendor. No manual journal entries are needed — the system posts everything automatically.

---

## The Full Cycle at a Glance

```
Purchase Order  →  GRN (Store)  →  Vendor Bill (Finance)  →  Payment (Finance)
                        ↓                   ↓                       ↓
               DR Inventory         DR GRNI (cleared)       DR Accounts Payable
               CR GRNI              CR Accounts Payable     CR Bank Account
```

---

## Step 1 — GRN Created (Store Department)

**When:** Store user creates a Goods Received Note after physically receiving items from the vendor.

**What the system posts automatically (Journal Code: `INV`):**

| # | Account | Type | Dr / Cr | Amount |
|---|---------|------|---------|--------|
| 1 | **1200 – Raw Materials Inventory** | Asset | **DEBIT** | Qty × Unit Price |
| 2 | **2140 – GRNI (Goods Received Not Invoiced)** | Liability | **CREDIT** | Qty × Unit Price |

**What this means:**
- Stock enters the warehouse → the asset account increases (Dr).
- We owe money to the vendor but the vendor has not sent an invoice yet → an accrual liability (GRNI) is created (Cr).
- The two sides balance perfectly.

**Where to see it in the system:**
> Finance → **Journal Entries** → filter by Journal = `INV` or search by the GRN reference number (e.g. `GRN-2025-0001`)

---

## Step 2 — Vendor Bill Created (Finance Department)

**When:** After Audit review, the Finance user creates a Vendor Bill against the GRN.

**What the system posts automatically (Journal Code: `PURCH`):**

| # | Account | Type | Dr / Cr | Amount |
|---|---------|------|---------|--------|
| 1 | **2140 – GRNI (Goods Received Not Invoiced)** | Liability | **DEBIT** | Bill Amount |
| 2 | **2100 – Accounts Payable** | Liability | **CREDIT** | Bill Amount |

**What this means:**
- The GRNI accrual is now *cleared* (Dr) because the vendor has confirmed the invoice.
- A proper Accounts Payable entry is created (Cr) — we now officially owe money to the vendor.

**Where to see it in the system:**
> Finance → **Accounts Payable** → Vendor Bills → find the bill by vendor name or GRN reference
>
> Finance → **Journal Entries** → filter by Journal = `PURCH` or search by bill number

---

## Step 3 — Payment Made (Finance Department)

**When:** Finance user pays the vendor via bank transfer or cheque.

**What the system posts automatically (Journal Code: `BANK` or `CASH`):**

| # | Account | Type | Dr / Cr | Amount |
|---|---------|------|---------|--------|
| 1 | **2100 – Accounts Payable** | Liability | **DEBIT** | Payment Amount |
| 2 | **1020 – Bank Account – Main (HBL)** | Asset | **CREDIT** | Payment Amount |

**What this means:**
- The amount owed to the vendor is reduced (Dr on AP).
- Cash leaves the bank (Cr on Bank).

**Where to see it in the system:**
> Finance → **Accounts Payable** → Payments
>
> Finance → **Journal Entries** → filter by Journal = `BANK` or `CASH`
>
> Finance → **Bank Statement / Cash Flow**

---

## Bonus — Goods Issued from Store (Store Issue Note / SIN)

**When:** Store issues materials to a project or department.

**What the system posts automatically:**

| # | Account | Type | Dr / Cr | Amount |
|---|---------|------|---------|--------|
| 1 | **5000 – Cost of Goods Sold (COGS)** | Expense | **DEBIT** | Qty × Weighted Average Cost |
| 2 | **1200 – Raw Materials Inventory** | Asset | **CREDIT** | Qty × Weighted Average Cost |

**What this means:**
- The cost of the issued material moves from the balance sheet (Inventory asset) to the income statement (COGS expense).
- The system uses **Weighted Average Cost (WAC)** — not the original purchase price — so costs are accurate even when items were purchased at different prices over time.

**Where to see it in the system:**
> Finance → **Journal Entries** → filter by reference containing the SIN number

---

## Account Quick Reference

| Account No. | Name | Type | Role in Procurement |
|-------------|------|------|---------------------|
| 1200 | Raw Materials Inventory | Asset | Inventory value on the balance sheet |
| 1320 | Other Current Assets | Asset | Used for Equipment, IT Equipment, Office Supplies |
| 2100 | Accounts Payable | Liability | What we owe vendors (official liability) |
| 2140 | GRNI – Goods Received Not Invoiced | Liability | Temporary accrual between GRN and vendor invoice |
| 4000 | Sales Revenue | Revenue | Income when items are sold out of inventory |
| 5000 | Cost of Goods Sold (COGS) | Expense | Cost of items issued/sold |
| 5100 | Direct Materials Cost | Expense | Purchase expense for direct (non-GRN) buys |
| 6700 | Office Supplies & Stationery | Expense | Purchase expense for office supply direct buys |

---

## Category → Finance Account Mapping

The category assigned to an inventory item determines which inventory asset account is used:

| Inventory Category | Valuation Account (GRN DR) | Purchase Expense |
|--------------------|---------------------------|------------------|
| General | 1200 Raw Materials Inventory | 5100 Direct Materials Cost |
| Raw Materials | 1200 Raw Materials Inventory | 5100 Direct Materials Cost |
| Consumables | 1200 Raw Materials Inventory | 5100 Direct Materials Cost |
| Civil Materials | 1200 Raw Materials Inventory | 5100 Direct Materials Cost |
| Electrical | 1200 Raw Materials Inventory | 5100 Direct Materials Cost |
| Office Supplies | 1320 Other Current Assets | 6700 Office Supplies & Stationery |
| Equipment | 1320 Other Current Assets | 5100 Direct Materials Cost |
| IT Equipment | 1320 Other Current Assets | 5100 Direct Materials Cost |

All categories share: GRNI = **2140**, COGS = **5000**, Sales = **4000**

---

## How the System Resolves Accounts (Priority Order)

1. **Item-level override** — if an individual inventory item has an account set directly on it, that is used first.
2. **Inventory Category** — if no item-level override, the category's configured accounts are used (this is what we set up).
3. **Global fallback** — if neither is set, the system falls back to well-known account numbers (1200, 2140, 5000).

---

## Full End-to-End Example

**Scenario:** 100 units of "Steel Pipe" received @ Rs. 500/unit. Invoice received and paid.

| Event | Journal | Debit | Credit | Amount |
|-------|---------|-------|--------|--------|
| GRN created | INV | 1200 Raw Materials Inventory | 2140 GRNI | Rs. 50,000 |
| Vendor Bill created | PURCH | 2140 GRNI | 2100 Accounts Payable | Rs. 50,000 |
| Payment made | BANK | 2100 Accounts Payable | 1020 HBL Bank | Rs. 50,000 |
| Items issued to project | SIN | 5000 COGS | 1200 Raw Materials Inventory | Rs. 50,000 |

After all four steps: Inventory is zero, Bank is reduced by Rs. 50,000, COGS is Rs. 50,000. GRNI and AP are both cleared (zero balance).
