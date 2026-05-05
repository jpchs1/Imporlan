"""
Imporlan BoatTrader Scraper
===========================
FastAPI service that bypasses Cloudflare on boattrader.com / boats.com using
curl_cffi (TLS fingerprint impersonation) and returns structured listing data.

Deployed on Fly.io. Called by api/boattrader_scraper.php fetchViaScraperAPI().

Response shape (kept compatible with the previous scraper):
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
"""

import json
import logging
import re
from typing import Any

from bs4 import BeautifulSoup
from curl_cffi import requests as curl_requests
from fastapi import FastAPI, HTTPException, Query

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("scraper")

app = FastAPI(title="Imporlan BoatTrader Scraper", version="1.0.0")


@app.get("/")
def root():
    return {"status": "ok", "service": "imporlan-boattrader-scraper", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/debug")
def debug(url: str = Query(...), bytes_: int = Query(2000, alias="bytes")):
    """Diagnostic endpoint — fetches the URL and returns key extraction signals.

    Useful to confirm whether the source page actually contains __NEXT_DATA__,
    JSON-LD, og:meta or any spec table when the main /scrape comes back partial.
    """
    if not _is_supported_url(url):
        raise HTTPException(status_code=400, detail="Only boattrader.com and boats.com URLs are supported")

    headers = _browser_headers()
    try:
        r = curl_requests.get(url, impersonate="chrome131", headers=headers, timeout=25, allow_redirects=True)
    except Exception as e:
        return {"error": f"fetch_failed: {e}"}

    out: dict[str, Any] = {"http": r.status_code, "html_size": len(r.text or "")}
    if r.status_code != 200 or not r.text:
        out["excerpt"] = (r.text or "")[:bytes_]
        return out

    soup = BeautifulSoup(r.text, "lxml")
    out["has_next_data"] = bool(soup.find("script", id="__NEXT_DATA__"))
    out["title_tag"] = (soup.title.string or "").strip() if soup.title else ""
    out["h1"] = (soup.h1.get_text(strip=True) if soup.h1 else "")
    out["og"] = {
        (t.get("property") or "").replace("og:", ""): t.get("content")
        for t in soup.find_all("meta", property=True)
        if (t.get("property") or "").startswith("og:")
    }
    json_ld_scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    out["json_ld_count"] = len(json_ld_scripts)
    if json_ld_scripts:
        try:
            out["json_ld_first"] = json.loads(json_ld_scripts[0].string or "")
        except Exception:
            out["json_ld_first_raw"] = (json_ld_scripts[0].string or "")[:500]
    specs = _extract_specs_from_html(soup)
    # Limit specs to 30 entries to keep response reasonable
    out["specs"] = dict(list(specs.items())[:30])
    out["scrape_result"] = _parse(url, r.text)
    return out


def _browser_headers() -> dict:
    """Headers that pair with curl_cffi's chrome impersonation to look like a real browser.
    Cloudflare also fingerprints header presence and order, not just TLS.
    """
    return {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Referer": "https://www.google.com/",
    }


@app.get("/scrape")
def scrape(url: str = Query(..., description="boattrader.com or boats.com listing URL")):
    if not _is_supported_url(url):
        raise HTTPException(status_code=400, detail="Only boattrader.com and boats.com URLs are supported")

    log.info("scrape url=%s", url)
    headers = _browser_headers()

    last_err = None
    for profile in ("chrome131", "chrome124", "chrome120", "chrome"):
        try:
            r = curl_requests.get(
                url,
                impersonate=profile,
                headers=headers,
                timeout=25,
                allow_redirects=True,
            )
        except Exception as e:
            log.warning("fetch %s failed: %s", profile, e)
            last_err = f"fetch_failed_{profile}: {e}"
            continue

        if r.status_code == 200 and r.text and len(r.text) > 1000:
            log.info("fetch ok with %s len=%d", profile, len(r.text))
            return _parse(url, r.text)

        log.warning("fetch %s http=%s len=%d", profile, r.status_code, len(r.text or ""))
        last_err = f"http_{r.status_code}"

    return {"success": False, "error": last_err or "all_profiles_failed"}


def _is_supported_url(url: str) -> bool:
    return any(d in url for d in ("boattrader.com", "boats.com"))


def _listing_id_from_url(url: str) -> str | None:
    m = re.search(r"-(\d{6,})/?(?:\?|$)", url)
    return m.group(1) if m else None


def _parse(url: str, html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    listing_id = _listing_id_from_url(url)

    # Strategy 1: __NEXT_DATA__ (most complete, BoatTrader uses Next.js)
    next_data = _read_next_data(soup)
    if next_data:
        out = _from_next_data(next_data, url, listing_id)
        if out and out.get("title"):
            return out

    # Strategy 2: JSON-LD + og: meta (works as fallback or on boats.com)
    out = _from_meta(soup, url, listing_id)
    if out.get("title") or out.get("image_url"):
        out["success"] = True
        return out

    return {"success": False, "error": "no_data_extracted", "listing_id": listing_id, "url": url}


def _read_next_data(soup: BeautifulSoup) -> dict | None:
    tag = soup.find("script", id="__NEXT_DATA__")
    if not tag or not tag.string:
        return None
    try:
        return json.loads(tag.string)
    except Exception:
        log.exception("__NEXT_DATA__ parse failed")
        return None


def _walk(obj, predicate):
    """Yield every dict in a nested structure that matches predicate(dict)."""
    if isinstance(obj, dict):
        if predicate(obj):
            yield obj
        for v in obj.values():
            yield from _walk(v, predicate)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v, predicate)


def _first(*vals):
    for v in vals:
        if v not in (None, "", 0):
            return v
    return None


def _to_float(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        clean = re.sub(r"[^\d.]", "", v)
        try:
            return float(clean) if clean else None
        except ValueError:
            return None
    return None


def _to_int(v):
    f = _to_float(v)
    return int(f) if f is not None else None


def _from_next_data(data: dict, url: str, listing_id) -> dict | None:
    # The listing object varies by route — find it heuristically.
    # We look for a dict that has BOTH a price-ish field AND an images-ish field.
    candidates = list(_walk(
        data,
        lambda d: any(k in d for k in ("price", "Price", "askingPrice"))
                  and any(k in d for k in ("images", "Images", "imageUrls", "media")),
    ))
    listing = candidates[0] if candidates else None

    # Fallback: any dict with title/make/model AND a price
    if not listing:
        candidates = list(_walk(
            data,
            lambda d: any(k in d for k in ("title", "Title", "make", "Make"))
                      and any(k in d for k in ("price", "Price", "askingPrice")),
        ))
        listing = candidates[0] if candidates else None

    if not listing:
        return None

    # Title
    title = _first(
        listing.get("title"),
        listing.get("Title"),
        " ".join(filter(None, [
            str(listing.get("year") or listing.get("Year") or ""),
            str(listing.get("make") or listing.get("Make") or ""),
            str(listing.get("model") or listing.get("Model") or ""),
        ])).strip(),
    ) or ""

    # Price
    raw_price = _first(
        listing.get("price"),
        listing.get("Price"),
        listing.get("askingPrice"),
    )
    if isinstance(raw_price, dict):
        raw_price = _first(
            raw_price.get("amount"),
            raw_price.get("value"),
            raw_price.get("Value"),
        )
    price = _to_float(raw_price)

    # Location
    location = ""
    loc = _first(
        listing.get("location"),
        listing.get("Location"),
        listing.get("address"),
    )
    if isinstance(loc, dict):
        city = _first(loc.get("city"), loc.get("City")) or ""
        state = _first(loc.get("state"), loc.get("State"), loc.get("region")) or ""
        location = ", ".join(p for p in (city, state) if p)
    elif isinstance(loc, str):
        location = loc
    else:
        # try direct fields
        city = _first(listing.get("city"), listing.get("City"))
        state = _first(listing.get("state"), listing.get("State"))
        if city:
            location = ", ".join(p for p in (str(city), str(state) if state else "") if p)

    # Hours
    hours = _to_int(_first(
        listing.get("hours"),
        listing.get("Hours"),
        listing.get("engineHours"),
    ))

    # Engine
    engine = ""
    eng = _first(
        listing.get("engine"),
        listing.get("Engine"),
        listing.get("primaryEngine"),
        listing.get("PrimaryEngine"),
    )
    if isinstance(eng, dict):
        engine = _first(
            eng.get("description"),
            eng.get("Description"),
            eng.get("model"),
            eng.get("name"),
        ) or ""
    elif isinstance(eng, str):
        engine = eng

    # Image
    image_url = ""
    img = _first(
        listing.get("primaryImage"),
        listing.get("image"),
        listing.get("imageUrl"),
        listing.get("ImageUrl"),
    )
    if isinstance(img, dict):
        image_url = _first(img.get("url"), img.get("Url"), img.get("uri")) or ""
    elif isinstance(img, str):
        image_url = img

    if not image_url:
        images = _first(
            listing.get("images"),
            listing.get("Images"),
            listing.get("imageUrls"),
            listing.get("media"),
        )
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, str):
                image_url = first
            elif isinstance(first, dict):
                image_url = _first(
                    first.get("url"), first.get("Url"), first.get("uri"),
                    first.get("XLargeURL"), first.get("LargeURL"), first.get("MediumURL"),
                ) or ""

    return {
        "success": bool(title or image_url),
        "title": title,
        "price": price,
        "location": location,
        "city": location,
        "hours": hours,
        "engine": engine,
        "image_url": image_url,
        "listing_id": listing_id,
        "url": url,
        "source": "next_data",
    }


def _from_meta(soup: BeautifulSoup, url: str, listing_id) -> dict[str, Any]:
    # og: meta
    def og(p):
        tag = soup.find("meta", property=p)
        return (tag.get("content", "") if tag else "")

    title = (og("og:title") or "").strip()
    image_url = (og("og:image") or "").strip()

    # JSON-LD: Product / Vehicle / Boat. We harvest as much as we can.
    price = None
    location = ""
    hours = None
    engine = ""
    for ld in soup.find_all("script", attrs={"type": "application/ld+json"}):
        if not ld.string:
            continue
        try:
            payload = json.loads(ld.string)
        except Exception:
            continue
        items = payload if isinstance(payload, list) else [payload]
        for item in items:
            if not isinstance(item, dict):
                continue
            offers = item.get("offers") if isinstance(item.get("offers"), dict) else {}
            if price is None:
                price = _to_float(offers.get("price") or offers.get("lowPrice") or item.get("price"))
            if not title and item.get("name"):
                title = str(item["name"])
            if not image_url and item.get("image"):
                im = item["image"]
                if isinstance(im, list) and im:
                    image_url = str(im[0])
                elif isinstance(im, str):
                    image_url = im
            # Location: address, location, areaServed
            if not location:
                for src in (offers.get("areaServed"), item.get("location"), item.get("address")):
                    addr = src.get("address") if isinstance(src, dict) and isinstance(src.get("address"), dict) else src
                    if isinstance(addr, dict):
                        city = addr.get("addressLocality") or addr.get("city") or ""
                        state = addr.get("addressRegion") or addr.get("state") or ""
                        if city or state:
                            location = ", ".join(p for p in (city, state) if p)
                            break
            # Hours: schema.org Vehicle uses mileageFromOdometer. Also look at additionalProperty.
            if hours is None:
                m = item.get("mileageFromOdometer")
                if isinstance(m, dict) and m.get("value"):
                    hours = _to_int(m["value"])
            # Engine: vehicleEngine or additionalProperty
            if not engine:
                ve = item.get("vehicleEngine")
                if isinstance(ve, dict):
                    engine = str(ve.get("name") or ve.get("description") or "").strip()
                elif isinstance(ve, str):
                    engine = ve.strip()
            # additionalProperty: [{name: "Hours", value: 350}, {name: "Engine", value: "..."}]
            extra = item.get("additionalProperty")
            if isinstance(extra, list):
                for prop in extra:
                    if not isinstance(prop, dict):
                        continue
                    pname = (prop.get("name") or "").lower()
                    pval = prop.get("value") or prop.get("propertyValue")
                    if pval is None:
                        continue
                    if hours is None and any(k in pname for k in ("hour", "engine hour")):
                        hours = _to_int(pval)
                    elif not engine and any(k in pname for k in ("engine", "power", "motor", "propulsion")):
                        engine = str(pval).strip()

    # Last resort: extract specs from visible HTML (dt/dd, table rows, label/value spans)
    specs = _extract_specs_from_html(soup)
    if not location:
        loc_val = _find_in_specs(specs, "location", "city", "boat location", "dealer location")
        if loc_val:
            location = loc_val
    if hours is None:
        h_val = _find_in_specs(specs, "engine hours", "hours")
        if h_val:
            hours = _to_int(h_val)
    if not engine:
        engine = _find_in_specs(specs, "engine model", "primary engine", "engine make/model", "engine", "power", "propulsion") or ""

    return {
        "title": title,
        "price": price,
        "location": location,
        "city": location,
        "hours": hours,
        "engine": engine,
        "image_url": image_url,
        "listing_id": listing_id,
        "url": url,
        "source": "meta",
    }


def _extract_specs_from_html(soup: BeautifulSoup) -> dict:
    """Collect any label->value pairs visible in the page (spec tables, dl, etc.)."""
    specs: dict[str, str] = {}

    def remember(label: str, value: str):
        label = (label or "").strip().lower().rstrip(":")
        value = (value or "").strip()
        if label and value and label not in specs:
            specs[label] = value

    # <dl><dt>label</dt><dd>value</dd></dl>
    for dt in soup.find_all("dt"):
        dd = dt.find_next_sibling("dd")
        if dd:
            remember(dt.get_text(), dd.get_text())

    # <table><tr><th>label</th><td>value</td></tr></table>
    # also <tr><td>label</td><td>value</td></tr> — first td label, second td value
    for tr in soup.find_all("tr"):
        cells = tr.find_all(["th", "td"])
        if len(cells) >= 2:
            remember(cells[0].get_text(), cells[1].get_text())

    # Generic <li>label: value</li> or <p>label: value</p>
    for el in soup.find_all(["li", "p", "div", "span"]):
        text = el.get_text(separator=" ", strip=True)
        if not text or len(text) > 80:
            continue
        # match "Hours: 350" / "Engine: Mercruiser 4.5L"
        m = re.match(r"^([A-Za-z][A-Za-z /-]{2,30})\s*[:|]\s*(.+)$", text)
        if m:
            remember(m.group(1), m.group(2))

    return specs


def _find_in_specs(specs: dict, *keys) -> str | None:
    """Find first value whose key contains any of the given key fragments (case-insensitive)."""
    for k in keys:
        kl = k.lower()
        for spec_key, val in specs.items():
            if kl in spec_key:
                return val
    return None
