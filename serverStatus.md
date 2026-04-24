PROJECT STATUS – VELVE BACKEND (FINAL VERIFIED STATE)

---

1. SERVER ENVIRONMENT

* OS: Ubuntu 22.04.5 LTS
* Server is behind CGNAT (no direct public port access)
* Public access handled via Cloudflare Tunnel

---

2. RUNNING SERVICES (PM2)

* velve-api (Node.js API)

  * Port: 3000
  * Status: ONLINE
  * Memory: ~100MB
  * Health endpoint: /ping → {"status":200,"message":"Velve API running"}

* velve-ai (FastAPI AI server)

  * Port: 8000
  * Status: ONLINE
  * Memory: ~98MB
  * Health endpoint: /ping → {"status":"ok","message":"Velve AI server running"}

PM2:

* Both processes running
* Auto-restart enabled
* pm2 save executed

---

3. CLOUDFLARE TUNNEL

* Tunnel name: velve-api
* Tunnel ID: d32e8bf9-e9d1-4ab7-9e8e-8072b5a9c758
* Running via systemd (cloudflared.service)
* Status: ACTIVE (healthy connections established)

Ingress routing:

* api.velveapp.com → http://localhost:3000 (Node API)
* ai.velveapp.com → http://localhost:8000 (AI server)

---

4. DOMAIN & DNS

* Domain: velveapp.com
* DNS provider: Cloudflare
* Nameservers:

  * lou.ns.cloudflare.com
  * rachel.ns.cloudflare.com

DNS records:

* api.velveapp.com → proxied via Cloudflare Tunnel
* ai.velveapp.com → proxied via Cloudflare Tunnel

Global DNS resolution confirmed via:

* dig @1.1.1.1 → returns Cloudflare IPs

---

5. PUBLIC ACCESS VERIFICATION

Verified via direct Cloudflare edge resolution:

* https://ai.velveapp.com/ping → {"status":"ok","message":"Velve AI server running"}
* https://api.velveapp.com/ping → {"status":200,"message":"Velve API running"}

Mobile network test: both endpoints confirmed working via HTTPS

---

6. NETWORK BEHAVIOR

* Local server curl may fail due to DNS caching (expected behavior)
* External/mobile access works correctly
* Cloudflare handles all routing and HTTPS termination

---

7. NGINX

* Installed and running
* Configured for local reverse proxy
* Not used for public routing (Cloudflare Tunnel bypasses it)

---

8. SECURITY MODEL

* Ports 3000/8000 not exposed directly to internet
* All traffic routed through Cloudflare Tunnel
* HTTPS termination handled by Cloudflare (no certbot needed)

---

9. IMPORTANT NOTES

Use only:
  https://api.velveapp.com   ← Node.js API (mobile app target)
  https://ai.velveapp.com    ← AI server (internal, not for mobile)

Do NOT use:
  localhost or server IP in frontend/mobile code

AI_SERVER_URL in apps/api/.env stays http://localhost:8000 (internal call, same host)

---

FINAL STATE: SYSTEM FULLY DEPLOYED AND PRODUCTION-READY
Last verified: 2026-04-24
