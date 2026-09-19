"""
Pruebas de la API contra un Redis real (usa claves msg:/req:/rl: y una clave legacy de prueba).

    CRYPTO_SETTINGS=tests/test.cfg venv/bin/python tests/test_api.py

tests/test.cfg de ejemplo:
    REDIS_HOST = 'localhost'
    REDIS_PASSWORD = None
    RATE_LIMITS = False
    SECURITY_LOG = '/tmp/crypto-security-test.log'
"""
import io, os, secrets, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app, r, looks_like_plaintext
c = app.test_client()
tok = lambda: secrets.token_urlsafe(32)[:43]
def env(flags=1, n=200): return b'CM\x02' + bytes([flags]) + os.urandom(28) + os.urandom(n)
def post(path, **kw):
    data = {k: (io.BytesIO(v), 'blob') if isinstance(v, bytes) else v for k, v in kw.items()}
    return c.post(path, data=data, content_type='multipart/form-data')
ok = lambda cond, msg: print(('OK  ' if cond else 'FAIL'), msg) or (cond or sys.exit(1))

t = tok()
res = post('/post', payload=env(), expire='86400', destroy='0', token=t); ok(res.status_code == 201, f'post {res.status_code}')
mid = res.json['id']; ok(len(mid) == 22, 'id len 22')
ok(post('/meta', id=mid, token=t).json == {'legacy': False, 'destroy': False, 'protected': False, 'expires_at': post('/meta', id=mid, token=t).json['expires_at']}, 'meta')
ok(post('/meta', id=mid, token=tok()).status_code == 404, 'meta bad token 404')
ok(post('/get', id=mid, token=tok()).status_code == 404, 'get bad token 404')
g = post('/get', id=mid, token=t); ok(g.status_code == 200 and g.data[:3] == b'CM\x02' and g.headers['X-Destroyed'] == '0', 'get ok')
ok(post('/delete', id=mid, token=tok()).status_code == 404, 'delete bad token')
for i in range(4): left = post('/fail_attempt', id=mid, token=t).json['attempts_left']
ok(left == 1, f'attempts left {left}')
ok(post('/fail_attempt', id=mid, token=t).status_code == 403, 'fifth failure destroys')
ok(post('/get', id=mid, token=t).status_code == 404, 'gone after failures')

t = tok(); mid = post('/post', payload=env(3), expire='30', destroy='1', token=t).json['id']
m = post('/meta', id=mid, token=t).json; ok(m['destroy'] and m['protected'], 'meta destroy+protected')
ok(post('/get', id=mid, token=tok()).status_code == 404, 'bad token does not burn')
g = post('/get', id=mid, token=t); ok(g.headers['X-Destroyed'] == '1', 'burned on read')
ok(post('/get', id=mid, token=t).status_code == 404, 'second read 404')

ok(post('/post', payload=b'hello world plain text ' * 20, expire='86400', token=tok()).status_code == 400, 'reject non-envelope')
ok(post('/post', payload=b'CM\x02\x01' + b'A' * 300, expire='86400', token=tok()).status_code == 400, 'reject plaintext in envelope')
ok(post('/post', payload=env(2), expire='86400', token=tok()).status_code == 400, 'reject password-only envelope')
for e in ('0', '-5', 'abc', '999999999'):
    ok(post('/post', payload=env(), expire=e, token=tok()).status_code == 400, f'reject expire={e}')
ok(post('/post', payload=env(), expire='86400', token='short').status_code == 400, 'reject bad token')
big = app.config['MAX_PAYLOAD_BYTES']
s = post('/post', payload=env(n=big), expire='86400', token=tok()).status_code; ok(s == 413, f'too large {s}')

# legacy record
r.set('LegacyAbc1', 'destroy{"message": "U2FsdGVkX1xyz", "files": []}', ex=60)
ok(post('/meta', id='LegacyAbc1').json['destroy'] is True, 'legacy meta')
lg = post('/get', id='LegacyAbc1').json; ok(lg['msg'] == 'U2FsdGVkX1xyz' and lg['destroyed'], 'legacy get destroys')
ok(post('/get', id='LegacyAbc1').status_code == 404, 'legacy gone')

# requests
own, rsp = tok(), tok()
rq = post('/request/create', expire='86400', owner_token=own, respond_token=rsp); ok(rq.status_code == 201, 'request create')
rid = rq.json['id']
ok(post('/request/info', id=rid, token=rsp).json['status'] == 'pending', 'info pending')
ok(post('/request/info', id=rid, token=own).status_code == 404, 'owner token not valid for info')
ok(post('/request/status', id=rid, token=own).json['status'] == 'pending', 'status pending')
ok(post('/request/open', id=rid, token=own).status_code == 409, 'open pending 409')
box = b'CM\x03\x00' + os.urandom(16 + 12 + 65 + 100)
ok(post('/request/respond', id=rid, token=own, payload=box).status_code == 404, 'owner cannot respond')
ok(post('/request/respond', id=rid, token=rsp, payload=b'plain text answer ' * 20).status_code == 400, 'reject plaintext answer')
ok(post('/request/respond', id=rid, token=rsp, payload=box).status_code == 201, 'respond')
ok(post('/request/respond', id=rid, token=rsp, payload=box).status_code == 409, 'second respond 409')
ok(post('/request/status', id=rid, token=own).json['status'] == 'answered', 'status answered')
ok(post('/request/open', id=rid, token=rsp).status_code == 404, 'respond token cannot open')
o = post('/request/open', id=rid, token=own); ok(o.data == box, 'open returns box')
ok(post('/request/status', id=rid, token=own).status_code == 404, 'deleted after open')
r.delete('LegacyAbc1')
print('Todas las pruebas pasaron')
