# Production database – collection analysis (do not delete, analysis only)

Based on your codebase, these are the collections your app uses and which are **likely unnecessary** or **optional** for freeing space. Check actual sizes in Atlas (Database → Browse Collections) before deciding.

---

## 1. **Best candidates to trim or drop (high growth, non‑critical)**

| Collection (Mongoose name → typical DB name) | Why it’s often unnecessary / heavy |
|---------------------------------------------|------------------------------------|
| **UserActivityLog** → `useractivitylogs` | Logs almost every request (create/read/update/delete, module, endpoint, IP). Grows very fast and was triggering "Error logging activity" when Atlas was full. **Safe to drop or trim to last 30–90 days** if you don’t rely on this for compliance. |
| **UserLoginLog** → `userloginlogs` | One document per login. Grows with every login. **Safe to trim** (e.g. keep last 90 days) or drop if you don’t need login history. |
| **AuditTrail** → `audittrails` | Used by Audit module and middleware for audit actions. Can get large. **Trim old records** (e.g. keep 1 year) if you need it; otherwise optional for core ERP. |

These three are the most likely to be eating space and are not required for login or day‑to‑day transactions.

---

## 2. **Module‑specific – only needed if you use that module**

If you **don’t** use a module, its collections are unnecessary in production.

- **Taj Residencia (property)**  
  All collections under `tajResidencia/`: `tajproperties`, `tajresidents`, `propertyinvoices`, `tajrentalagreements`, `tajtransactions`, `tajsectors`, `chargeslabs`, `camcharges`, `electricity`, `waterutilityslabs`, `complaints`, `negotiationbayanan`, `ownerduediligence`, `demarcations`, `khasramappings`, `recordverifications`, `landidentifications`, `tajrentalproperties`, `tajrentalmanagements`, `propertycounters`, `propertyreceipts`, `chargetypes`.  
  **Unnecessary** if you don’t use the Taj Residencia property/rental module.

- **IT module**  
  `passwordwallets`, `softwareinventories`, `itassets`, `contractrenewals`, `vendorcontracts`, `itvendors`, `incidentreports`, `devicelogs`, `networkdevices`, `licenseassignments`, `softwarevendors`, `assetmaintenancelogs`, `assetassignments`.  
  **Unnecessary** if you don’t use the IT assets/software module.

- **CRM module**  
  `contacts`, `leads`, `companies`, `opportunities`, `campaigns`.  
  **Unnecessary** if you don’t use CRM.

- **Sales module**  
  `salesorders`, `salesproducts`, `salescustomers`.  
  **Unnecessary** if you don’t use Sales.

- **ZKBioTime (biometric)**  
  `zkbiotimeemployees`, `zkbiotimeattendances` (from `zkbioTimeDatabaseService`).  
  **Unnecessary** if you don’t sync or use ZKBio Time; can be large if you do.

---

## 3. **Notifications**

- **Notification** → `notifications`  
  Used for in‑app notifications (e.g. candidate hired, payroll). Can grow. **Safe to trim** old read notifications (e.g. older than 6–12 months) if you don’t need long history.

---

## 4. **Core – do not drop**

These are required for login, HR, payroll, procurement, finance, etc. Do **not** delete them:

- `users`, `roles`, `subroles`, `usersubroles`
- `employees`, `departments`, `designations`, `positions`, `sections`, `companies`, `countries`, `provinces`, `cities`, `banks`, `qualifications`, `projects`, `documentmasters`, `leavetypes`, `leavepolicies`, `attendances`, `leavebalances`, `leaverequests`, `annualleavebalances`, `leavetransactions`, `payrolls`, `loans`, `payslips`, `jobpostings`, `candidates`, `applications`, `candidateapprovals`, `enrollments`, `trainingprograms`, `courses`, `events`, `eventparticipants`, `notifications` (if you use them), `suppliers`, `vehicles`, `vehiclelogbooks`, `vehiclemaintenances`, `evaluationdocuments`, `evaluationdocumenttrackings`, `approvallevelconfigurations`, `evaluationlevel0authorities`, `documentmovements`, `staffassignments`, `genericstaffassignments`, `stafftypes`, `pettycashfunds`, `pettycashexpenses`, `utilitybills`, `employeeincrements`, `finalsettlements`, `employeeonboardings`, `joiningdocuments`, `biometricintegrations`, `fbrtaxslabs`, `groceryitems`, `rentalagreements`, `rentalmanagements`
- `indents`, `purchaseorders`, `quotations`, `quotationinvitations`, `inventories`, `goodsreceives`, `goodsissues`, `costcenters`, `preaudits`
- `accounts`, `journalentries`, `generalledgers`, `accountspayable`, `accountsreceivable`, `bankings`
- `audits`, `auditschedules`, `auditchecklists`, `auditfindings`, `correctiveactions`
- `paymentsettlements`
- `recoverymembers`, `recoveryassignments`

---

## 5. **Suggested order of action (to free space)**

1. In Atlas, **check collection sizes** (Database → Browse Collections or Metrics).
2. **Trim or drop** (in this order if they exist and are large):
   - `useractivitylogs` (or trim to last 30–90 days).
   - `userloginlogs` (or trim to last 90 days).
   - `audittrails` (trim old records if you need to keep some).
   - `notifications` (trim old/read notifications).
3. If you don’t use **Taj Residencia**, **IT**, **CRM**, or **Sales**, consider dropping those modules’ collections only after confirming in the app and taking a backup.
4. **Do not delete** any collection in the “Core” list above without a full backup and migration plan.

---

*This is an analysis only. No data was deleted. Verify collection names and sizes in your Atlas project before making changes.*
