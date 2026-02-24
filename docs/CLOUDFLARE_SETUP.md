# Cloudflare + Domain Setup Guide for tennistomorrow.com

This guide walks through setting up `tennistomorrow.com` with Cloudflare DNS, SSL/TLS, and Nginx reverse proxy.

## Prerequisites

- Domain: `tennistomorrow.com` registered at a domain registrar
- Cloudflare account (free tier works)
- Droplet IP: `209.38.89.159`
- SSH access to the droplet as root

---

## Part 1: Cloudflare DNS Configuration

### Step 1: Add Domain to Cloudflare

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **"Add a Site"**
3. Enter `tennistomorrow.com`
4. Select **Free** plan
5. Review DNS records (Cloudflare will auto-detect existing records)
6. Continue through the setup

### Step 2: Update Nameservers at Registrar

Cloudflare will provide you with 2 nameservers (e.g.):
- `hannah.ns.cloudflare.com`
- `will.ns.cloudflare.com`

**At your domain registrar:**
1. Go to DNS/Nameserver settings
2. Replace existing nameservers with Cloudflare's nameservers
3. Save changes

**Wait for propagation:** This can take 24-48 hours, but usually completes in 1-2 hours.

### Step 3: Configure DNS Records in Cloudflare

Once nameservers are updated:

1. Go to **DNS → Records** in Cloudflare dashboard
2. Delete any existing A records for `tennistomorrow.com` or `www`
3. Add these records:

   **A Record (Apex Domain):**
   - **Type:** A
   - **Name:** `tennistomorrow.com` (or `@`)
   - **IPv4 address:** `209.38.89.159`
   - **Proxy status:** ✅ **Proxied** (orange cloud ON)
   - **TTL:** Auto

   **A Record (WWW):**
   - **Type:** A
   - **Name:** `www`
   - **IPv4 address:** `209.38.89.159`
   - **Proxy status:** ✅ **Proxied** (orange cloud ON)
   - **TTL:** Auto

4. Click **Save**

**Important:** Ensure the orange cloud (🚧) is ON (proxied) for both records. This enables Cloudflare's proxy, DDoS protection, and SSL.

---

## Part 2: Cloudflare SSL/TLS Configuration

### Step 4: Configure SSL Mode

1. Go to **SSL/TLS → Overview**
2. Set **SSL/TLS encryption mode** to: **Full (strict)**
   - This ensures encrypted traffic from Cloudflare to your origin server
3. Click **Save**

### Step 5: Enable Security Features

Go to **SSL/TLS → Edge Certificates:**

- ✅ **Always Use HTTPS** - ON
- ✅ **Automatic HTTPS Rewrites** - ON
- ✅ **HTTP/2** - ON (usually enabled by default)
- ✅ **HTTP/3 (with QUIC)** - ON (optional but recommended)
- ✅ **0-RTT Connection Resumption** - ON (optional)
- ✅ **TLS 1.3** - ON (default)

Go to **Speed → Optimization:**
- ✅ **Brotli** - ON (compression)

### Step 6: Generate Cloudflare Origin Certificate

1. Go to **SSL/TLS → Origin Server**
2. Click **Create Certificate**
3. Configure:
   - **Private key type:** RSA (2048)
   - **Hostnames:** 
     - `tennistomorrow.com`
     - `*.tennistomorrow.com` (wildcard for www)
   - **Certificate Validity:** 15 years (max)
4. Click **Create**
5. **Save both:**
   - **Origin Certificate** (the .pem file) - Copy this
   - **Private Key** (the .key file) - Copy this

**⚠️ IMPORTANT:** You won't be able to see the private key again. Save it securely!

**You'll need these files for the Nginx configuration on your droplet.**

---

## Part 3: Droplet Configuration

### Step 7: Install Nginx (if not already installed)

SSH into your droplet:
```bash
ssh root@209.38.89.159
```

Check if nginx is installed:
```bash
which nginx
```

If not installed:
```bash
apt update
apt install -y nginx
```

### Step 8: Create Directory for SSL Certificates

```bash
mkdir -p /etc/nginx/ssl
chmod 700 /etc/nginx/ssl
```

### Step 9: Install Cloudflare Origin Certificate

Create the certificate file:
```bash
nano /etc/nginx/ssl/cloudflare-origin.crt
```

Paste the **Origin Certificate** content (from Step 6), then save (Ctrl+O, Enter, Ctrl+X).

Create the private key file:
```bash
nano /etc/nginx/ssl/cloudflare-origin.key
```

Paste the **Private Key** content (from Step 6), then save.

Set proper permissions:
```bash
chmod 600 /etc/nginx/ssl/cloudflare-origin.key
chmod 644 /etc/nginx/ssl/cloudflare-origin.crt
```

### Step 10: Create Nginx Configuration

Create the site configuration:
```bash
nano /etc/nginx/sites-available/tennistomorrow.com
```

Paste the following configuration:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name tennistomorrow.com www.tennistomorrow.com;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tennistomorrow.com www.tennistomorrow.com;

    # SSL Configuration (Cloudflare Origin Certificate)
    ssl_certificate /etc/nginx/ssl/cloudflare-origin.crt;
    ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Real IP from Cloudflare (for accurate client IPs)
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    set_real_ip_from 2400:cb00::/32;
    set_real_ip_from 2606:4700::/32;
    set_real_ip_from 2803:f800::/32;
    set_real_ip_from 2405:b500::/32;
    set_real_ip_from 2405:8100::/32;
    set_real_ip_from 2a06:98c0::/29;
    set_real_ip_from 2c0f:f248::/32;
    real_ip_header CF-Connecting-IP;

    # Logging
    access_log /var/log/nginx/tennistomorrow.com-access.log;
    error_log /var/log/nginx/tennistomorrow.com-error.log;

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_set_header CF-Ray $http_cf_ray;
        proxy_set_header CF-Visitor $http_cf_visitor;
        
        # Timeouts
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        send_timeout 300s;
    }

    # Frontend (React app)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_set_header CF-Ray $http_cf_ray;
        proxy_set_header CF-Visitor $http_cf_visitor;
        
        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save and exit (Ctrl+O, Enter, Ctrl+X).

### Step 11: Enable the Site

```bash
# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Enable our site
ln -sf /etc/nginx/sites-available/tennistomorrow.com /etc/nginx/sites-enabled/

# Test configuration
nginx -t
```

If test passes, reload nginx:
```bash
systemctl reload nginx
```

---

## Part 4: Firewall Configuration (Optional but Recommended)

### Step 12: Restrict Ports to Cloudflare IPs Only

This ensures only Cloudflare can reach your server directly.

**Install ufw if not installed:**
```bash
apt install -y ufw
```

**Allow SSH (important - do this first!):**
```bash
ufw allow 22/tcp
```

**Allow HTTP/HTTPS from Cloudflare IPs only:**
```bash
# Allow Cloudflare IPv4 ranges
ufw allow from 173.245.48.0/20 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 103.21.244.0/22 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 103.22.200.0/22 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 103.31.4.0/22 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 141.101.64.0/18 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 108.162.192.0/18 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 190.93.240.0/20 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 188.114.96.0/20 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 197.234.240.0/22 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 198.41.128.0/17 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 162.158.0.0/15 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 104.16.0.0/13 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 104.24.0.0/14 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 172.64.0.0/13 to any port 80,443 proto tcp comment 'Cloudflare'
ufw allow from 131.0.72.0/22 to any port 80,443 proto tcp comment 'Cloudflare'

# Enable firewall
ufw enable
```

**Check status:**
```bash
ufw status verbose
```

**Note:** If you want to allow direct access (for testing), you can skip this step or add:
```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

---

## Part 5: Verification

### Step 13: Test from Command Line

**Test HTTP redirect:**
```bash
curl -I http://tennistomorrow.com
# Should return: HTTP/1.1 301 Moved Permanently
```

**Test HTTPS:**
```bash
curl -I https://tennistomorrow.com
# Should return: HTTP/2 200
```

**Test backend API:**
```bash
curl https://tennistomorrow.com/api/health
# Should return API response
```

### Step 14: Verify in Browser

1. Visit `https://tennistomorrow.com`
2. Check browser address bar - should show 🔒 (secure)
3. Visit `https://www.tennistomorrow.com` - should work
4. Visit `http://tennistomorrow.com` - should redirect to HTTPS
5. Open Developer Tools → Network tab → Check request headers
   - Should see `CF-Ray` header (indicates Cloudflare proxy is active)

### Step 15: Verify Cloudflare Proxy

1. In Cloudflare dashboard: **SSL/TLS → Overview**
   - SSL mode should show: **Full (strict)**
2. **DNS → Records**
   - Both A records should show orange cloud 🟠 (Proxied)
3. Test with `dig`:
   ```bash
   dig tennistomorrow.com
   # Should return Cloudflare IPs (not your droplet IP directly)
   ```

---

## Troubleshooting

### Issue: SSL Certificate Error

**Solution:**
- Verify certificate files are in `/etc/nginx/ssl/`
- Check file permissions: `ls -la /etc/nginx/ssl/`
- Verify certificate content: `openssl x509 -in /etc/nginx/ssl/cloudflare-origin.crt -text -noout`

### Issue: 502 Bad Gateway

**Solution:**
- Check if Docker containers are running: `docker compose -f deploy_droplet.yml ps`
- Check nginx error log: `tail -f /var/log/nginx/tennistomorrow.com-error.log`
- Verify ports 3000 and 8000 are listening: `netstat -tlnp | grep -E '3000|8000'`

### Issue: DNS Not Resolving

**Solution:**
- Verify nameservers at registrar match Cloudflare
- Wait for DNS propagation (can take up to 48 hours)
- Check DNS propagation: `dig tennistomorrow.com @8.8.8.8`

### Issue: Mixed Content Warnings

**Solution:**
- Ensure all API calls use HTTPS
- Check browser console for HTTP resources
- Enable "Automatic HTTPS Rewrites" in Cloudflare

---

## Maintenance

### Certificate Renewal

Cloudflare Origin Certificates last 15 years. When they expire:
1. Generate a new certificate in Cloudflare dashboard
2. Replace files in `/etc/nginx/ssl/`
3. Reload nginx: `systemctl reload nginx`

### Updating Cloudflare IP Ranges

Cloudflare occasionally updates their IP ranges. Check:
- https://www.cloudflare.com/ips/
- Update firewall rules if needed

---

## Summary Checklist

- [ ] Domain added to Cloudflare
- [ ] Nameservers updated at registrar
- [ ] DNS A records created (apex and www) with proxy ON
- [ ] SSL mode set to "Full (strict)" in Cloudflare
- [ ] Cloudflare Origin Certificate generated and saved
- [ ] Certificate and key installed on droplet
- [ ] Nginx configuration created and enabled
- [ ] Nginx test passed and reloaded
- [ ] Firewall configured (optional)
- [ ] HTTPS working in browser
- [ ] HTTP redirects to HTTPS
- [ ] Both apex and www domains work
- [ ] Backend API accessible via HTTPS
- [ ] Cloudflare proxy active (orange cloud visible)

---

## Security Notes

✅ **What's Secured:**
- Browser → Cloudflare: Encrypted (Cloudflare's SSL)
- Cloudflare → Origin: Encrypted (Origin Certificate)
- DDoS protection via Cloudflare
- Optional: Firewall restricts access to Cloudflare IPs only

✅ **Best Practices Applied:**
- HTTPS enforced (HTTP redirects)
- HSTS header enabled
- Security headers (X-Frame-Options, etc.)
- Real IP forwarding from Cloudflare
- TLS 1.3 support

This setup is production-grade and follows industry best practices for small-to-medium SaaS applications.
