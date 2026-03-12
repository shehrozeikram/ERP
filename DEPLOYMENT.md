# SGC ERP – Production Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- MongoDB (Atlas or self-hosted)
- Domain: `https://tovus.net` (configured for production)
- SSL certificate (via nginx/cloudflare or hosting provider)

---

## 1. Environment Variables

On your production server, create `.env` from the template:

```bash
cp .env.production.example .env
```

Edit `.env` and set:

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | Must be `production` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Strong random string (32+ chars) |
| `FRONTEND_URL` | Yes | `https://tovus.net` |
| `WHATSAPP_ACCESS_TOKEN` | For recovery | Meta Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | For recovery | `962045766999656` (Taj-official) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | For webhook | `sgc_whatsapp_verify_2025` (or your choice) |
| `SMTP_*` | For emails | HR emails, approvals, etc. |

---

## 2. Build & Start

```bash
# Install dependencies
npm run install-all

# Build React frontend
npm run build

# Start server (production mode)
npm run start:prod
# or: NODE_ENV=production node server/index.js
```

---

## 3. Reverse Proxy (nginx)

Example nginx config for `https://tovus.net`:

```nginx
server {
    listen 443 ssl http2;
    server_name tovus.net www.tovus.net;
    
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /uploads {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
    }
    
    client_max_body_size 50M;
}
```

---

## 4. Meta WhatsApp Webhook

1. Go to [Meta for Developers](https://developers.facebook.com/) → Your App → WhatsApp → Configuration.
2. Set **Callback URL**: `https://tovus.net/api/webhooks/whatsapp`
3. Set **Verify token**: same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env` (e.g. `sgc_whatsapp_verify_2025`).
4. Subscribe to **messages**.
5. Save. Meta will verify by calling your GET endpoint.

---

## 5. Process Manager (recommended)

Use PM2 for auto-restart and logs:

```bash
npm install -g pm2
pm2 start server/index.js --name sgc-erp
pm2 save
pm2 startup
```

Ensure `.env` has `NODE_ENV=production`.

---

## 6. Verification

- `https://tovus.net/api/health` → `{"status":"OK"}`
- Log in at `https://tovus.net`
- WhatsApp webhook: send test message and check Meta dashboard / app logs

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| CORS errors | Add your domain to `CORS_ORIGIN` (comma-separated) in `.env` |
| 401 on login | Check `JWT_SECRET` is set and stable across restarts |
| WhatsApp not receiving | Confirm webhook URL, verify token, and SSL; check server logs |
| Rate limit (429) | Adjust `RATE_LIMIT_MAX_REQUESTS` / `LOGIN_RATE_LIMIT_MAX` in `.env` if needed |
