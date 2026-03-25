# Life Logger

**Life Logger** is a small, open-source web app you can run on your own machine or server. It helps you notice where your time actually goes: you log what you’re doing with simple labels, then use history and stats to see patterns instead of guessing. It isn’t therapy or a life coach in a box, it’s a privacy-friendly tool for people who like optimizing their time. 

Under the hood it’s multi-user SQLite, a FastAPI API. Each account keeps its own labels and events.

> Contributions welcome — see [Contributing](#contributing) below.

---

## Project layout

| Path | Role |
|------|------|
| `api.py` | Thin ASGI entrypoint (`uvicorn api:app` imports the real app from the package). |
| `lifelogger/` | Python package: database (`db.py`), settings (`config.py`), domain logic (`services/`), HTTP layer (`api/`). |
| `lifelogger/api/routers/` | One module per area (auth, labels, events, stats, admin, static pages). |
| `frontend/` | HTML pages (`index.html`, `settings.html`, `developer.html`, `admin.html`); shared styles in `css/index.css`; JS in `js/` (entries `app.js`, `settings-app.js`). Static files are served under `/assets/…`. |
| `frontend/icon.png` | App icon (favicon and Apple touch icon). The only copy tracked in the repo; served at `/assets/icon.png` and `/favicon.ico`. |
| `timelogger.db` | SQLite file (created at the **repository root** on first run). |

Initialize the database without starting the server:

```bash
python -m lifelogger
```

---

## Local Development

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run

```bash
python3 -m uvicorn api:app --reload --host 0.0.0.0
```

The app resolves `timelogger.db` and `frontend/` paths from the package location, so the working directory should be the **project root** (as in the command above).

Frontend: `http://localhost:8000`
Interactive API docs: `http://localhost:8000/docs`

### 3. Create an account

Open the frontend and click **Create an account** on the login screen. Enter your display name, username, and a password (min 6 characters). Your display name is shown throughout the app (e.g. "Jacob's Log").

---

## VPS deployment (DigitalOcean Droplet + Ubuntu + nginx + HTTPS)

These steps assume an **Ubuntu 22.04 or 24.04 LTS** Droplet on [DigitalOcean](https://www.digitalocean.com/), SSH access as a user with `sudo`, and a **domain name** whose `A` record points at the Droplet’s public IPv4 address (required before Let’s Encrypt can issue a certificate).

### 1. Create the Droplet and DNS

1. In DigitalOcean: **Create → Droplets** — choose Ubuntu 22.04/24.04, a size that fits your traffic, and your region.
2. Add an **SSH key** for login (recommended) or use a root password for the first boot only, then harden SSH.
3. In your DNS host, create an **`A` record**: hostname (e.g. `life` or `@`) → **Droplet IPv4**. Wait until it resolves before step 7.

### 2. Update the system

SSH in (replace the address with yours):

```bash
ssh root@YOUR_DROPLET_IP
# or: ssh ubuntu@YOUR_DROPLET_IP   # on some images the default user is `ubuntu`
```

```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Install system packages

```bash
sudo apt install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx
```

You do **not** need Node.js or a frontend build: the app serves `frontend/` and `/assets` directly from Python.

### 4. Clone the app and create a virtual environment

Using `/opt/lifelogger` matches the systemd unit below. Clone as **root**, then hand the tree to **`www-data`** (the default service user) so it can write **`timelogger.db`** and run **`git pull`** later without permission fights.

```bash
sudo git clone https://github.com/jek821/LifeLogger.git /opt/lifelogger
sudo chown -R www-data:www-data /opt/lifelogger
sudo -u www-data bash -c 'cd /opt/lifelogger && python3 -m venv venv && ./venv/bin/pip install --upgrade pip && ./venv/bin/pip install -r requirements.txt'
```

The SQLite file **`timelogger.db`** appears in `/opt/lifelogger` on first run. To initialize the database only (no HTTP server):

```bash
sudo -u www-data /opt/lifelogger/venv/bin/python -m lifelogger
```

### 5. systemd service

Create a unit that runs **uvicorn** from the venv, bound to **localhost** only (nginx terminates TLS and proxies).

```bash
sudo nano /etc/systemd/system/lifelogger.service
```

Paste (adjust `User=` / `Group=` if you use a dedicated service account — see note below):

```ini
[Unit]
Description=Life Logger (FastAPI / uvicorn)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/lifelogger
Environment="PATH=/opt/lifelogger/venv/bin"
ExecStart=/opt/lifelogger/venv/bin/python -m uvicorn api:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lifelogger
sudo systemctl status lifelogger
```

If `status` shows **active (running)**, the API is listening on `127.0.0.1:8000`.

**Dedicated user (optional):** Instead of `www-data`, you can use `sudo useradd -r -s /usr/sbin/nologin lifelogger`, set `User=lifelogger` and `Group=lifelogger`, and `sudo chown -R lifelogger:lifelogger /opt/lifelogger`.

### 6. nginx reverse proxy

```bash
sudo nano /etc/nginx/sites-available/lifelogger
```

Paste (replace `yourdomain.com` with your hostname):

```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=200r/m;

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;

    location ~ ^/(login|register)$ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        limit_req zone=api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/lifelogger /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 7. HTTPS with Let’s Encrypt

```bash
sudo certbot --nginx -d yourdomain.com
```

Follow the prompts. Certbot will install the certificate and adjust the server block for HTTPS. Test renewal:

```bash
sudo certbot renew --dry-run
```

### 8. Firewalls

- **On the Droplet (UFW),** if you use it:

  ```bash
  sudo ufw allow OpenSSH
  sudo ufw allow 'Nginx Full'
  sudo ufw enable
  sudo ufw status
  ```

- **In the DigitalOcean control panel,** if you use a **Cloud Firewall**, allow inbound **TCP 22** (SSH from your IP), **80**, and **443**. Do **not** expose **8000** publicly; the app should stay on `127.0.0.1:8000`.

### 9. After deploy

Open `https://yourdomain.com`. The first registered user becomes the **admin** if no admin exists yet. Use **Settings** (gear) and `/admin` as documented above.

**Updates:** on the server:

```bash
sudo systemctl stop lifelogger
sudo -u www-data bash -c 'cd /opt/lifelogger && git pull && ./venv/bin/pip install -r requirements.txt'
sudo systemctl start lifelogger
```

(Replace `www-data` with your service user if you changed the unit file.)

---

## Authentication

- **Registration:** Create an account from the login screen. Provide a display name, username, and password.
- **Sessions:** Token-based (Bearer). Sessions expire after **1 hour of inactivity** — any API request resets the timer.
- **Isolation:** All data (events, labels) is scoped per user. Users cannot access each other's data.
- Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>` on every request.

---

## Database

SQLite database file `timelogger.db` lives at the **repository root** (same folder as `api.py`), regardless of the current working directory when Python starts. It is **gitignored** so clones start clean and your personal data stays local. Schema:

```sql
users    (id, username, display_name, password_hash, created_at)
sessions (token, user_id, last_used)
events   (id, user_id, label, started_at, ended_at)
labels   (user_id, label)
```

- Passwords are hashed with PBKDF2-HMAC-SHA256 (100k iterations, random 32-byte salt)
- All timestamps are stored in UTC as ISO 8601 strings
- `ended_at` is `NULL` while an event is active
- Only one event can be active per user at a time — starting a new event automatically ends the current one
- Active events survive server restarts (state is in the DB, not memory)

---

## Frontend

- **Timer** — shows the currently active event and elapsed time. Tap any label button to start logging that activity (automatically ends the previous one).
- **Labels** — manage your label set. Deleting a label does not affect past events.
- **History** — view, edit, and delete past events for a given date range.
- **Statistics** — query a date range to see time per label as percentages and total minutes, sorted by usage.
- **Developer** — API reference and token access for scripting against your own data.
- **Settings** (`/settings`, gear icon on the main app) — change display name, username, or password; delete your account and all of your data (sole admin must promote someone else first).
- **Admin** (`/admin`) — user management for accounts flagged `is_admin` (the first registered user is promoted automatically if no admin exists).

---

## API

All endpoints except `GET /`, `POST /login`, and `POST /register` require a valid `Authorization: Bearer <token>` header.

Timestamps are UTC ISO 8601 strings (e.g. `2026-03-23T14:30:00+00:00`). The frontend converts to/from the user's local timezone.

An interactive API explorer is available at `/docs` (FastAPI's built-in Swagger UI).

### Auth

#### `POST /register`
```json
{ "username": "yourname", "display_name": "Jacob", "password": "yourpassword" }
```
Returns `{ "token": "...", "display_name": "Jacob" }` on success. Fails with `409` if username is taken.

#### `POST /login`
```json
{ "username": "yourname", "password": "yourpassword" }
```
Returns `{ "token": "...", "display_name": "Jacob" }` on success.

#### `POST /logout`
Invalidates the current session token.

#### `GET /me`
Returns the authenticated user's profile.
```json
{ "id": 1, "username": "yourname", "display_name": "Jacob", "created_at": "..." }
```

#### `PATCH /me`
Update your display name.
```json
{ "display_name": "New Name" }
```

#### `PATCH /me/username`
Change your login username. Requires your current password. Returns a **new session token** (same shape as `GET /me` plus `"token"`); other sessions for your account are ended.
```json
{ "username": "newname", "current_password": "..." }
```

#### `POST /me/change-password`
```json
{ "current_password": "...", "new_password": "..." }
```

#### `POST /me/delete-account`
Permanently deletes your user row and all of your sessions, labels, and events. Requires your password. Returns `400` if you are the only administrator (promote another admin first).

```json
{ "password": "..." }
```

---

### Labels

#### `GET /labels`
Returns your labels sorted alphabetically.
```json
{ "labels": ["Exercise", "Meeting", "Programming"] }
```

#### `POST /labels`
```json
{ "label": "Exercise" }
```
Returns `{ "ok": true, "labels": [...] }`.

#### `DELETE /labels/{label}`
Deletes a label. Existing events with that label are unaffected.

---

### Events

#### `GET /event/active`
Returns the currently active event, or `null` if none.
```json
{ "event": { "id": 42, "label": "Programming", "started_at": "2026-03-23T14:00:00+00:00", "ended_at": null } }
```

#### `POST /event/start`
Ends the active event (if any) and starts a new one.
```json
{ "label": "Programming" }
```

#### `POST /event/end`
Ends the active event without starting a new one.

#### `POST /event/manual`
Create a completed (or open-ended) event in one step. Same label rules as `POST /event/start` when the user has any labels defined.

```json
{ "label": "Programming", "started_at": "2026-03-23T14:00:00+00:00", "ended_at": "2026-03-23T15:00:00+00:00" }
```

Omit `ended_at` or set it to `null` for an active event (ensure you do not already have another active event if your client relies on a single active timer).

#### `GET /events?start=<utc>&end=<utc>`
Returns all your events whose `started_at` falls within the given UTC range, ordered by start time.

#### `PATCH /event/{id}`
Edit an event's label or timestamps.
```json
{ "label": "Meeting", "started_at": "2026-03-23T14:00:00+00:00", "ended_at": "2026-03-23T15:00:00+00:00" }
```

#### `DELETE /event/{id}`
Permanently deletes an event.

---

### Statistics

#### `GET /stats?start=<utc>&end=<utc>`
Returns time breakdown across the given UTC range. Durations are in minutes (float). An active event within the range is counted up to the current time.

```json
{
  "percentages": { "Programming": 62.5, "Meeting": 37.5 },
  "minutes":     { "Programming": 187.5, "Meeting": 112.5 }
}
```

---

### Admin (requires admin session)

All routes below need `Authorization: Bearer <token>` for a user with `is_admin: true`.

#### `GET /admin/users`
Returns every user (id, username, display_name, created_at, is_admin) plus `you` (the caller’s user id).

#### `DELETE /admin/users/{id}`
Deletes a user and their sessions, labels, and events. You cannot delete your own account through this endpoint.

#### `POST /admin/users/{id}/reset-password`
```json
{ "temporary_password": "new-temp-secret" }
```
Sets a new password and revokes that user’s sessions. Admins cannot reset their own password here (use **Settings** in the main app).

---

## Contributing

Contributions are welcome! Open an issue or pull request on GitHub:

**[github.com/jek821/LifeLogger](https://github.com/jek821/LifeLogger)**
