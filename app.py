"""
Crypto Messenger - backend.

El servidor solo almacena sobres cifrados en el navegador (AES-256-GCM).
Nunca recibe la clave: vive en el fragmento (#) del enlace, que los
navegadores no envían al servidor. Cada mensaje se protege además con un
token de acceso derivado de esa clave, así que conocer el ID no alcanza
para leerlo, borrarlo ni quemarlo.
"""
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import string
import sys
import time
from functools import wraps

from flask import Flask, Response, jsonify, request, send_from_directory
from redis import Redis
from werkzeug.middleware.proxy_fix import ProxyFix

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.join(BASE_DIR, 'frontend', 'build')

app = Flask(__name__, static_folder=os.path.join(BUILD_DIR, 'static'), static_url_path='/static')

# Valores por defecto seguros; app.cfg (o CRYPTO_SETTINGS) los sobreescribe
app.config.update(
    REDIS_HOST='localhost',
    REDIS_PORT=6379,
    REDIS_PASSWORD=None,
    REDIS_SSL=False,
    # Tamaño máximo del sobre cifrado (20 MB de archivos + overhead)
    MAX_PAYLOAD_BYTES=21 * 1024 * 1024,
    # Únicas expiraciones aceptadas (segundos)
    ALLOWED_EXPIRATIONS=(30, 86400, 604800, 2592000),
    # Si se define, rechaza mensajes nuevos cuando Redis supera este uso de memoria
    MAX_REDIS_MEMORY_BYTES=None,
    # Cantidad de proxies inversos de confianza delante de la app (0 = ninguno)
    TRUSTED_PROXIES=0,
    SECURITY_LOG=os.path.join(BASE_DIR, 'security.log'),
    # Orígenes extra permitidos por CORS (por defecto solo mismo origen)
    CORS_ORIGINS=(),
    # Enviar HSTS aunque la petición no llegue como https (TLS terminado en Apache)
    FORCE_HSTS=False,
    # Desactivar solo en tests
    RATE_LIMITS=True,
)
app.config.from_pyfile('app.cfg', silent=True)
app.config.from_envvar('CRYPTO_SETTINGS', silent=True)
app.config['MAX_CONTENT_LENGTH'] = app.config['MAX_PAYLOAD_BYTES'] + 64 * 1024

if app.config['TRUSTED_PROXIES']:
    n = int(app.config['TRUSTED_PROXIES'])
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=n, x_proto=n, x_host=n)

if app.config['CORS_ORIGINS']:
    from flask_cors import CORS
    CORS(app, origins=list(app.config['CORS_ORIGINS']))

r = Redis(
    host=app.config['REDIS_HOST'],
    port=app.config['REDIS_PORT'],
    password=app.config['REDIS_PASSWORD'],
    ssl=app.config['REDIS_SSL'],
)

#
# Registro de eventos de seguridad
#
security_log = logging.getLogger('crypto.security')
security_log.setLevel(logging.INFO)
security_log.propagate = False
try:
    _handler = logging.FileHandler(app.config['SECURITY_LOG'])
except OSError:
    _handler = logging.StreamHandler(sys.stderr)
_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
security_log.addHandler(_handler)


def client_ip():
    return request.remote_addr or 'unknown'


def id_ref(msg_id):
    # Nunca se registra el ID completo: con él se podría pedir el mensaje
    return hashlib.sha256((msg_id or '').encode()).hexdigest()[:12]


def security_event(event, level=logging.WARNING, msg_id=None, **fields):
    parts = [event, f'ip={client_ip()}']
    if msg_id:
        parts.append(f'ref={id_ref(msg_id)}')
    parts += [f'{k}={v}' for k, v in fields.items()]
    security_log.log(level, ' '.join(parts))


#
# Rate limiting por IP (ventana fija en Redis)
#
def rate_limit(bucket, limit, window):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not app.config['RATE_LIMITS']:
                return fn(*args, **kwargs)
            key = f'rl:{bucket}:{client_ip()}:{int(time.time() // window)}'
            p = r.pipeline()
            p.incr(key)
            p.expire(key, window)
            count = p.execute()[0]
            if count > limit:
                if count == limit + 1:
                    security_event('rate_limited', bucket=bucket)
                return jsonify({'error': 'rate_limited'}), 429, {'Retry-After': str(window)}
            return fn(*args, **kwargs)
        return wrapper
    return decorator


#
# Formato de almacenamiento
#
# Sobre (generado en el navegador):
#   'C' 'M' 0x02 | flags (1) | salt (16) | iv (12) | ciphertext + tag GCM (16+)
# Registro en Redis (clave msg:<id>):
#   0x02 | meta (1) | sha256(token) (32) | sobre
#
ENVELOPE_MAGIC = b'CM\x02'
ENVELOPE_HEADER_LEN = 4 + 16 + 12
GCM_TAG_LEN = 16
FLAG_LINK_KEY = 0x01
FLAG_PASSWORD = 0x02
META_DESTROY = 0x01
META_PASSWORD = 0x02
RECORD_VERSION = 2
RECORD_HEADER_LEN = 2 + 32
MAX_FAILED_ATTEMPTS = 5

ID_ALPHABET = string.ascii_letters + string.digits
ID_LEN = 22  # ~131 bits
ID_RE = re.compile(r'^[A-Za-z0-9]{22}$')
LEGACY_ID_RE = re.compile(r'^[A-Za-z0-9]{10}$')
TOKEN_RE = re.compile(r'^[A-Za-z0-9_-]{43}$')

# Lee el registro y, si es de un solo uso, lo borra en la misma operación
# atómica, pero solo si el token es correcto.
_fetch_script = r.register_script("""
local v = redis.call('GET', KEYS[1])
if not v then return {0} end
if string.sub(v, 3, 34) ~= ARGV[1] then return {-1} end
local ttl = redis.call('TTL', KEYS[1])
local destroyed = 0
if string.byte(v, 2) % 2 == 1 then
  redis.call('DEL', KEYS[1], KEYS[2])
  destroyed = 1
end
return {1, v, ttl, destroyed}
""")


def new_id():
    return ''.join(secrets.choice(ID_ALPHABET) for _ in range(ID_LEN))


def token_hash(token):
    return hashlib.sha256(token.encode()).digest()


def msg_key(msg_id):
    return f'msg:{msg_id}'


def fail_key(msg_id):
    return f'fail:{msg_id}'


def looks_like_plaintext(data):
    # Un ciphertext AES-GCM tiene ~37% de bytes imprimibles; texto plano, >90%
    sample = data[:4096]
    if len(sample) < 64:
        return False
    printable = sum(1 for b in sample if 32 <= b < 127 or b in (9, 10, 13))
    return printable / len(sample) > 0.9


def parse_envelope(blob):
    """Devuelve los flags del sobre o None si no es un sobre cifrado válido."""
    if len(blob) < ENVELOPE_HEADER_LEN + GCM_TAG_LEN or blob[:3] != ENVELOPE_MAGIC:
        return None
    flags = blob[3]
    if flags & ~(FLAG_LINK_KEY | FLAG_PASSWORD) or not flags & FLAG_LINK_KEY:
        return None
    if looks_like_plaintext(blob[ENVELOPE_HEADER_LEN:]):
        return None
    return flags


def expires_at(ttl):
    return int(time.time()) + ttl if ttl and ttl > 0 else None


def read_ids():
    """Valida id/token del formulario. Devuelve (id, token, legacy) o None si son inválidos."""
    msg_id = request.form.get('id', '')
    if LEGACY_ID_RE.match(msg_id):
        return msg_id, None, True
    token = request.form.get('token', '')
    if not ID_RE.match(msg_id) or not TOKEN_RE.match(token):
        return None
    return msg_id, token, False


def check_token(msg_id, token):
    """Devuelve el byte meta del mensaje, o None si no existe o el token no coincide."""
    head = r.getrange(msg_key(msg_id), 0, RECORD_HEADER_LEN - 1)
    if len(head) < RECORD_HEADER_LEN or head[0] != RECORD_VERSION:
        return None
    if not hmac.compare_digest(head[2:RECORD_HEADER_LEN], token_hash(token)):
        security_event('bad_token', msg_id=msg_id)
        return None
    return head[1]


def not_found():
    return jsonify({'error': 'not_found'}), 404


def bad_request(reason):
    security_event('invalid_request', level=logging.INFO, reason=reason)
    return jsonify({'error': 'invalid_request', 'reason': reason}), 400


#
# Mensajes del formato anterior (clave de 10 caracteres, cifrado CryptoJS).
# Solo lectura: se mantienen hasta que expiren.
#
def legacy_meta(msg_id):
    raw = r.get(msg_id)
    if raw is None:
        return None
    return {
        'legacy': True,
        'destroy': raw.startswith(b'destroy'),
        'protected': True,
        'expires_at': expires_at(r.ttl(msg_id)),
    }


def legacy_fetch(msg_id):
    p = r.pipeline(transaction=True)
    p.get(msg_id)
    p.ttl(msg_id)
    raw, ttl = p.execute()
    if raw is None:
        return not_found()
    destroyed = raw.startswith(b'destroy')
    if destroyed:
        # Solo borra quien lo leyó primero: DEL devuelve 1 una única vez
        if not r.delete(msg_id):
            return not_found()
        raw = raw[len(b'destroy'):]
        security_event('destroyed_on_read', level=logging.INFO, msg_id=msg_id, legacy=1)
    text = raw.decode('utf-8', errors='replace')
    msg, files = text, []
    try:
        data = json.loads(text)
        if isinstance(data, dict) and 'message' in data:
            msg = data.get('message', '')
            files = data.get('files') or []
    except ValueError:
        pass
    return jsonify({
        'legacy': True,
        'msg': msg,
        'files': files,
        'destroyed': destroyed,
        'expires_at': None if destroyed else expires_at(ttl),
    })


#
# Archivos estáticos y SPA
#
@app.route('/favicon.ico')
@app.route('/manifest.json')
@app.route('/logo192.png')
@app.route('/logo512.png')
@app.route('/robots.txt')
def serve_assets():
    return send_from_directory(BUILD_DIR, request.path.lstrip('/'))


@app.route('/')
@app.route('/<path:path>')
def serve_react(path=''):
    response = send_from_directory(BUILD_DIR, 'index.html')
    response.headers['Cache-Control'] = 'no-cache'
    return response


#
# API
#
@app.route('/post', methods=['POST'])
@rate_limit('post-min', 10, 60)
@rate_limit('post-hour', 60, 3600)
def post():
    try:
        expire = int(request.form.get('expire', ''))
    except ValueError:
        return bad_request('expire')
    if expire not in app.config['ALLOWED_EXPIRATIONS']:
        return bad_request('expire')

    token = request.form.get('token', '')
    if not TOKEN_RE.match(token):
        return bad_request('token')

    upload = request.files.get('payload')
    if upload is None:
        return bad_request('payload')
    blob = upload.read(app.config['MAX_PAYLOAD_BYTES'] + 1)
    if len(blob) > app.config['MAX_PAYLOAD_BYTES']:
        security_event('payload_too_large', size=len(blob))
        return jsonify({'error': 'payload_too_large'}), 413
    flags = parse_envelope(blob)
    if flags is None:
        # Solo se aceptan sobres cifrados: nada de texto plano en el servidor
        security_event('rejected_unencrypted_payload', size=len(blob))
        return bad_request('payload')

    max_memory = app.config['MAX_REDIS_MEMORY_BYTES']
    if max_memory and r.info('memory')['used_memory'] + len(blob) > max_memory:
        security_event('storage_full', level=logging.ERROR)
        return jsonify({'error': 'storage_full'}), 503

    meta = 0
    if request.form.get('destroy') == '1':
        meta |= META_DESTROY
    if flags & FLAG_PASSWORD:
        meta |= META_PASSWORD
    record = bytes([RECORD_VERSION, meta]) + token_hash(token) + blob

    for _ in range(5):
        msg_id = new_id()
        if r.set(msg_key(msg_id), record, ex=expire, nx=True):
            return jsonify({'id': msg_id, 'expires_at': expires_at(expire)}), 201
    security_event('id_collision', level=logging.ERROR)
    return jsonify({'error': 'server_error'}), 500


@app.route('/meta', methods=['POST'])
@rate_limit('read', 60, 60)
def meta():
    ids = read_ids()
    if ids is None:
        return bad_request('id')
    msg_id, token, legacy = ids
    if legacy:
        info = legacy_meta(msg_id)
        return jsonify(info) if info else not_found()

    meta_byte = check_token(msg_id, token)
    if meta_byte is None:
        return not_found()
    return jsonify({
        'legacy': False,
        'destroy': bool(meta_byte & META_DESTROY),
        'protected': bool(meta_byte & META_PASSWORD),
        'expires_at': expires_at(r.ttl(msg_key(msg_id))),
    })


@app.route('/get', methods=['POST'])
@rate_limit('read', 60, 60)
def get():
    ids = read_ids()
    if ids is None:
        return bad_request('id')
    msg_id, token, legacy = ids
    if legacy:
        return legacy_fetch(msg_id)

    result = _fetch_script(keys=[msg_key(msg_id), fail_key(msg_id)], args=[token_hash(token)])
    if result[0] == -1:
        security_event('bad_token', msg_id=msg_id)
        return not_found()
    if result[0] != 1:
        return not_found()
    _, record, ttl, destroyed = result
    if destroyed:
        security_event('destroyed_on_read', level=logging.INFO, msg_id=msg_id)
    headers = {'X-Destroyed': '1' if destroyed else '0'}
    exp = None if destroyed else expires_at(ttl)
    if exp:
        headers['X-Expires-At'] = str(exp)
    return Response(record[RECORD_HEADER_LEN:], mimetype='application/octet-stream', headers=headers)


@app.route('/fail_attempt', methods=['POST'])
@rate_limit('fail', 20, 60)
def fail_attempt():
    ids = read_ids()
    if ids is None:
        return bad_request('id')
    msg_id, token, legacy = ids
    if legacy:
        store_key = msg_id
        ttl = r.ttl(store_key)
        if ttl == -2:
            return not_found()
    else:
        meta_byte = check_token(msg_id, token)
        if meta_byte is None:
            return not_found()
        store_key = msg_key(msg_id)
        ttl = r.ttl(store_key)

    counter = fail_key(msg_id)
    p = r.pipeline()
    p.incr(counter)
    p.expire(counter, ttl if ttl > 0 else 3600)
    attempts = p.execute()[0]
    attempts_left = max(MAX_FAILED_ATTEMPTS - attempts, 0)
    if attempts_left == 0:
        r.delete(store_key, counter)
        security_event('destroyed_after_failed_attempts', msg_id=msg_id)
        return jsonify({'error': 'too_many_attempts', 'attempts_left': 0}), 403
    return jsonify({'success': True, 'attempts_left': attempts_left})


@app.route('/delete', methods=['POST'])
@rate_limit('delete', 10, 60)
def delete():
    ids = read_ids()
    if ids is None:
        return bad_request('id')
    msg_id, token, legacy = ids
    if legacy:
        store_key = msg_id
    else:
        meta_byte = check_token(msg_id, token)
        if meta_byte is None:
            return not_found()
        store_key = msg_key(msg_id)
    if not r.delete(store_key, fail_key(msg_id)):
        return not_found()
    security_event('deleted_by_user', level=logging.INFO, msg_id=msg_id)
    return jsonify({'success': True})


#
# Solicitudes: alguien pide un secreto y otra persona lo responde cifrado con
# la clave pública del solicitante (caja sellada v3). El servidor guarda solo
# hashes de los tokens y el texto cifrado; la clave pública viaja en el enlace.
#
#   req:<id>     0x03 | sha256(token dueño) (32) | sha256(token respuesta) (32)
#   reqans:<id>  caja sellada (una sola respuesta, se borra al retirarla)
#
SEALED_MAGIC = b'CM\x03\x00'
SEALED_HEADER_LEN = 4 + 16 + 12 + 65
REQUEST_VERSION = 3

_respond_script = r.register_script("""
local v = redis.call('GET', KEYS[1])
if not v or string.sub(v, 34, 65) ~= ARGV[1] then return 0 end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return 0 end
if redis.call('SET', KEYS[2], ARGV[2], 'PX', ttl, 'NX') then return 1 end
return -1
""")

_open_script = r.register_script("""
local v = redis.call('GET', KEYS[1])
if not v or string.sub(v, 2, 33) ~= ARGV[1] then return {0} end
local answer = redis.call('GET', KEYS[2])
if not answer then return {2} end
redis.call('DEL', KEYS[1], KEYS[2])
return {1, answer}
""")


def req_key(req_id):
    return f'req:{req_id}'


def answer_key(req_id):
    return f'reqans:{req_id}'


def parse_sealed_box(blob):
    if len(blob) < SEALED_HEADER_LEN + GCM_TAG_LEN or blob[:4] != SEALED_MAGIC:
        return False
    return not looks_like_plaintext(blob[SEALED_HEADER_LEN:])


def read_request_ids():
    req_id = request.form.get('id', '')
    token = request.form.get('token', '')
    if not ID_RE.match(req_id) or not TOKEN_RE.match(token):
        return None
    return req_id, token


def check_request_token(req_id, token, owner):
    head = r.get(req_key(req_id))
    if not head or head[0] != REQUEST_VERSION:
        return False
    stored = head[1:33] if owner else head[33:65]
    if not hmac.compare_digest(stored, token_hash(token)):
        security_event('bad_request_token', msg_id=req_id, owner=int(owner))
        return False
    return True


def request_status(req_id):
    return jsonify({
        'status': 'answered' if r.exists(answer_key(req_id)) else 'pending',
        'expires_at': expires_at(r.ttl(req_key(req_id))),
    })


@app.route('/request/create', methods=['POST'])
@rate_limit('post-min', 10, 60)
@rate_limit('post-hour', 60, 3600)
def request_create():
    try:
        expire = int(request.form.get('expire', ''))
    except ValueError:
        return bad_request('expire')
    if expire not in app.config['ALLOWED_EXPIRATIONS']:
        return bad_request('expire')
    owner = request.form.get('owner_token', '')
    respond = request.form.get('respond_token', '')
    if not TOKEN_RE.match(owner) or not TOKEN_RE.match(respond) or owner == respond:
        return bad_request('token')
    record = bytes([REQUEST_VERSION]) + token_hash(owner) + token_hash(respond)
    for _ in range(5):
        req_id = new_id()
        if r.set(req_key(req_id), record, ex=expire, nx=True):
            return jsonify({'id': req_id, 'expires_at': expires_at(expire)}), 201
    security_event('id_collision', level=logging.ERROR)
    return jsonify({'error': 'server_error'}), 500


@app.route('/request/info', methods=['POST'])
@rate_limit('read', 60, 60)
def request_info():
    ids = read_request_ids()
    if ids is None:
        return bad_request('id')
    if not check_request_token(*ids, owner=False):
        return not_found()
    return request_status(ids[0])


@app.route('/request/respond', methods=['POST'])
@rate_limit('post-min', 10, 60)
@rate_limit('post-hour', 60, 3600)
def request_respond():
    ids = read_request_ids()
    if ids is None:
        return bad_request('id')
    req_id, token = ids
    upload = request.files.get('payload')
    if upload is None:
        return bad_request('payload')
    blob = upload.read(app.config['MAX_PAYLOAD_BYTES'] + 1)
    if len(blob) > app.config['MAX_PAYLOAD_BYTES']:
        security_event('payload_too_large', size=len(blob))
        return jsonify({'error': 'payload_too_large'}), 413
    if not parse_sealed_box(blob):
        security_event('rejected_unencrypted_payload', msg_id=req_id, size=len(blob))
        return bad_request('payload')
    max_memory = app.config['MAX_REDIS_MEMORY_BYTES']
    if max_memory and r.info('memory')['used_memory'] + len(blob) > max_memory:
        security_event('storage_full', level=logging.ERROR)
        return jsonify({'error': 'storage_full'}), 503

    result = _respond_script(keys=[req_key(req_id), answer_key(req_id)], args=[token_hash(token), blob])
    if result == 0:
        security_event('bad_request_token', msg_id=req_id, owner=0)
        return not_found()
    if result == -1:
        return jsonify({'error': 'already_answered'}), 409
    security_event('request_answered', level=logging.INFO, msg_id=req_id)
    return jsonify({'success': True}), 201


@app.route('/request/status', methods=['POST'])
@rate_limit('read', 60, 60)
def request_status_owner():
    ids = read_request_ids()
    if ids is None:
        return bad_request('id')
    if not check_request_token(*ids, owner=True):
        return not_found()
    return request_status(ids[0])


@app.route('/request/open', methods=['POST'])
@rate_limit('read', 60, 60)
def request_open():
    ids = read_request_ids()
    if ids is None:
        return bad_request('id')
    req_id, token = ids
    result = _open_script(keys=[req_key(req_id), answer_key(req_id)], args=[token_hash(token)])
    if result[0] == 0:
        security_event('bad_request_token', msg_id=req_id, owner=1)
        return not_found()
    if result[0] == 2:
        return jsonify({'error': 'pending'}), 409
    security_event('request_retrieved', level=logging.INFO, msg_id=req_id)
    return Response(result[1], mimetype='application/octet-stream')


@app.route('/request/delete', methods=['POST'])
@rate_limit('delete', 10, 60)
def request_delete():
    ids = read_request_ids()
    if ids is None:
        return bad_request('id')
    req_id, token = ids
    if not check_request_token(req_id, token, owner=True):
        return not_found()
    r.delete(req_key(req_id), answer_key(req_id))
    security_event('request_deleted', level=logging.INFO, msg_id=req_id)
    return jsonify({'success': True})


#
# Errores y cabeceras de seguridad
#
@app.errorhandler(413)
def too_large(_e):
    security_event('payload_too_large')
    return jsonify({'error': 'payload_too_large'}), 413


CSP = '; '.join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


@app.after_request
def security_headers(response):
    h = response.headers
    h['Content-Security-Policy'] = CSP
    h['X-Content-Type-Options'] = 'nosniff'
    h['X-Frame-Options'] = 'DENY'
    h['Referrer-Policy'] = 'no-referrer'
    h['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), payment=()'
    h['Cross-Origin-Opener-Policy'] = 'same-origin'
    h['Cross-Origin-Resource-Policy'] = 'same-origin'
    if request.is_secure or app.config['FORCE_HSTS']:
        h['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains'
    if request.method == 'POST':
        h['Cache-Control'] = 'no-store'
    return response


#
# Servidor de desarrollo
#
def lan_addresses():
    """IPs de esta máquina en la red local (sin loopback)."""
    import socket
    ips = set()
    try:
        # No envía nada: solo pregunta al sistema qué interfaz usaría para salir
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(('10.255.255.255', 1))
            ips.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        ips.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith('127.'))


def dev_certificate(ips):
    """Certificado autofirmado para https en la LAN (WebCrypto exige un contexto seguro)."""
    import subprocess
    cert_dir = os.path.join(BASE_DIR, '.devcert')
    cert, key = os.path.join(cert_dir, 'cert.pem'), os.path.join(cert_dir, 'key.pem')
    san = ','.join(['DNS:localhost', 'IP:127.0.0.1'] + [f'IP:{ip}' for ip in ips])
    stamp = os.path.join(cert_dir, 'san.txt')
    if not (os.path.exists(cert) and os.path.exists(stamp) and open(stamp).read() == san):
        os.makedirs(cert_dir, mode=0o700, exist_ok=True)
        subprocess.run(
            ['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '365',
             '-keyout', key, '-out', cert, '-subj', '/CN=crypto-messenger-dev', '-addext', f'subjectAltName={san}'],
            check=True, capture_output=True,
        )
        with open(stamp, 'w') as f:
            f.write(san)
    return cert, key


if __name__ == '__main__':
    lan = os.environ.get('LAN') == '1'
    host = os.environ.get('HOST', '0.0.0.0' if lan else '127.0.0.1')
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_DEBUG') == '1'
    if debug and host not in ('127.0.0.1', 'localhost', '::1'):
        sys.exit('El modo debug de Werkzeug permite ejecutar código: solo se habilita en localhost.')
    if not os.path.exists(os.path.join(BUILD_DIR, 'index.html')):
        print('Aviso: falta el build del frontend. Ejecuta: cd frontend && npm run build')

    ips = lan_addresses() if host == '0.0.0.0' else []
    use_https = os.environ.get('HTTPS', '1' if lan else '0') == '1'
    ssl_context = dev_certificate(ips) if use_https else None
    scheme = 'https' if use_https else 'http'

    print('\n  Crypto Messenger')
    print(f'  Local:      {scheme}://localhost:{port}')
    for ip in ips:
        print(f'  En tu red:  {scheme}://{ip}:{port}')
    if host in ('127.0.0.1', 'localhost', '::1'):
        for ip in lan_addresses():
            print(f'  En tu red:  desactivado ({ip}). Para habilitarlo: LAN=1 python app.py')
    if ips and not use_https:
        print('  Aviso: sin https el cifrado no funciona desde otros equipos. Usa LAN=1.')
    if use_https:
        print('  Certificado autofirmado: el navegador pedirá confirmar la primera vez.')
    print()
    app.run(debug=debug, host=host, port=port, ssl_context=ssl_context)
