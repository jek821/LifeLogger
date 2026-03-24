# Jacob's Life Logger

Personal life tracking app backed by SQLite, with a FastAPI backend and plain HTML/CSS/JS frontend.

---

## Local Development

### 1. Install dependencies

```bash
pip install fastapi pydantic uvicorn
```

### 2. Set environment variables

```bash
export TIMELOGGER_USER=yourname
export TIMELOGGER_PASS=yourpassword
```

The server will refuse to start if these are not set.

### 3. Run

```bash
python3 -m uvicorn api:app --reload --host 0.0.0.0
```

Frontend: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

---

## VPS Deployment (DigitalOcean + nginx + HTTPS)

### 1. Provision the server

Create a Ubuntu droplet on DigitalOcean. Point your domain's `A` record to the droplet's IP before continuing — Let's Encrypt needs DNS to resolve for certificate issuance.

### 2. Install dependencies

```bash
sudo apt update
sudo apt install python3-pip nginx certbot python3-certbot-nginx -y
pip3 install fastapi pydantic uvicorn
```

### 3. Clone the project

```bash
git clone your-repo-url /opt/lifelogger
```

### 4. Create a systemd service

```bash
sudo nano /etc/systemd/system/lifelogger.service
```

Paste, replacing `yourname` and `yourpassword` with your actual credentials **before saving**:

```ini
[Unit]
Description=Jacob's Life Logger
After=network.target

[Service]
WorkingDirectory=/opt/lifelogger
ExecStart=python3 -m uvicorn api:app --host 127.0.0.1 --port 8000
Environment=TIMELOGGER_USER=yourname
Environment=TIMELOGGER_PASS=yourpassword
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> **Important:** The systemd service runs in an isolated environment. Shell exports and `.bashrc` variables are NOT inherited by it. Credentials must be set directly in the `Environment=` lines above — not in your shell.

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lifelogger
sudo systemctl status lifelogger   # verify it's running
```

To verify the service picked up the right credentials:
```bash
sudo systemctl show lifelogger | grep Environment
```

### 5. Configure nginx

```bash
sudo nano /etc/nginx/sites-available/lifelogger
```

Paste (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
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

- Login with the username/password set in your environment variables.
- Only one session is active at a time (stored in `session.json`).
- Sessions expire after **1 hour of inactivity**. Any request resets the timer.
- On expiry, the frontend automatically redirects to the login screen.
- The session token is stored in `localStorage` and sent as a `Bearer` token on every request.

---

## Configuration

Edit `SEED_LABELS` in `main.py` to set the initial labels inserted into the database on first run:

```python
SEED_LABELS = {"Programming", "Meeting", "Lunch", "Exercise"}
```

Labels can also be added and deleted at runtime via the UI or the `/labels` endpoints. Deleting a label does **not** affect existing events that used it.

---

## Database

SQLite database stored at `timelogger.db` in the project directory. Schema:

```sql
events (id INTEGER PRIMARY KEY, label TEXT, started_at TEXT, ended_at TEXT)
labels (label TEXT PRIMARY KEY)
```

- All timestamps are stored in UTC as ISO 8601 strings
- `ended_at` is `NULL` while an event is active
- Only one event can be active at a time — starting a new event automatically ends the current one
- Active events survive server restarts (state is in the DB, not memory)

---

## Frontend

- **Timer** — shows the currently active event and elapsed time. Tap any label button to start logging that activity (automatically ends the previous one).
- **Labels** — manage your label set. Deleting a label does not affect past events.
- **History** — view, edit, and delete past events for a given date range.
- **Statistics** — query a date range to see time per label as percentages and total minutes, sorted by usage.

---

## API Endpoints

All endpoints except `GET /` and `POST /login` require a valid `Authorization: Bearer <token>` header.

Timestamps are UTC ISO 8601 strings (e.g. `2026-03-23T14:30:00+00:00`). The frontend is responsible for converting to/from the user's local timezone.

### Auth

#### `POST /login`
```json
{ "username": "yourname", "password": "yourpassword" }
```
Returns `{ "token": "..." }` on success.

#### `POST /logout`
Invalidates the current session.

---

### Labels

#### `GET /labels`
Returns all labels sorted alphabetically.
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
Returns all events whose `started_at` falls within the given UTC range, ordered by start time.

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
