# 🚀 SGC ERP Deployment Guide to DigitalOcean

This guide will walk you through deploying your MERN stack ERP system to a DigitalOcean droplet.

## 📋 Prerequisites

- A DigitalOcean droplet with Ubuntu 20.04+ 
- Domain name pointing to your droplet
- SSH access to your droplet
- MongoDB Atlas database (or local MongoDB)

## 🔧 Server Setup

### 1. Connect to Your Droplet
```bash
ssh root@YOUR_DROPLET_IP
```

### 2. Update System
```bash
apt update && apt upgrade -y
```

### 3. Install Node.js 18+
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
```

### 4. Install PM2 (Process Manager)
```bash
npm install -g pm2
pm2 startup
```

### 5. Install Nginx
```bash
apt install nginx -y
systemctl enable nginx
systemctl start nginx
```

### 6. Install Certbot (for SSL)
```bash
apt install certbot python3-certbot-nginx -y
```

## 📁 Project Deployment

### Option 1: Automated Deployment (Recommended)
1. Update the `deploy.sh` script with your server details
2. Make it executable: `chmod +x deploy.sh`
3. Run: `./deploy.sh`

### Option 2: Manual Deployment
1. **Build React App**
   ```bash
   cd client
   npm run build
   cd ..
   ```

2. **Upload to Server**
   ```bash
   scp -r . root@YOUR_DROPLET_IP:/var/www/sgc-erp/
   ```

3. **Install Dependencies on Server**
   ```bash
   ssh root@YOUR_DROPLET_IP
   cd /var/www/sgc-erp
   npm install --production
   cd client && npm install --production && cd ..
   ```

## ⚙️ Configuration

### 1. Environment Variables
Create `.env` file on server:
```bash
cp env.production.example .env
nano .env
```

**Important variables to update:**
- `MONGODB_URI`: Your production MongoDB connection string
- `JWT_SECRET`: Strong, unique secret key
- `CORS_ORIGIN`: Your domain (e.g., `https://yourdomain.com`)
- `FRONTEND_URL`: Your domain URL

### 2. Nginx Configuration
1. Copy `nginx.conf` to server
2. Update domain name in the config
3. Place in `/etc/nginx/sites-available/sgc-erp`
4. Enable site:
   ```bash
   ln -s /etc/nginx/sites-available/sgc-erp /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx
   ```

### 3. PM2 Configuration
1. Copy `ecosystem.config.js` to server
2. Start application:
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

## 🔒 SSL Certificate Setup

### Using Let's Encrypt
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Auto-renewal
```bash
crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## 🌐 Domain Configuration

1. **Point Domain to Droplet**
   - Add A record: `@` → `YOUR_DROPLET_IP`
   - Add A record: `www` → `YOUR_DROPLET_IP`

2. **Update CORS and Frontend URLs**
   - Update `.env` file
   - Update `nginx.conf`
   - Restart services

## 🔄 Deployment Process

### Initial Deployment
```bash
# On your local machine
./deploy.sh
```

### Subsequent Updates
```bash
# Build and deploy
npm run build
./deploy.sh
```

### Manual Server Restart
```bash
# SSH into server
ssh root@YOUR_DROPLET_IP

# Restart services
pm2 restart sgc-erp-backend
systemctl reload nginx
```

## 📊 Monitoring & Maintenance

### PM2 Commands
```bash
pm2 status          # Check process status
pm2 logs            # View logs
pm2 monit           # Monitor processes
pm2 restart all     # Restart all processes
```

### Nginx Commands
```bash
nginx -t            # Test configuration
systemctl reload nginx    # Reload configuration
systemctl restart nginx   # Restart service
```

### Log Files
- Application logs: `/var/www/sgc-erp/logs/`
- Nginx logs: `/var/log/nginx/`
- PM2 logs: `pm2 logs`

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   netstat -tulpn | grep :5001
   kill -9 PID
   ```

2. **Permission Issues**
   ```bash
   chown -R $USER:$USER /var/www/sgc-erp
   chmod -R 755 /var/www/sgc-erp
   ```

3. **Nginx Configuration Error**
   ```bash
   nginx -t
   # Fix any syntax errors
   systemctl reload nginx
   ```

4. **PM2 Process Not Starting**
   ```bash
   pm2 delete all
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

### Health Checks
- Backend: `https://yourdomain.com/api/health`
- Frontend: `https://yourdomain.com`
- WebSocket: Check browser console for connection status

## 🔐 Security Considerations

1. **Firewall Setup**
   ```bash
   ufw allow ssh
   ufw allow 'Nginx Full'
   ufw enable
   ```

2. **Regular Updates**
   ```bash
   apt update && apt upgrade -y
   npm update -g pm2
   ```

3. **Backup Strategy**
   - Database backups
   - File uploads backup
   - Configuration backup

## 📞 Support

If you encounter issues:
1. Check logs: `pm2 logs` and `/var/log/nginx/`
2. Verify configuration files
3. Check firewall and port settings
4. Ensure all services are running

## 🎯 Next Steps

After successful deployment:
1. Test all major functionality
2. Set up monitoring and alerts
3. Configure automated backups
4. Set up CI/CD pipeline for future deployments
5. Monitor performance and optimize as needed

---

**Happy Deploying! 🚀**
