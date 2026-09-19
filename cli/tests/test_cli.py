"""
Pruebas del CLI.

1. Compatibilidad: lo que cifra Python lo abre el código real del navegador y al revés.
   Requiere Node 20+ y compilar el cifrado del frontend:
       cd frontend && npx tsc src/crypto/encoding.ts src/crypto/envelope.ts src/crypto/payload.ts \\
           src/crypto/sealedBox.ts --outDir /tmp/jscrypto --module commonjs --target es2020 --lib es2020,dom --skipLibCheck
       JS_CRYPTO_DIR=/tmp/jscrypto python cli/tests/test_cli.py
2. Punta a punta contra el servidor Flask real (Redis): CRYPTO_SETTINGS=tests/test.cfg (ver tests/test_api.py).
"""
import base64
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(HERE))

from crypto_cli import formats as F  # noqa: E402
from crypto_cli.__main__ import main  # noqa: E402
from crypto_cli.links import ShareLink  # noqa: E402

b64 = lambda d: base64.b64encode(d).decode()  # noqa: E731
unb64 = base64.b64decode
results = []


def check(cond, msg):
    results.append((cond, msg))
    print(('OK  ' if cond else 'FAIL'), msg)


def node(op):
    out = subprocess.run(
        ['node', os.path.join(HERE, 'js_bridge.js'), os.environ['JS_CRYPTO_DIR']],
        input=json.dumps(op), capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def test_python_roundtrip():
    payload = F.Payload('hola ñandú 🔐', [F.Attachment('a b.bin', bytes(range(256)), 'application/octet-stream')])
    key = os.urandom(32)
    env = F.seal(payload.encode(), link_key=key, password='clave larga 123')
    got = F.Payload.decode(F.open_envelope(env, link_key=key, password='clave larga 123'))
    check(got == payload, 'Python: sobre con clave de enlace + contraseña')
    try:
        F.open_envelope(env, link_key=key, password='otra clave 123')
        check(False, 'Python: contraseña incorrecta rechazada')
    except F.DecryptError:
        check(True, 'Python: contraseña incorrecta rechazada')
    tampered = bytearray(env)
    tampered[-1] ^= 1
    try:
        F.open_envelope(bytes(tampered), link_key=key, password='clave larga 123')
        check(False, 'Python: contenido alterado rechazado')
    except F.DecryptError:
        check(True, 'Python: contenido alterado rechazado')
    keys = F.RequestKeys.generate()
    check(F.Payload.decode(F.open_sealed(keys, F.seal_to(keys.public_key, payload.encode()))) == payload, 'Python: caja sellada')


def test_cross_compat():
    if not os.environ.get('JS_CRYPTO_DIR'):
        print('SKIP compatibilidad con el navegador (falta JS_CRYPTO_DIR)')
        return
    files = [{'name': 'foto.png', 'type': 'image/png', 'data': b64(os.urandom(300))}]
    for link_key, password in ((os.urandom(32), None), (os.urandom(32), 'clave larga 123'), (None, 'solo contraseña 1')):
        label = f"{'enlace' if link_key else ''}{'+' if link_key and password else ''}{'contraseña' if password else ''}"
        js = node({'op': 'seal', 'message': 'desde JS ✓', 'files': files, 'linkKey': b64(link_key) if link_key else None, 'password': password})
        got = F.Payload.decode(F.open_envelope(unb64(js['envelope']), link_key=link_key, password=password))
        check(got.message == 'desde JS ✓' and got.files[0].data == unb64(files[0]['data']) and got.files[0].name == 'foto.png',
              f'JS cifra → Python abre ({label})')
        if link_key:
            check(js['token'] == F.access_token(link_key), f'token de acceso idéntico ({label})')
        py = F.seal(F.Payload('desde Python ✓', [F.Attachment('x.txt', b'abc', 'text/plain')]).encode(), link_key=link_key, password=password)
        out = node({'op': 'open', 'envelope': b64(py), 'linkKey': b64(link_key) if link_key else None, 'password': password})
        check(out.get('message') == 'desde Python ✓' and unb64(out['files'][0]['data']) == b'abc', f'Python cifra → JS abre ({label})')

    js_keys = node({'op': 'keys'})
    keys = F.RequestKeys(unb64(js_keys['publicKey']), unb64(js_keys['privateKey']))
    check(keys.owner_token() == js_keys['owner'] and F.respond_token(keys.public_key) == js_keys['respond'], 'tokens de solicitud idénticos')
    box = node({'op': 'sealTo', 'publicKey': js_keys['publicKey'], 'message': 'respuesta JS'})
    check(F.Payload.decode(F.open_sealed(keys, unb64(box['box']))).message == 'respuesta JS', 'JS responde → Python abre el buzón')
    py_keys = F.RequestKeys.generate()
    py_box = F.seal_to(py_keys.public_key, F.Payload('respuesta Python').encode())
    out = node({'op': 'openSealed', 'publicKey': b64(py_keys.public_key), 'privateKey': b64(py_keys.private_key), 'box': b64(py_box)})
    check(out.get('message') == 'respuesta Python', 'Python responde → JS abre el buzón')


def run_cli(*argv, stdin_text=None, env=None):
    old_env = dict(os.environ)
    os.environ.update(env or {})
    out, err = io.StringIO(), io.StringIO()
    old_stdin = sys.stdin
    if stdin_text is not None:
        sys.stdin = io.TextIOWrapper(io.BytesIO(stdin_text.encode()), encoding='utf-8')
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(list(argv))
    finally:
        sys.stdin = old_stdin
        os.environ.clear()
        os.environ.update(old_env)
    return code, out.getvalue(), err.getvalue()


def test_end_to_end():
    if not os.environ.get('CRYPTO_SETTINGS'):
        print('SKIP punta a punta (falta CRYPTO_SETTINGS)')
        return
    sys.path.insert(0, ROOT)
    from werkzeug.serving import make_server
    from app import app
    server = make_server('127.0.0.1', 0, app)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}'
    try:
        code, out, _ = run_cli('share', '--server', url, '--json', '--password-env', 'PW', stdin_text='secreto por stdin\n', env={'PW': 'clave larga 123'})
        link = json.loads(out)['link']
        check(code == 0 and '#c=' in link, 'share: crea enlace con la clave en el fragmento')
        cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as tmp:
            os.chdir(tmp)
            try:
                code, _, err = run_cli('open', link, '--json', '--password-env', 'PW', env={'PW': 'mala clave 123'})
                recovery = [f for f in os.listdir(tmp) if f.endswith('.recovery')]
                check(code == 4 and len(recovery) == 1, 'open: contraseña incorrecta en mensaje destruido → archivo de recuperación')
                check(oct(os.stat(recovery[0]).st_mode & 0o777) == '0o600', 'recuperación: permisos 600')
                code, _, _ = run_cli('open', link, '--password-env', 'PW', env={'PW': 'clave larga 123'})
                check(code == 3, 'open: el mensaje ya no está en el servidor (código 3)')
                code, out, _ = run_cli('open', recovery[0], '--json', '--password-env', 'PW', env={'PW': 'clave larga 123'})
                check(code == 0 and json.loads(out)['message'] == 'secreto por stdin' and not os.listdir(tmp),
                      'recuperación: descifra con la contraseña correcta y se borra el archivo')
            finally:
                os.chdir(cwd)

        code, out, _ = run_cli('share', 'con intentos', '--keep', '--server', url, '--password-env', 'PW', env={'PW': 'clave larga 123'})
        link = out.strip()
        for i in range(4):
            code, _, err = run_cli('open', link, '--password-env', 'PW', env={'PW': 'mala clave 123'})
        check(code == 4 and 'Intentos restantes: 1' in err, 'open: descuenta intentos en mensajes no destruidos')
        code, _, _ = run_cli('open', link, '--password-env', 'PW', env={'PW': 'mala clave 123'})
        check(code == 3, 'open: al quinto intento el mensaje se elimina')

        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, 'datos.bin')
            with open(src, 'wb') as f:
                f.write(os.urandom(5000))
            code, out, _ = run_cli('share', 'con archivo', '-f', src, '--keep', '--server', url)
            link = out.strip()
            code, out, _ = run_cli('open', link, '-o', os.path.join(tmp, 'out'), '--json')
            saved = json.loads(out)['saved']
            with open(src, 'rb') as a, open(os.path.join(tmp, 'out', 'datos.bin'), 'rb') as b:
                check(code == 0 and a.read() == b.read() and 'message' not in json.loads(out), 'open -o: guarda archivos sin imprimir el contenido')
            check(any(p.endswith('message.txt') for p in saved), 'open -o: guarda el mensaje en message.txt')
            code, _, _ = run_cli('delete', link)
            check(code == 0, 'delete: borra el mensaje')

        code, out, _ = run_cli('encrypt', 'local', '--json', '--password-env', 'PW', env={'PW': 'clave larga 123'})
        local = json.loads(out)['code']
        code, out, _ = run_cli('open', '-', '--json', '--password-env', 'PW', stdin_text=local, env={'PW': 'clave larga 123'})
        check(code == 0 and json.loads(out)['message'] == 'local', 'encrypt/open local sin servidor')

        code, out, _ = run_cli('request', 'create', '--server', url, '--json', '-l', 'API key', '--passcode-env', 'PC', env={'PC': 'codigo buzon 1'})
        req = json.loads(out)
        check(code == 0 and req['locked'] and '/inbox#' in req['inbox_link'], 'request create: con código')
        code, out, _ = run_cli('request', 'status', req['inbox_link'], '--json', '--passcode-env', 'PC', env={'PC': 'codigo buzon 1'})
        check(json.loads(out)['status'] == 'pending', 'request status: pendiente')
        code, _, _ = run_cli('request', 'status', req['inbox_link'], '--passcode-env', 'PC', env={'PC': 'codigo malo 1'})
        check(code == 4, 'request: código incorrecto → código 4')
        code, _, _ = run_cli('request', 'respond', req['request_link'], 'sk-123', '--json')
        check(code == 0, 'request respond')
        code, _, _ = run_cli('request', 'respond', req['request_link'], 'otra', '--json')
        check(code != 0, 'request respond: segunda respuesta rechazada')
        code, out, _ = run_cli('request', 'open', req['inbox_link'], '--json', '--passcode-env', 'PC', env={'PC': 'codigo buzon 1'})
        check(code == 0 and json.loads(out)['message'] == 'sk-123', 'request open: retira la respuesta')

        # Enlace creado en "la web" (formato del navegador) abierto con el CLI
        if os.environ.get('JS_CRYPTO_DIR'):
            key = os.urandom(32)
            js = node({'op': 'seal', 'message': 'creado en la web', 'files': [], 'linkKey': b64(key), 'password': None})
            from crypto_cli.api import Client
            res = Client(url).create_share(unb64(js['envelope']), 86400, False, js['token'])
            code, out, _ = run_cli('open', str(ShareLink(url, res['id'], key)), '--json')
            check(code == 0 and json.loads(out)['message'] == 'creado en la web', 'enlace de la web → CLI lo abre')
    finally:
        server.shutdown()


if __name__ == '__main__':
    test_python_roundtrip()
    test_cross_compat()
    test_end_to_end()
    failed = [m for ok, m in results if not ok]
    print(f'\n{len(results) - len(failed)}/{len(results)} pruebas OK')
    sys.exit(1 if failed else 0)
