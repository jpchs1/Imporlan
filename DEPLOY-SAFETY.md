# Deploy Safety — Imporlan + Tourevo Shared Hosting

## The problem we keep hitting

`imporlan.cl` and `tourevo.cl` live on the **same cPanel account**
(`wwimpo@single-4020.banahosting.com`). Imporlan is configured as the
**primary domain** of that account, so its doc-root is the bare
`~/public_html/`. Tourevo is an addon/alias on the same account.

The two domains end up sharing the same physical directory tree on the
server. Apache picks which content to serve via Host-aware rewrite rules
in `.htaccess`, but at the filesystem level **both sites can write to
the same path**.

Concretely: a `cp -Rf` from a Tourevo build into `~/public_html/` will
overwrite Imporlan's `index.html`, and vice versa. We've seen this in
production multiple times (incidents on 2026-04-19 and 2026-05-11).

## Short-term mitigations (this repo)

### 1. Sentinel file + identity check

After every successful deploy, `auto-deploy.sh` and `deploy-prod.sh`
write a sentinel marker:

```
~/public_html/.imporlan_docroot
```

Before the next deploy, both scripts check that:

- the sentinel exists, **OR**
- the existing `index.html` contains an Imporlan-identifying string
  (`imporlan` or `Importación de Lanchas`).

If neither is true the deploy aborts with exit code 2 and takes a
**defensive snapshot** of whatever was at `~/public_html/` into
`~/backups/unknown_docroot_<timestamp>` so we can recover it if it
turns out to be another site's content.

### 2. Post-deploy verification + auto-rollback

After deploying, `auto-deploy.sh` curls `https://www.imporlan.cl/` and
requires the response to contain an Imporlan marker. If it doesn't:

- the script logs an `ALERT:` line into `~/auto-deploy.log`,
- restores the previous `index.html` from the pre-deploy snapshot,
- exits with code 3.

Cron should be configured to email/notify on non-zero exits.

### 3. Reusable guard for Tourevo (or any other site)

`deploy-guard.sh` is a stand-alone script in this repo intended to be
**copied into the Tourevo repo** (or any other repo that deploys into
this cPanel account). It performs the same sentinel+marker check but
parameterised, so each site protects its own doc-root.

Example call from a hypothetical Tourevo `deploy-prod.sh`:

```bash
# Refuse to overwrite a non-Tourevo doc-root
bash deploy-guard.sh \
  --target /home/wwimpo/tourevo \
  --site tourevo \
  --marker 'Tourevo|Tours Privados' \
  --backup-dir /home/wwimpo/backups
GUARD_EXIT=$?
[ "$GUARD_EXIT" -ne 0 ] && exit "$GUARD_EXIT"
```

And after a successful deploy Tourevo should write its own sentinel:

```bash
echo "Tourevo doc-root, last deploy: $(date)" > /home/wwimpo/tourevo/.tourevo_docroot
```

## Long-term permanent fix (cPanel restructure)

The short-term mitigations make accidental overwrites loud instead of
silent, but the structural problem is the **shared doc-root**. The
proper fix is to give each domain its own physical directory:

```
/home/wwimpo/imporlan.cl/        <- new Imporlan doc-root
/home/wwimpo/tourevo.cl/         <- new Tourevo doc-root
/home/wwimpo/public_html/        <- only a parking page (or empty)
```

### Steps (perform once, requires hosting admin access)

1. **In cPanel: change Imporlan's primary doc-root.**

   On banahosting cPanel this is typically under *Domains → Manage →
   Document Root*. Some shared-hosting providers do not allow changing
   the primary domain's doc-root through the panel; if that's the
   case, open a ticket with banahosting support requesting:

   > Please change the document root of the primary domain
   > `imporlan.cl` from `public_html` to `imporlan.cl` (a sibling
   > directory of `public_html`).

2. **Stop the auto-deploy cron** temporarily so it doesn't fight us.

3. **Move the current contents:**

   ```bash
   mkdir -p ~/imporlan.cl
   # Move everything except .htaccess-protected dotfiles and tourevo bits
   rsync -av --exclude='.htaccess' --exclude='.tourevo*' \
         ~/public_html/ ~/imporlan.cl/
   # Copy the .htaccess separately so we can review it
   cp ~/public_html/.htaccess ~/imporlan.cl/.htaccess
   ```

4. **Confirm Tourevo content is isolated.** If Tourevo was already
   addon'd to a separate folder (likely `~/tourevo.cl/` or
   `~/public_html/tourevo/`), nothing more to do. If Tourevo content
   is currently scattered in `~/public_html/` (e.g. `assets/tours/`,
   `assets/fleet/`, `photo-service/`, `/tourevo/`), move it to
   `~/tourevo.cl/` and make sure Tourevo's vhost points there.

5. **Update `auto-deploy.sh`** so `PUBLIC_HTML="/home/wwimpo/imporlan.cl"`.

6. **Re-enable the cron**, run a deploy, verify https://imporlan.cl
   still serves Imporlan content.

7. **Communicate the change** to whoever maintains Tourevo's deploy
   pipeline so they update their own `PUBLIC_HTML` constant.

After the restructure, the two sites cannot overwrite each other even
in the worst case (faulty deploy script, FTP into the wrong folder,
manual `rm -rf` typo). The deploy-guard.sh + sentinel system stays
in place as defence in depth.

## Quick reference: incident response

If imporlan.cl serves the wrong content again:

```bash
# 1. Confirm the swap is at the filesystem level (not Cloudflare cache):
curl -fsSI https://www.imporlan.cl/.imporlan_docroot   # expect 200
curl -fsSL https://www.imporlan.cl/ | grep -oE '<title>[^<]+</title>'

# 2. Restore the home page from the latest main:
TMP=~/imporlan-restore-$(date +%s)
git clone --depth=1 https://github.com/jpchs1/Imporlan.git "$TMP"
cp ~/public_html/index.html ~/public_html/index.html.foreign-backup-$(date +%s)
cp -a "$TMP/index.html" ~/public_html/index.html
rm -rf "$TMP"

# 3. Refresh the sentinel so the next auto-deploy won't trip the guard:
cat > ~/public_html/.imporlan_docroot <<EOF
Imporlan doc-root, restored manually $(date)
EOF
chmod 644 ~/public_html/.imporlan_docroot

# 4. Cloudflare -> Purge Everything.
# 5. Investigate auto-deploy.log + look at the .foreign-backup-* file to
#    identify which site's deploy ran into our doc-root.
```
