# Life Logger

Multi-user life tracking app backed by SQLite, with a FastAPI backend and plain HTML/CSS/JS frontend. Each user registers their own account and their data is fully isolated.

> Contributions welcome — see [Contributing](#contributing) below.

---

## Local Development

### 1. Install dependencies

```bash
pip install fastapi pydantic uvicorn slowapi
```

### 2. Run

```bash
python3 -m uvicorn api:app --reload --host 0.0.0.0
```

Frontend: `http://localhost:8000`
Interactive API docs: `http://localhost:8000/docs`

### 3. Create an account

Open the frontend and click **Create an account** on the login screen. Enter your display name, username, and a password (min 6 characters). Your display name is shown throughout the app (e.g. "Jacob's Log").

---

## VPS Deployment (DigitalOcean + nginx + HTTPS)

### 1. Provision the server

Create a Ubuntu droplet on DigitalOcean. Point your domain's `A` record to the droplet's IP before continuing — Let's Encrypt needs DNS to resolve for certificate issuance.

### 2. Install dependencies

```bash
sudo apt update
sudo apt install python3-pip nginx certbot python3-certbot-nginx -y
pip3 install fastapi pydantic uvicorn slowapi
```

### 3. Clone the project

```bash
git clone https://github.com/jek821/LifeLogger /opt/lifelogger
```

### 4. Create a systemd service

```bash
sudo nano /etc/systemd/system/lifelogger.service
```

Paste:

```ini
[Unit]
Description=Life Logger
After=network.target

[Service]
WorkingDirectory=/opt/lifelogger
ExecStart=python3 -m uvicorn api:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lifelogger
sudo systemctl status lifelogger   # verify it's running
```

### 5. Configure nginx

```bash
sudo nano /etc/nginx/sites-available/lifelogger
```

Paste (replace `yourdomain.com`):

```nginx
# Rate limit zones — defined outside the server block
limit_req_zone $binary_remote_addr zone=auth:10m  rate=10r/m;
limit_req_zone $binary_remote_addr zone=api:10m   rate=200r/m;

server {
    listen 80;
    server_name yourdomain.com;

    # Stricter limit on auth endpoints (brute-force protection)
    location ~ ^/(login|register)$ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # General API limit
    location / {
        limit_req zone=api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/lifelogger /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Issue SSL certificate

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot will automatically update your nginx config for HTTPS and set up auto-renewal. Verify renewal works:

```bash
sudo certbot renew --dry-run
```

### 7. Open firewall ports

In the DigitalOcean control panel, ensure your droplet's firewall allows:
- Port 80 (HTTP — nginx redirects to HTTPS)
- Port 443 (HTTPS)

Port 8000 should **not** be exposed publicly since uvicorn binds to `127.0.0.1` only.

---

## Authentication

- **Registration:** Create an account from the login screen. Provide a display name, username, and password.
- **Sessions:** Token-based (Bearer). Sessions expire after **1 hour of inactivity** — any API request resets the timer.
- **Isolation:** All data (events, labels) is scoped per user. Users cannot access each other's data.
- Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>` on every request.

---

## Database

SQLite database stored at `timelogger.db` in the project directory. Schema:

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

## Contributing

Contributions are welcome! Open an issue or pull request on GitHub:

**[github.com/jek821/LifeLogger](https://github.com/jek821/LifeLogger)**
