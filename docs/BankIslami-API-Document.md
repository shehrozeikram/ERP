# Company LOGO

## Introduction
This document defines the API integration for BankIslami bill inquiry and payment posting with Tovus ERP (Taj Utilities and Charges module).

## Purpose
To enable BankIslami channels (mobile app, internet banking, etc.) to:
- inquire unpaid customer vouchers/invoices, and
- post payment confirmation to Tovus ERP for automatic invoice settlement.

## Scope
- Inquiry of unpaid invoices against customer reference number.
- Payment posting for successful transactions.
- Real-time update of invoice payment status in ERP.

---

## Inquiry URL
`https://tovus.net/api/bank-islamic/inquiry`

### Method
`POST`

### Request Parameters
```json
{
  "user": "abc",
  "password": "abc",
  "referenceNo": "xxx"
}
```

### Responses

#### Unpaid - Success (HTTP Status Code: 200)
```json
{
  "code": 0,
  "message": "Success!",
  "data": [
    {
      "referenceNo": "xxxx",
      "customer": "xxxx",
      "issueDate": "12/Nov/2023",
      "dueDate": "25/Nov/2023",
      "amountDueDate": "xxxx",
      "amountAfterDate": "xxxx",
      "status": "U"
    }
  ]
}
```

#### Voucher Already Paid (HTTP Status Code: 200)
```json
{
  "code": 1,
  "message": "Voucher already Paid!"
}
```

#### Voucher Invalid (HTTP Status Code: 200)
```json
{
  "code": 2,
  "message": "Voucher is Invalid!"
}
```

#### Voucher Expired (HTTP Status Code: 200)
```json
{
  "code": 3,
  "message": "Voucher Expired!"
}
```

---

## Payment URL
`https://tovus.net/api/bank-islamic/payment`

### API For Payment Posting (HTTP Status Code: 200)
### Method
`POST`

### Request
```json
{
  "user": "abc",
  "password": "abc",
  "referenceNo": "xxxx",
  "amount": "xxx",
  "status": "P",
  "receivedDate": "12/Nov/2023",
  "transactionId": "xxxx"
}
```

### Response: Payment API
```json
{
  "code": 0,
  "message": "Voucher Successfully Post"
}
```

---

## Status / Code Mapping
- `code: 0` = Success
- `code: 1` = Voucher already paid
- `code: 2` = Voucher invalid
- `code: 3` = Voucher expired

---

## Sample Voucher Numbers Required (For UAT)
- Unpaid (15 Voucher)
- Paid (15 Voucher)

---

## Notes
- `referenceNo` is the customer voucher/invoice reference.
- `status` in payment request must be `"P"` for successful payment posting.
- Duplicate payment posting with same `transactionId` is handled safely (idempotent behavior).
