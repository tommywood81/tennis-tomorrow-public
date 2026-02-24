# Cloudflare Setup Quick Checklist

Quick reference for setting up tennistomorrow.com with Cloudflare.

## Pre-Flight Checklist

Before starting, ensure you have:
- [ ] Cloudflare account created
- [ ] Domain registered and accessible
- [ ] SSH access to droplet (209.38.89.159)
- [ ] Docker containers running (frontend:3000, backend:8000)

---

## Cloudflare Dashboard Steps (5-10 minutes)

### 1. Add Domain to Cloudflare
- [ ] Login to Cloudflare dashboard
- [ ] Click "Add a Site"
- [ ] Enter `tennistomorrow.com`
- [ ] Select Free plan
- [ ] Note the nameservers provided

### 2. Update Nameservers at Registrar
- [ ] Go to domain registrar
- [ ] Replace nameservers with Cloudflare's
- [ ] Wait for propagation (1-24 hours, usually < 2 hours)

### 3. Configure DNS Records
- [ ] Go to Cloudflare → DNS → Records
- [ ] Create A record:
  - Name: `@` (or `tennistomorrow.com`)
  - IPv4: `209.38.89.159`
  - Proxy: **ON** (orange cloud 🟠)
- [ ] Create A record:
  - Name: `www`
  - IPv4: `209.38.89.159`
  - Proxy: **ON** (orange cloud 🟠)

### 4. Configure SSL/TLS
- [ ] Go to Cloudflare → SSL/TLS → Overview
- [ ] Set encryption mode to: **Full (strict)**
- [ ] Go to SSL/TLS → Edge Certificates
  - Enable "Always Use HTTPS"
  - Enable "Automatic HTTPS Rewrites"
  - Enable "HTTP/2"
  - Enable "TLS 1.3"

### 5. Generate Origin Certificate
- [ ] Go to Cloudflare → SSL/TLS → Origin Server
- [ ] Click "Create Certificate"
- [ ] Settings:
  - Private key type: RSA (2048)
  - Hostnames:
    - `tennistomorrow.com`
    - `*.tennistomorrow.com`
  - Validity: 15 years
- [ ] Click "Create"
- [ ] **COPY AND SAVE:**
  - Origin Certificate (full text)
  - Private Key (full text)
  - ⚠️ You won't see the private key again!

---

## Droplet Setup (10-15 minutes)

### Option A: Automated Script (Recommended)

```bash
# SSH to droplet
ssh root@209.38.89.159

# Navigate to project directory
cd /root/tennis-prediction

# Make script executable
chmod +x scripts/setup_cloudflare_domain.sh

# Run script (will prompt for certificate)
sudo ./scripts/setup_cloudflare_domain.sh
```

When prompted:
1. Paste the Origin Certificate (from Cloudflare)
2. Press Enter, then Ctrl+D (or blank line) to finish
3. Paste the Private Key
4. Press Enter, then Ctrl+D (or blank line) to finish

### Option B: Manual Setup

See full guide: `docs/CLOUDFLARE_SETUP.md`

---

## Verification (2-3 minutes)

### Quick Tests

```bash
# Test HTTP redirect
curl -I http://tennistomorrow.com
# Should return: HTTP/1.1 301 Moved Permanently

# Test HTTPS
curl -I https://tennistomorrow.com
# Should return: HTTP/2 200

# Test API
curl https://tennistomorrow.com/api/health
# Should return JSON response
```

### Browser Tests

- [ ] Visit `https://tennistomorrow.com` - works, shows 🔒
- [ ] Visit `https://www.tennistomorrow.com` - works, shows 🔒
- [ ] Visit `http://tennistomorrow.com` - redirects to HTTPS
- [ ] Check browser DevTools → Network → Headers
  - Should see `CF-Ray` header (confirms Cloudflare proxy)

### Cloudflare Verification

- [ ] DNS records show orange cloud (proxied)
- [ ] SSL/TLS mode shows "Full (strict)"
- [ ] Analytics show traffic (may take a few minutes)

---

## Optional: Firewall Setup

To restrict access to Cloudflare IPs only:

```bash
# Install ufw
apt install -y ufw

# Allow SSH (IMPORTANT - do first!)
ufw allow 22/tcp

# Allow Cloudflare IPs (see full guide for complete list)
ufw allow from 173.245.48.0/20 to any port 80,443 proto tcp
# ... (add all Cloudflare IP ranges - see full guide)

# Enable firewall
ufw enable
```

**Note:** This is optional. You can also just allow all traffic:
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SSL Error | Check certificate files in `/etc/nginx/ssl/` |
| 502 Bad Gateway | Check containers: `docker compose -f deploy_droplet.yml ps` |
| DNS Not Resolving | Wait for propagation, check nameservers |
| Mixed Content | Enable "Automatic HTTPS Rewrites" in Cloudflare |

See full troubleshooting in `docs/CLOUDFLARE_SETUP.md`

---

## Summary

✅ **What You Get:**
- HTTPS encryption (browser → Cloudflare → origin)
- DDoS protection via Cloudflare
- Global CDN (faster load times)
- Free SSL/TLS certificates
- Easy certificate management (15-year validity)

✅ **Security:**
- End-to-end encryption
- HSTS enabled
- Security headers configured
- Optional: Firewall restricts to Cloudflare IPs

✅ **Production Ready:**
- Follows industry best practices
- Scalable architecture
- Easy to maintain
- No application code changes needed

---

## Need Help?

- Full guide: `docs/CLOUDFLARE_SETUP.md`
- Nginx logs: `/var/log/nginx/tennistomorrow.com-error.log`
- Container logs: `docker compose -f deploy_droplet.yml logs`
