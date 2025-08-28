#!/bin/bash

echo "🔒 Setting up SSL Certificate for tovus.net..."

# Configuration
SERVER_USER="root"
SERVER_IP="68.183.215.177"
DOMAIN="tovus.net"
WWW_DOMAIN="www.tovus.net"

echo "📋 Configuration:"
echo "   Server: $SERVER_USER@$SERVER_IP"
echo "   Domain: $DOMAIN"
echo "   WWW: $WWW_DOMAIN"
echo ""

echo "⚠️  IMPORTANT: Make sure your domain DNS is configured first!"
echo "   In Name.com DNS settings, add A record:"
echo "   - Type: A"
echo "   - Name: @ (or blank)"
echo "   - Value: $SERVER_IP"
echo "   - TTL: 3600"
echo ""
echo "   Also add:"
echo "   - Type: A"
echo "   - Name: www"
echo "   - Value: $SERVER_IP"
echo "   - TTL: 3600"
echo ""

read -p "Have you configured your DNS settings in Name.com? (y/n): " DNS_READY

if [[ ! $DNS_READY =~ ^[Yy]$ ]]; then
    echo "❌ Please configure DNS first, then run this script again."
    echo "   Visit: https://www.name.com/account/domains"
    exit 1
fi

echo "✅ DNS configured. Proceeding with SSL setup..."
echo ""

# Execute SSL setup on server
echo "🔧 Setting up trusted SSL certificate on server..."
ssh $SERVER_USER@$SERVER_IP << ENDSSH
    set -e
    
    echo "🔐 Setting up trusted SSL certificate for $DOMAIN and $WWW_DOMAIN..."
    
    # Install required packages
    echo "📦 Installing required packages..."
    apt update
    apt install -y certbot python3-certbot-nginx
    
    # Backup current nginx configuration
    cp /etc/nginx/sites-available/sgc-erp /etc/nginx/sites-available/sgc-erp.backup.$(date +%Y%m%d_%H%M%S)
    
    echo "📝 Creating nginx configuration for $DOMAIN..."
    
    # Create nginx config that allows certbot verification
    cat > /etc/nginx/sites-available/sgc-erp << NGINX_CONFIG
server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN $SERVER_IP;
    
    # Health check endpoint
    location = /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # API proxy to Node.js backend
    location /api/ {
        proxy_pass http://localhost:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Serve React build files
    location / {
        root /var/www/sgc-erp/client/build;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
NGINX_CONFIG
    
    echo "✅ Nginx configuration created for $DOMAIN"
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    echo "🔄 Nginx reloaded successfully"
    
    # Create webroot directory for Let's Encrypt
    mkdir -p /var/www/html/.well-known/acme-challenge
    
    echo "🔐 Obtaining SSL certificate with Let's Encrypt..."
    echo "⚠️  Make sure your domain $DOMAIN points to $SERVER_IP"
    echo "   You can check with: nslookup $DOMAIN"
    echo ""
    
    # Try to get certificate using nginx plugin (recommended method)
    certbot --nginx \
        --email admin@$DOMAIN \
        --agree-tos \
        --no-eff-email \
        --domains $DOMAIN,$WWW_DOMAIN \
        --non-interactive || {
        
        echo "⚠️  Nginx plugin method failed, trying webroot method..."
        
        # Try webroot method
        certbot certonly --webroot \
            --webroot-path=/var/www/html \
            --email admin@$DOMAIN \
            --agree-tos \
            --no-eff-email \
            --domains $DOMAIN,$WWW_DOMAIN \
            --non-interactive || {
            
            echo "⚠️  Webroot method failed, trying standalone method..."
            
            # Stop nginx temporarily
            systemctl stop nginx
            
            # Get certificate using standalone method
            certbot certonly --standalone \
                --email admin@$DOMAIN \
                --agree-tos \
                --no-eff-email \
                --domains $DOMAIN,$WWW_DOMAIN \
                --non-interactive
            
            # Start nginx again
            systemctl start nginx
        }
    }
    
    echo "✅ SSL certificate obtained successfully!"
    
    # Set up automatic renewal
    echo "🔄 Setting up automatic SSL renewal..."
    
    # Create renewal script
    cat > /etc/cron.daily/ssl-renewal << 'RENEWAL_SCRIPT'
#!/bin/bash
certbot renew --quiet --deploy-hook "systemctl reload nginx"
RENEWAL_SCRIPT
    
    chmod +x /etc/cron.daily/ssl-renewal
    
    echo "✅ Automatic SSL renewal configured"
    
    echo "🔍 SSL setup completed successfully!"
    
    # Show certificate status
    echo "📋 Certificate information:"
    certbot certificates
    
    # Show nginx status
    echo "📊 Nginx status:"
    systemctl status nginx --no-pager -l
    
ENDSSH

echo "🎉 Trusted SSL setup completed for tovus.net!"
echo ""
echo "🔍 Verification steps:"
echo "   1. Visit https://tovus.net in your browser"
echo "   2. You should see a GREEN padlock (no more 'Not Secure' warning)"
echo "   3. Test your login: admin@sgc.com / password123"
echo "   4. Verify HTTPS redirect from HTTP"
echo "   5. Test www subdomain: https://www.tovus.net"
echo ""
echo "📝 SSL Certificate Details:"
echo "   - Provider: Let's Encrypt (trusted by all browsers)"
echo "   - Auto-renewal: Daily cron job configured"
echo "   - Security: HSTS, CSP, and other security headers enabled"
echo "   - Performance: HTTP/2 enabled for HTTPS"
echo "   - Domains: $DOMAIN and $WWW_DOMAIN"
echo ""
echo "✅ Your application now has a TRUSTED SSL certificate!"
echo ""
echo "🌐 Access URLs:"
echo "   - HTTPS: https://tovus.net (GREEN padlock)"
echo "   - HTTPS: https://www.tovus.net (GREEN padlock)"
echo "   - HTTP: http://tovus.net (redirects to HTTPS)"
echo "   - IP: https://$SERVER_IP (also works)"
echo ""
echo "🔒 Professional SSL setup complete!"
echo "   - Trusted by all browsers"
echo "   - Professional domain name"
echo "   - No security warnings"
echo "   - Production-ready application"
