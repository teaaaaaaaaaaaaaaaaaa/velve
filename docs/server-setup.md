# Velve Server — Šta treba uraditi

**Hardware:** Intel Xeon E3-1270 · 16GB ECC DDR4 · 2× 2TB SAS · bez GPU-a

---

## 1. Instaliraj Ubuntu Server

Preuzmi **Ubuntu Server 22.04 LTS** (ne desktop verziju).

Napravi bootabilni USB (Rufus na Windowsu), ubaci u server, instaliraj.

Pri instalaciji:
- Izaberi srpsku tastaturu ili ostaviti default
- Hostname: `velve-server`
- Napravi korisnika (npr. `vukasin`) sa lozinkom
- **Obavezno uključi OpenSSH server** — biće ti potreban za pristup sa laptopa

---

## 2. Konfiguriši RAID 1

Uradi ovo **odmah posle instalacije OS-a**, pre nego što išta instaliraš.

RAID 1 = oba diska su ogledalo jedan drugog. Ako jedan crkne — server nastavlja normalno.

```bash
sudo apt install mdadm
sudo mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/sda /dev/sdb
```

Provjeri status:
```bash
cat /proc/mdstat
```

Formatuj i mountuj:
```bash
sudo mkfs.ext4 /dev/md0
sudo mkdir /data
sudo mount /dev/md0 /data
```

Dodaj u `/etc/fstab` da se automountuje pri restartu.

---

## 3. Instaliraj potreban softver

```bash
# Ažuriranja
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# PM2 (process manager za Node.js)
sudo npm install -g pm2

# Git
sudo apt install -y git
```

---

## 4. Instaliraj Ollama

Ollama pokreće Qwen2.5 7B model lokalno na CPU-u.

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Preuzmi model (~5GB, samo jednom)
ollama pull qwen2.5:7b
```

Provjeri da radi:
```bash
ollama run qwen2.5:7b "Zdravo"
```

---

## 5. Postavi Cloudflare Tunnel

Cloudflare Tunnel daje javni HTTPS URL bez statičke IP adrese i bez otvaranja portova na ruteru.

```bash
# Instaliraj cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared

# Prijavi se na Cloudflare (otvara browser link, uradi na laptopu)
cloudflared tunnel login

# Napravi tunnel
cloudflared tunnel create velve

# Napravi config fajl
# /etc/cloudflared/config.yml
# Usmeri velve.tvoj-domen.com → localhost:3000
```

Nakon ovoga API je dostupan putem `https://api.velve.com` (ili koji god subdomen podesite).

---

## 6. Kloniraj repo i pokreni servise

```bash
git clone https://github.com/tvoj-user/velve.git /data/velve
cd /data/velve

# API
cd apps/api
cp .env.example .env
# Popuni .env sa pravim vrednostima
npm install
pm2 start src/index.js --name velve-api

# AI server
cd ../ai-server
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pm2 start "python main.py" --name velve-ai

# Sačuvaj PM2 konfiguraciju
pm2 save
pm2 startup  # kopiraš i pokreneš komandu koju ti ispiše
```

---

## 7. Popuni .env na serveru

Ovo su vrednosti koje trebaš uneti u `apps/api/.env`:

| Varijabla | Gde se nalazi |
|---|---|
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `FIREBASE_PROJECT_ID` | Firebase Console → Project Settings |
| `FIREBASE_PRIVATE_KEY` | Firebase → Service Accounts → Generate new private key |
| `FIREBASE_CLIENT_EMAIL` | Isto JSON fajl kao gore |
| `R2_ENDPOINT` | Cloudflare → R2 → Settings |
| `R2_ACCESS_KEY` / `R2_SECRET_KEY` | Cloudflare → R2 → Manage API tokens |

---

## Provjera da sve radi

```bash
# API ping
curl http://localhost:3000/ping
# Očekivano: {"status":200,"message":"Velve API running"}

# AI server ping
curl http://localhost:8000/ping
# Očekivano: {"status":"ok","message":"Velve AI server running"}

# Ollama
ollama list
# Treba da vidiš qwen2.5:7b

# RAID status
cat /proc/mdstat
# Treba da piše [UU] — oba diska aktivna

# PM2 status
pm2 list
# velve-api i velve-ai treba da su "online"
```

---

## Redosled rada (prioritet)

1. Ubuntu instalacija + SSH pristup
2. RAID 1 konfiguracija
3. Node.js + Python + PM2
4. Cloudflare Tunnel
5. Ollama + model download
6. Kloniraj repo, popuni `.env`, pokreni servise
7. Provjeri sve curl komandama gore
