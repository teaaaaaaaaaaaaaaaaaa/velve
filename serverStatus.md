PROJECT STATUS – VELVE BACKEND INFRASTRUCTURE

Server environment is fully set up and running in production mode.

BACKEND (AI SERVER)

* Framework: FastAPI (Python)
* Running on: localhost:8000
* Managed via: PM2
* Status: ONLINE
* Health endpoint: /ping → returns {status: "ok"}

DEPENDENCIES

* numpy==1.26.4
* opencv-python-headless==4.8.1.78
* All compatibility issues resolved

PROCESS MANAGEMENT

* PM2 is used for backend process management
* Process name: velve-ai
* Auto-restart enabled
* PM2 startup configured and saved

REVERSE PROXY (LOCAL)

* Nginx installed and running
* Configured for:

  * api.velveapp.com → proxy to 127.0.0.1:8000
  * velveapp.com → static frontend (dist build)
* Nginx active and enabled via systemd

NETWORK CONSTRAINT

* Server is behind CGNAT (no direct public port access)
* Ports 80/443 not reachable externally
* Therefore using Cloudflare Tunnel instead of direct exposure

CLOUDFLARE TUNNEL (PRODUCTION SETUP)

* Tunnel type: Named Tunnel
* Tunnel name: velve-api
* Tunnel ID: d32e8bf9-e9d1-4ab7-9e8e-8072b5a9c758
* Config location: /etc/cloudflared/config.yml
* Credentials: ~/.cloudflared/*.json
* Managed via: systemd service (cloudflared)
* Status: ACTIVE (auto-start enabled)

DOMAIN SETUP

* Domain: velveapp.com
* Subdomain: api.velveapp.com
* Nameservers switched to Cloudflare:

  * lou.ns.cloudflare.com
  * rachel.ns.cloudflare.com
* DNS record:

  * api.velveapp.com → Cloudflare proxy → tunnel

SSL / HTTPS

* Handled by Cloudflare (no certbot used)
* Full HTTPS working externally

PUBLIC ACCESS

* API endpoint:
  https://api.velveapp.com/ping
* Confirmed working from external networks (mobile)

CURRENT STATUS

* Backend: 100% operational
* Public API: accessible via HTTPS
* Infra: stable
* Remaining: none critical (DNS fully propagated globally)

NOTES

* Do NOT use localhost or server IP in frontend
* Always use https://api.velveapp.com
* No need for certbot due to Cloudflare SSL
* Server is not directly exposed to internet (tunnel-only access)

SYSTEM IS READY FOR MOBILE / EXPO / PRODUCTION USE
