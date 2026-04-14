# Manual Test Guide - Flow 3 (Item Catalog → Indent → Full Procurement)

This guide walks through **adding a brand-new item to the master catalog**, **using it on an indent**, and then continuing the **operational procurement chain** (quotation → PO → GRN → bill / payment / issue) so you can test the product end-to-end.

It complements **Flow 1** (after-delivery payment) and **Flow 2** (payment in advance); reuse their finance validation steps where those flows apply.

---

## What this flow tests

1. **Item catalog** (indent line-item master): category + item name — the same list that powers **General → Create Indent** (category + item search).
2. **Indent** creation with that item selected (not only free-typed text).
3. **Downstream** procurement and inventory behaviour once the indent is approved / in procurement.

---

## A) Preconditions

- Roles: users who can maintain the **item catalog** (Store / Procurement as per your menu), create **indents**, and (later) **quotations / PO / GRN** as in your org.
- For **finance posting** tests (GRN, AP, etc.), align accounts with **Flow 1** or **Flow 2** and run **`POST /api/finance/accounts/ensure-defaults`** if the chart is empty.
- Optional but recommended for **GRN / stock** tests: after the catalog step, create a matching **Inventory** master (qty `0`) so GRN can resolve stock — see **section C**.

---

## B) Add a new category and item in the catalog

**Navigation:** `Procurement → Store → Item catalog`  
**URL:** `/procurement/store/item-catalog`

The page explains that this catalog is the same master used by **General → Indents → Create Indent**.

1. **Add category**
   - Click **Add category**.
   - Enter a **new** category name (example: `Mobile`).
   - Save.

2. **Add item under that category**
   - Click **Add item**.
   - Choose category **`Mobile`**.
   - Enter item name (example: `iPhone Test SKU`) and serial/order fields as your form requires.
   - Save.

3. **Verify**
   - Confirm the new row appears in the table (use search if the list is long).
   - Optional: open **Create Indent** in another tab and confirm **`Mobile`** appears in the indent **category** dropdown and the new item appears when searching items for that category.

---

## C) (Recommended for GRN) Create inventory stock master for the same material

Indents use the **item catalog** for requisition lines. **Goods Receive (GRN)** ties receipts to **Procurement → Inventory** items (product codes / descriptions).

**Navigation:** `Procurement → Inventory → New`

- Create an inventory item that matches what you will receive (name/code aligned with your PO line / GRN line), **opening quantity `0`**, map **inventory / GRNI / COGS** (or **inventory category** defaults) per **Flow 1** section B.

Skip this only if you are testing **indent + quotation + PO paperwork** without posting a GRN yet.

---

## D) Create a full indent using the new catalog item

**Navigation:** `General → Indents → Create` (or **New Indent**)  
**URL:** `/general/indents/create`

1. Fill header fields: **title**, **department**, **required date**, **justification**, **priority**, etc.

2. **Item category**
   - Set **category** to **`Mobile`** (the one you added in the catalog).

3. **Line item**
   - **Add line** (if needed).
   - In the item field, **search** and select **`iPhone Test SKU`** (or type to match the catalog). The autocomplete loads from `/items` for the selected category.
   - Complete **description, brand, quantity, unit, purpose, estimated cost** as required by validation.

4. **Approval authorities** (draft routing)
   - Pick **three distinct approvers** (Head of Department, GM/PD, SVP/AVP) from the user search, **or** save as draft if your policy allows.

5. **Save**
   - **Save as draft** *or* **Submit for approval** (depending on what you are testing).

6. **Approvals**
   - From **Indents list** or **Indent detail**, complete each approval step until the indent is **approved** (or reaches the status your process uses before procurement).

**Expected:** Indent exists, shows your catalog item on the print view, and appears in procurement / store dashboards according to your workflow.

---

## E) Procurement chain (operational checklist)

Follow your live process; typical order:

| Step | Where (approx.) | Notes |
|------|-----------------|--------|
| 1 | **Quotations** | Invite vendors, enter prices against the indent requirement. |
| 2 | **Comparative / selection** | Finalize vendor selection per your rules. |
| 3 | **Purchase Order** | Create PO from quotation; complete **internal approvals** (audit / CEO / finance) until PO is approved. |
| 4 | **Goods Receive (GRN)** | `Procurement → Goods Receive` — receive against PO; use inventory item from **section C** for stock impact. |
| 5 | **Vendor bill / AP** | Per your module (Procurement bill after GRN, etc.). |
| 6 | **Payment** | **Flow 1** (after delivery) or **Flow 2** (advance) per scenario. |
| 7 | **Goods issue (SIN)** | If you allocate stock to project / cost. |

Use **Flow 1** for detailed **expected postings** (GRN, AP, payment, SIN) and **Flow 2** for **vendor advance** scenarios.

---

## F) Quick “smoke” checklist

- [ ] New **category** + **item** visible in **Item catalog**.
- [ ] Same **category** + **item** selectable on **Create Indent**.
- [ ] Indent **submits** and **approves** (or stays draft if testing draft-only).
- [ ] **Quotation → PO** can reference the same material description / quantities.
- [ ] **GRN** updates **Inventory** quantity when **section C** was done.
- [ ] Finance documents (journal / TB) match **Flow 1** or **Flow 2** expectations.

---

## G) Troubleshooting

| Issue | What to check |
|--------|----------------|
| Item not in indent search | Category on indent must **exactly match** catalog category; refresh page after saving catalog. |
| Indent validation errors | Required line fields (purpose, estimated cost, etc.) must be filled. |
| GRN does not move stock | Inventory master missing or product code / description mismatch vs PO line. |
| Wrong GL accounts | Chart of accounts, **Inventory categories** finance defaults, and **Flow 1** account mapping. |

---

## Related docs

- [manual-test-flow1-after-delivery-payment.md](./manual-test-flow1-after-delivery-payment.md) — GRN, AP, payment, SIN detail.
- [manual-test-flow2-payment-in-advance.md](./manual-test-flow2-payment-in-advance.md) — Vendor advance before GRN.
