# TimeLogger

Personal time tracking app backed by SQLite, with a FastAPI backend and plain HTML/CSS/JS frontend.

---

## Local Development

### 1. Install dependencies

```bash
pip install fastapi pydantic
```

```bash
sudo dnf install python3-uvicorn   # Fedora
# or: pip install uvicorn
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

### 3. Copy the project

```bash
scp -r ./TimeLogger root@your-server-ip:/opt/timelogger
```

Or clone from your repo if you have one.

### 4. Create a systemd service

```bash
sudo nano /etc/systemd/system/timelogger.service
```

Paste:

```ini
[Unit]
Description=TimeLogger
After=network.target

[Service]
WorkingDirectory=/opt/timelogger
ExecStart=python3 -m uvicorn api:app --host 127.0.0.1 --port 8000
Environment=TIMELOGGER_USER=yourname
Environment=TIMELOGGER_PASS=yourpassword
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now timelogger
sudo systemctl status timelogger   # verify it's running
```

### 5. Configure nginx

```bash
sudo nano /etc/nginx/sites-available/timelogger
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
sudo ln -s /etc/nginx/sites-available/timelogger /etc/nginx/sites-enabled/
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

Labels can also be added and deleted at runtime via the UI or the `/labels` endpoints. Deleting a label does **not** affect existing entries that used it.

---

## Database

SQLite database stored at `timelogger.db` in the project directory. Schema:

```sql
entries (date TEXT, time TEXT, label TEXT, PRIMARY KEY (date, time))
labels  (label TEXT PRIMARY KEY)
```

- Dates are stored in ISO format: `YYYY-MM-DD`
- Times are stored as 15-minute increment strings: `H:MM AM/PM`
- Entries with the same date+time are overwritten on re-submission

---

## Frontend

Three cards:

- **Labels** — view all labels as chips. Click `+ Manage` to add or delete labels.
- **Log Activity** — log a label to a single time slot or a time range (15-min increments). Date and time default to today and the nearest past 15-min slot.
- **Statistics** — query a single date or date range. Returns time per label as both percentages and total minutes, sorted by usage.

---

## API Endpoints

All endpoints except `GET /` and `POST /login` require a valid `Authorization: Bearer <token>` header.

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
Add a new label.
```json
{ "label": "Exercise" }
```
Returns `{ "ok": true, "labels": [...] }`.

#### `DELETE /labels/{label}`
Delete a label. Existing entries with that label are unaffected.
Returns `{ "ok": true, "labels": [...] }`.

---

### Entries

#### `POST /entry`
Log a single 15-minute slot.
```json
{ "date": "2026-03-23", "time": "5:45 PM", "label": "Programming" }
```

#### `POST /entry/range`
Log a range of 15-minute slots to one label (end time is exclusive).
```json
{ "date": "2026-03-23", "start_time": "1:00 PM", "end_time": "3:00 PM", "label": "Programming" }
```
Returns `{ "ok": true, "updated": ["1:00 PM", "1:15 PM", ...] }`.

---

### Statistics

#### `GET /stats?start_date=2026-03-17&end_date=2026-03-23`
Returns time breakdown across a date range. For a single date, set both params to the same value.
```json
{
  "percentages": { "Programming": 42.5, "Meeting": 12.5 },
  "minutes":     { "Programming": 510,  "Meeting": 150  }
}
```
Percentages sum to 100. Only dates with logged entries contribute.
