# Deployment to IMPORLAN Servers

## Server Structure
- **Test**: `https://www.imporlan.cl/panel-test/admin/` (files at `/public_html/panel-test/`)
- **Production**: `https://www.imporlan.cl/panel/admin/` (files at `/public_html/panel/`)
- **API (test)**: `https://www.imporlan.cl/test/api/` (files at `/public_html/test/api/`)
- **API (prod)**: `https://www.imporlan.cl/api/` (files at `/public_html/api/`)

## Deployment Method

Use the cPanel UAPI `upload_files` endpoint. The `save_file_content` endpoint does NOT work reliably for large files.

### Working Upload Method (Python)
```python
import requests, os

username = os.environ['BANAHOSTING_USER']
password = os.environ['BANAHOSTING_PASSWORD']
url = "https://imporlan.cl:2083/execute/Fileman/upload_files"

params = {
    'api.version': '1',
    'dir': '/public_html/panel/admin/assets',  # target directory
    'overwrite': '1',  # REQUIRED for existing files
}
with open('local/path/to/file.js', 'rb') as f:
    files = {'file-1': ('filename.js', f, 'application/javascript')}
    resp = requests.post(url, params=params, files=files, auth=(username, password), verify=True)
print(resp.json())
```

### Key Notes
- **Always use `overwrite=1`** for existing files, otherwise upload fails with "file already exists"
- **`save_file_content` rejects `/` in the `file` parameter** - do NOT use it for files with paths
- **`save_file_content` with `--data-urlencode`** reports HTTP 200 success but may NOT actually write the file. Always verify with `curl` after deployment.
- Credentials are stored as secrets: `BANAHOSTING_USER` and `BANAHOSTING_PASSWORD`

## Cache Busting

The admin panel `index.html` references JS files with `?v=N` query params. After deploying updated JS files:
1. Increment the version number in `panel/admin/index.html` (e.g., `?v=5` -> `?v=6`)
2. Deploy the updated `index.html` to both test and production
3. Users need to hard refresh (`Ctrl+Shift+R`) or the new version param forces fresh load

## Verification

Always verify deployments with curl:
```bash
curl -s "https://www.imporlan.cl/panel/admin/assets/expedientes-admin-v2.js?_cb=$(date +%s)" | rg "expected_text"
```

## Deploy All Modified Files Pattern

When deploying multiple files, iterate over a list of (local_path, test_dir, prod_dir, filename) tuples and upload each to both servers.
