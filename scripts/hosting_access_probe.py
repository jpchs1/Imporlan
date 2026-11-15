"""Inspect account-level hosting security controls without changing them."""
import base64
import http.cookiejar
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

HOST = 'https://imporlan.cl:2083'
user = os.environ.get('BANAHOSTING_USER', '')
password = os.environ.get('BANAHOSTING_PASSWORD', '')
for name in ('BANAHOSTING_USER', 'BANAHOSTING_PASSWORD'):
    print(name + ': ' + ('configured' if os.environ.get(name) else 'missing'), flush=True)
if not user or not password:
    raise SystemExit('Hosting credentials are unavailable; no hosting configuration was changed.')

jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def request(path, body=None, basic=False):
    headers = {'User-Agent': 'Imporlan-Authorized-Hosting-Administration/1.0'}
    if basic:
        headers['Authorization'] = 'Basic ' + base64.b64encode((user + ':' + password).encode()).decode()
    if body is not None:
        body = urllib.parse.urlencode(body).encode()
    req = urllib.request.Request(HOST + path, headers=headers, data=body)
    try:
        with client.open(req, timeout=30) as response:
            return response.read(2000000).decode('utf-8', errors='replace')
    except urllib.error.HTTPError as error:
        print('Hosting HTTP status:', error.code, flush=True)
        raise SystemExit('Hosting request rejected; no response body or credentials logged.')
    except (urllib.error.URLError, TimeoutError):
        raise SystemExit('Hosting connection unavailable; no configuration was changed.')


features = json.loads(request('/execute/Features/list_features', basic=True))
print('cPanel Features API status:', features.get('status'), flush=True)
data = features.get('data') or {}
if isinstance(data, dict):
    print('Security feature names:', sorted(k for k in data if any(s in k.lower() for s in ('imun', 'security', 'modsec', 'firewall', 'terminal'))), flush=True)

session = json.loads(request('/login/?login_only=1', {'user': user, 'pass': password}))
prefix = session.get('security_token', '')
if session.get('status') != 1 or not re.fullmatch(r'/cpsess\d+', prefix):
    raise SystemExit('cPanel login did not return an authenticated session. No configuration was changed.')
print('cPanel authenticated session established; session stays in memory.', flush=True)
page = request(prefix + '/frontend/jupiter/index.html')
links = re.findall(r'(?:href|src)=["\']([^"\']+)["\']', page)
security_links = [v for v in links if 'imun' in v.lower()]
print('Imunify UI links:', [v.replace(prefix, '[session]') for v in security_links], flush=True)
for path in security_links[:2]:
    full = urllib.parse.urljoin(HOST + prefix + '/frontend/jupiter/index.html', path)
    parsed = urllib.parse.urlsplit(full)
    if parsed.netloc != urllib.parse.urlsplit(HOST).netloc:
        continue
    plugin = request(parsed.path + ('?' + parsed.query if parsed.query else ''))
    print('Imunify interface loaded. Whitelist controls referenced:', bool(re.search('white.?list|allow.?list|ip.?management', plugin, re.I)), flush=True)
    scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)', plugin)
    print('Imunify script paths:', [v.replace(prefix, '[session]') for v in scripts[:8]], flush=True)
print('Read-only hosting inspection finished. No security configuration was changed.', flush=True)
