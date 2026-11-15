"""One authorized bank credit; use existing API validation and idempotency."""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = 'https://www.imporlan.cl/api/'
KEY = 'imp00035-p3-saldo-20261114'
AMOUNT = 3305632


def stop(message):
    raise SystemExit(message)


def api(path, data=None, token=None):
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json',
               'User-Agent': 'Imporlan-Authorized-Reconciliation/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, headers=headers,
                                 data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raw = error.read(16384).decode('utf-8', errors='replace')
        print('API endpoint:', path, 'HTTP:', error.code,
              'server:', error.headers.get('Server', ''),
              'content-type:', error.headers.get('Content-Type', ''))
        try:
            parsed = json.loads(raw)
            message = parsed.get('error') or parsed.get('message') or parsed.get('detail')
            if isinstance(message, str):
                for value in (os.environ.get('IMPORLAN_ADMIN_EMAIL'),
                              os.environ.get('IMPORLAN_ADMIN_PASSWORD'), token):
                    if value:
                        message = message.replace(value, '[redacted]')
                print('API diagnostic:', message[:300])
        except (ValueError, AttributeError):
            for marker in ('ModSecurity', 'cloudflare', 'Access Denied', 'Forbidden', 'captcha'):
                if marker.lower() in raw.lower():
                    print('Response marker:', marker)
        stop('Request rejected; no response body or credential values logged.')
    except (urllib.error.URLError, TimeoutError, ValueError):
        stop('API outcome could not be verified. Read current state before retrying; keep the same idempotency key.')


def balance(request):
    total = int(request['amount_clp'])
    confirmed = sum(int(c['amount_clp']) for c in request.get('payment_credits', [])
                    if c.get('status') == 'confirmed')
    if request.get('status') == 'paid':
        confirmed = max(total, confirmed)
    return total, confirmed, max(0, total - confirmed)


def target(token):
    result = api('payment_requests_api.php?action=admin_list&user_email=alathrop%40lontue.com&limit=100', token=token)
    if not result.get('success') or int(result.get('pages', 1)) > 1:
        stop('Payment list incomplete; nothing recorded.')
    matches = []
    for request in result.get('requests', []):
        meta = request.get('metadata') or {}
        fields = meta.get('custom_fields') or {}
        order_matches = str(meta.get('order_id', '')) == '35' or meta.get('order_number') == 'IMP-00035'
        if (request.get('user_email', '').lower() == 'alathrop@lontue.com'
                and order_matches and str(fields.get('pago', '')) == '3'
                and request.get('status') in ('pending', 'paid')):
            matches.append(request)
    if len(matches) != 1:
        stop('Expected exactly one active Pago 3 for IMP-00035; nothing recorded.')
    return matches[0]


def main():
    names = ('IMPORLAN_ADMIN_EMAIL', 'IMPORLAN_ADMIN_PASSWORD')
    for name in names:
        print(name + ': ' + ('configured' if os.environ.get(name) else 'missing'))
    if not all(os.environ.get(name) for name in names):
        stop('Required repository secrets are not available to this workflow.')
    login = api('auth/login', {'email': os.environ[names[0]], 'password': os.environ[names[1]]})
    if login.get('requires_2fa'):
        stop('Admin panel requires 2FA. Nothing recorded; temporary token not logged.')
    token = login.get('access_token')
    if not token or login.get('user', {}).get('role') not in ('admin', 'support'):
        stop('No authorized admin session. Nothing recorded.')
    print('Admin authentication verified; token stays in memory.')
    request = target(token)
    before = balance(request)
    credits = [c for c in request.get('payment_credits', []) if c.get('status') == 'confirmed']
    existing = [c for c in credits if c.get('idempotency_key') == KEY or
                (int(c.get('amount_clp', 0)) == AMOUNT and c.get('received_on') == '2026-11-14'
                 and c.get('bank') == 'santander')]
    if existing:
        print('Credit already recorded; no duplicate created. Balance:', before)
        return
    if before != (12805632, 9500000, AMOUNT) or request.get('status') != 'pending':
        stop('Balance differs from the authorized operation; nothing recorded. Balance: ' + str(before))
    payload = {'request_id': request['id'], 'amount_clp': AMOUNT,
               'received_on': '2026-11-14', 'bank': 'santander',
               'reference': 'Scotiabank 14-11-2026 10:40',
               'note': 'Abono recibido OK. Ingreso confirmado por Juan Pablo. Transferencia de Alberto Eduardo Lathrop Ernst: saldo cuota 3 - lathrop. Aviso Scotiabank del 14-11-2026 10:40 a la cuenta Santander de Imporlan.',
               'receipt_id': '', 'idempotency_key': KEY,
               'expected_amount_clp': before[0], 'expected_remaining_clp': before[2]}
    result = api('payment_requests_api.php?action=register_credit', payload, token)
    if not result.get('success'):
        stop('Registration not confirmed; read state before any retry.')
    after = target(token)
    matching = [c for c in after.get('payment_credits', []) if c.get('idempotency_key') == KEY
                and c.get('status') == 'confirmed' and int(c.get('amount_clp', 0)) == AMOUNT]
    if len(matching) != 1 or after.get('status') != 'paid' or balance(after) != (12805632, 12805632, 0):
        stop('Registration response received but final readback differs; do not repeat blindly.')
    print('VERIFIED: IMP-00035 / Pago 3; credit CLP 3,305,632 received 2026-11-14; Santander; status paid; confirmed CLP 12,805,632; remaining CLP 0.')


if __name__ == '__main__':
    main()
