# Imporlan BoatTrader Scraper

FastAPI service that bypasses Cloudflare on `boattrader.com` / `boats.com`
using `curl_cffi` (TLS fingerprint impersonation) and returns structured
listing data. Called by `api/boattrader_scraper.php` from the panel.

## Endpoints

- `GET /` — service info
- `GET /health` — health check (used by Fly.io)
- `GET /scrape?url=<listing_url>` — scrape a listing

## Response shape

```json
{
  "success": true,
  "title": "2006 Sea Ray 200 Sundeck",
  "price": 18900.0,
  "location": "Miami, FL",
  "city": "Miami, FL",
  "hours": 350,
  "engine": "Mercruiser 4.5L",
  "image_url": "https://imageresizer.boats.com/...",
  "listing_id": "10163201",
  "source": "next_data"
}
```

## Deploying to Fly.io (cPanel terminal)

These steps run on the cPanel server, in this directory.

```bash
# 1. Install flyctl (one-time)
curl -L https://fly.io/install.sh | sh
export FLYCTL_INSTALL="$HOME/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

# 2. Login (opens a browser link, paste it where you can)
flyctl auth login

# 3. From this directory: launch (only the FIRST time — creates the app)
cd /home/wwimpo/imporlan-staging/scraper
flyctl launch --no-deploy --copy-config --name imporlan-boattrader-scraper
# When asked: don't add Postgres, don't add Redis, don't deploy yet.
# It will write a fresh fly.toml — overwrite if asked, or keep ours.

# 4. Deploy
flyctl deploy

# 5. Verify
flyctl status
flyctl logs

# 6. Smoke test
curl -sS "https://imporlan-boattrader-scraper.fly.dev/health"
curl -sS "https://imporlan-boattrader-scraper.fly.dev/scrape?url=https://www.boattrader.com/boat/2006-sea-ray-200-sundeck-10163201/" | head -c 1000
```

If `flyctl launch` complains the app name is taken, pick another (e.g.
`imporlan-scraper-XYZ`) and update `app = "..."` in `fly.toml` plus the
URL in `api/boattrader_scraper.php` accordingly.

## Updating the panel to use this scraper

Once `flyctl deploy` succeeds and the smoke test returns data, edit:

`api/boattrader_scraper.php` line ~659:

```php
$apiBase = 'https://imporlan-boattrader-scraper.fly.dev';
```

(Use whatever hostname Fly assigned — `flyctl status` shows it.)

Then commit + run `bash deploy-prod.sh`.

## Iterating

If the scraper runs but returns partial data:

1. `flyctl logs` to see what happened
2. Test locally: hit `/scrape?url=...` and inspect the JSON
3. Common cause: BoatTrader changed the `__NEXT_DATA__` schema; update the
   key candidates in `_from_next_data()` accordingly. The fallback `_from_meta`
   should still cover title + image even if Next data parsing fails.

## Costs

Fly.io's free Hobby plan covers a single shared-cpu-1x 256-512 MB machine.
With `auto_stop_machines = "suspend"`, the machine stops after a few minutes
of inactivity and starts automatically on the next request (cold start ~2 s).
Expected cost for normal panel usage: $0.
