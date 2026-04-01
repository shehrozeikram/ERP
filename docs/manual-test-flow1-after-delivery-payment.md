# Manual Test Guide - Flow 1 (After-Delivery Payment)

This guide covers the complete manual scenario:

1. Create inventory item with zero opening stock
2. Complete procurement cycle (Indent -> Quotation -> PO -> GRN complete -> SIN)
3. Create AP bill after GRN
4. Pay AP bill (after-delivery payment)
5. Validate expected results in Finance module

Use this exact guide to verify accounting postings and report behavior end-to-end.

---

## A) Preconditions

- Make sure transactional data is cleaned (already done).
- Ensure these accounts exist and are active:
  - `1200` Raw Materials Inventory (Asset) for this test item
  - `2140` or `2100` GRNI (Liability)
  - `5000` COGS (Expense)
  - `2001` Accounts Payable (Liability)
  - `1001` Cash and/or `1002` Bank (Asset)
- Ensure at least one active:
  - Project
  - Store (for GRN)
  - Supplier/Vendor

Note: In your current setup, item-level finance mapping is the key. Always map inventory item accounts explicitly while testing.  
Important: your dropdown shows `1100 = Accounts Receivable`, so do not use `1100` as inventory in this environment.

---

## B) Create Inventory Item (Qty = 0, No Supplier)

Go to `Procurement -> Inventory -> New`.

Fill fields:

- Name: `RM Manual Flow1`
- Category: `Raw Materials` (or your target category)
- Unit: `bag` (or your operational unit)
- Opening Quantity: `0`
- Unit/List Price: `100` (any test value)
- Supplier: keep empty
- Project/Store/location: optional

Finance/account tab:

- On GRN (Inventory Account): `1200 - Raw Materials Inventory`
- Stock Input/GRNI Account: `2140` (or `2100` if your setup uses 2100 as GRNI)
- On Issue/COGS Account: `5000`

Save item.

Expected immediately:

- Quantity = `0`
- WAC may be `0` initially
- No journal entry just by creating inventory master

---

## C) Full Procurement Cycle (Operational Steps)

### 1) Create Indent

Go to `General/Procurement -> Indent`.

- Add item `RM Manual Flow1`
- Quantity: `100`
- Submit and move through approval steps as per your workflow

### 2) Quotation / Comparative / Selection

- Invite quotations
- Create/select quotation for vendor
- Finalize comparative (if required in your flow)

### 3) Purchase Order (PO)

- Create PO from selected quotation
- Confirm/send PO to store/procurement flow

### 4) Goods Receive Note (GRN) - Full Receipt (Not Partial)

Go to `Procurement -> Goods Receive`.

- Select the PO
- Receive all PO item quantities (full quantity, e.g. 100)
- Product Code can be same as item code/name
- Unit price = same as PO line (example `100`)
- Status should end as `Complete` / `Received` (not partial)
- Save GRN

Operational expected:

- Inventory quantity increases from `0` to `100`
- WAC updates from `0` to received cost (for single receipt should become unit price)
- List Price updates/retains according to receipt price behavior
- Stock Value = Quantity x WAC (or item valuation rule in your setup)

### 5) Store Issue Note (SIN)

Go to `Procurement -> Goods Issue`.

- Issue part quantity, example `10`
- Post SIN

Operational expected:

- Inventory quantity drops from `100` to `90`
- WAC remains stable for this single-cost scenario

---

## D) AP Bill and Payment (After-Delivery - Flow 1)

**Important (PO approval timing):** In this ERP, an Accounts Payable bill is often created when the **Purchase Order is approved** (CEO/Finance), which can happen **before** you create the GRN. The system clears GRNI on that bill by matching **PO lines** to your **Inventory** master (same rules as GRN: `productCode` → `itemCode`, or line **description** → inventory **name**). Keep PO line text aligned with the inventory item so GRNI is `2140` (or your chosen GRNI), not the generic fallback `2100`.

### 1) Create AP Bill (against PO/GRN)

Go to `Finance -> Accounts Payable` (or bill creation path used in your system).

- Create/confirm bill from PO/GRN
- Bill amount example: `1000` (if GRN qty 10 x 100) or full as per your test
- Post bill

Expected AP status right after bill creation:

- Outstanding = bill amount
- Status = `Unpaid` (or equivalent)

### 2) Pay Bill (after delivery)

In AP screen:

- Open the bill
- Click `Pay Bill`
- Payment method: Cash or Bank
- Payment account: `1001` or `1002`
- Payment amount: full outstanding
- Save/post payment

Expected after payment:

- Outstanding = `0`
- Status = `Paid`
- Payment history shows settlement details

---

## E) Expected Finance Postings (Core)

These are the expected accounting entries for Flow 1:

1. **GRN posting**
   - DR `1200 Raw Materials Inventory` (or whichever inventory account you selected on item)
   - CR `GRNI` (`2140` or `2100` depending on your mapping)

2. **AP bill posting (clearing GRNI to AP)**
   - DR `GRNI` (`2140` or `2100`)
   - CR `2001 Accounts Payable`

3. **AP payment posting**
   - DR `2001 Accounts Payable`
   - CR `1001 Cash` or `1002 Bank`

4. **SIN posting**
   - DR `5000 COGS`
   - CR `1200 Raw Materials Inventory` (same inventory account selected on item)
   - Amount should use WAC-based valuation

---

## F) What to Check in Finance Module (Screen-by-Screen)

## 1) Journal Entries

Check references by GRN number, PO/bill number, and SIN number.

You should find:

- One GRN JE with DR Inventory / CR GRNI
- One AP bill JE with DR GRNI / CR AP
- One payment JE with DR AP / CR Cash-Bank
- One SIN JE with DR COGS / CR Inventory

Each JE must be balanced (debits = credits).

## 2) General Ledger

Open ledgers by account:

- `1100`: debit from GRN, credit from SIN
- `1200`: debit from GRN, credit from SIN (for your current chart setup)
- `GRNI account (2140/2100)`: credit at GRN, debit at bill
- `2001`: credit at bill, debit at payment
- `5000`: debit from SIN
- `1001/1002`: credit from payment

## 3) Trial Balance

- Total debits = total credits
- Includes movements for 1100, GRNI, 2001, 5000, and cash/bank

## 4) Balance Sheet

At this stage:

- Inventory asset reflects net remaining stock value
- AP may be zero if fully paid
- Report should remain balanced

## 5) Profit & Loss

- COGS should reflect issued quantity cost from SIN
- If no sales in this test, net result may show a loss equal to expense impact

---

## G) Quick Pass/Fail Checklist

- [ ] Inventory created with qty `0` and no supplier
- [ ] GRN created as full receipt (not partial)
- [ ] Inventory quantity and WAC updated after GRN
- [ ] AP bill created and outstanding appears correctly
- [ ] Bill fully paid; outstanding becomes `0`; status `Paid`
- [ ] Journal entries exist for GRN, AP bill, AP payment, SIN
- [ ] No duplicate SIN COGS journal
- [ ] Trial Balance balanced
- [ ] Balance Sheet balanced
- [ ] P&L shows COGS impact

---

## H) Common Mismatch Signals and Meaning

- GRN updated stock but no GRN JE:
  - GRN line item mapping issue (item code/link problem)
- AP bill exists but GRNI has no earlier credit:
  - GRN posting missing before bill
- Outstanding not zero after full payment:
  - Partial payment or payment not posted
- WAC or stock value zero after GRN:
  - Receipt unit price missing/zero or costing update not applied

