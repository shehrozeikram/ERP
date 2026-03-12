# WhatsApp Recovery – Webhook & Local Testing Setup

## 1. Webhook URL (paste in Meta)

| Environment | Webhook URL |
|-------------|-------------|
| **Production** (tovus.net) | `https://tovus.net/api/webhooks/whatsapp` |
| **Local (via ngrok)** | `https://YOUR_NGROK_URL/api/webhooks/whatsapp` |

> Meta cannot reach `localhost`. For local testing you must use a tunnel (ngrok).

---

## 2. Verify Token (paste in Meta)

Use this value in Meta’s webhook configuration:

```
sgc_whatsapp_verify_2025
```

It must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env`.

---

## 3. Local Testing – Step by Step

### A. Prerequisites

1. **ngrok** installed: https://ngrok.com/download  
2. Server runs on port **5001** (from `.env`)

### B. Steps

**Step 1: Start the app**

```bash
npm run dev
```

(or run server and client separately)

**Step 2: Start ngrok (in a new terminal)**

```bash
ngrok http 5001
```

You’ll see something like:

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:5001
```

**Step 3: Use the ngrok URL as webhook**

Copy the `https://` URL (e.g. `https://abc123.ngrok-free.app`) and build the webhook URL:

```
https://abc123.ngrok-free.app/api/webhooks/whatsapp
```

**Step 4: Configure Meta**

1. Open [Meta for Developers](https://developers.facebook.com/) → your app
2. Go to **WhatsApp** → **Configuration**
3. Under **Webhook**:
   - **Callback URL**: `https://YOUR_NGROK_URL/api/webhooks/whatsapp`
   - **Verify token**: `sgc_whatsapp_verify_2025`
4. Click **Verify and save**
5. Subscribe to **messages**

**Step 5: Test verification (optional)**

```bash
curl "http://localhost:5001/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=sgc_whatsapp_verify_2025&hub.challenge=test123"
```

Expected: response body is `test123`.

**Step 6: Test receiving messages**

1. Add `923214554035` (or your number) as a test recipient in Meta → WhatsApp → API Setup
2. Send a message from that number to your WhatsApp Business number
3. Check server logs for: `[WhatsApp Incoming] { from, id, type, text }`
4. In Recovery module: **My Tasks** or **Recovery Assignments** → click **Chat** on that row → see the message

---

## 4. Recovery Module Checklist

| Feature | Location | Status |
|---------|----------|--------|
| Send WhatsApp (taj_discount template) | My Tasks → Send WhatsApp → Send message | Done |
| Send test from Campaigns | Campaigns → green Send icon | Done |
| View incoming replies | My Tasks / Recovery Assignments → Chat icon | Done |
| Badge for rows with messages | Green dot on Chat icon when messages exist | Done |
| Webhook receive & store | `POST /api/webhooks/whatsapp` | Done |
| Webhook verification | `GET /api/webhooks/whatsapp` | Done |

---

## 5. Production (tovus.net) – Live Setup

### A. Callback URL (paste in Meta)

```
https://tovus.net/api/webhooks/whatsapp
```

### B. Meta configuration

1. Meta for Developers → **Taj-official** app → **WhatsApp** → **Configuration**
2. Webhook:
   - **Callback URL:** `https://tovus.net/api/webhooks/whatsapp`
   - **Verify token:** `sgc_whatsapp_verify_2025`
3. Click **Verify and save**
4. Subscribe to **messages**

### C. Production `.env`

On the production server (tovus.net), ensure these are set:

```
WHATSAPP_ACCESS_TOKEN=<token from Taj-official app → Generate access token>
WHATSAPP_PHONE_NUMBER_ID=962045766999656
WHATSAPP_WEBHOOK_VERIFY_TOKEN=sgc_whatsapp_verify_2025
```

- `WHATSAPP_ACCESS_TOKEN`: From Meta → Taj-official → WhatsApp → API Setup → Generate access token (or use a long‑lived token)
- `WHATSAPP_PHONE_NUMBER_ID`: `962045766999656` for Taj-official
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Must match the value in Meta webhook settings

### D. Checklist

- [ ] App deployed and reachable at `https://tovus.net`
- [ ] Webhook Callback URL updated in Meta
- [ ] Production `.env` has correct token and phone number ID
- [ ] Server restarted after `.env` change

---

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| Verification fails | Check verify token matches `.env` |
| No incoming messages | Confirm webhook subscribed to **messages** |
| Meta cannot reach URL | For local: use ngrok; ensure URL is HTTPS and public |
| Badge not showing | Ensure webhook is receiving and saving; refresh page |
