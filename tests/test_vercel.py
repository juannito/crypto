"""
Pruebas de la configuración de Vercel (no necesitan Redis salvo la última).

    venv/bin/python tests/test_vercel.py
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.environ.pop('CRON_SECRET', None)
from app import app, CSP
c = app.test_client()
ok = lambda cond, msg: print(('OK  ' if cond else 'FAIL'), msg) or (cond or sys.exit(1))

cfg = json.load(open(os.path.join(ROOT, 'vercel.json')))
headers = {h['key']: h['value'] for rule in cfg['headers'] if rule['source'] == '/(.*)' for h in rule['headers']}
# Las páginas estáticas las sirve la CDN: deben llevar las mismas cabeceras que la app
probe = c.post('/meta', data={})
for key in ('Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy',
            'Permissions-Policy', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Resource-Policy'):
    ok(headers.get(key) == probe.headers.get(key), f'vercel.json {key} igual a la app')
ok(headers['Content-Security-Policy'] == CSP, 'CSP idéntica')
ok(any(cr['path'] == '/heartbeat' for cr in cfg['crons']), 'cron del heartbeat')

# Sin CRON_SECRET, o con uno incorrecto, el heartbeat no existe
ok(c.get('/heartbeat').status_code == 404, 'heartbeat sin CRON_SECRET → 404')
os.environ['CRON_SECRET'] = 's3cret-de-prueba-123456'
ok(c.get('/heartbeat').status_code == 404, 'heartbeat sin Authorization → 404')
ok(c.get('/heartbeat', headers={'Authorization': 'Bearer otro'}).status_code == 404, 'heartbeat token incorrecto → 404')
if os.environ.get('WITH_REDIS') == '1':
    res = c.get('/heartbeat', headers={'Authorization': 'Bearer s3cret-de-prueba-123456'})
    ok(res.status_code == 200 and res.json['ok'] and res.headers['Cache-Control'] == 'no-store', 'heartbeat ok')
print('Todo OK')
