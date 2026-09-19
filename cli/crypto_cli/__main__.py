"""
crypto: cliente de línea de comandos de Crypto Messenger.

Cifra y descifra en esta máquina con los mismos formatos que el navegador.
El servidor solo recibe datos cifrados; la clave viaja en el fragmento (#) del enlace.
"""
import argparse
import base64
import getpass
import json
import mimetypes
import os
import sys

from . import __version__
from .api import ApiError, Client, default_server, remaining
from .formats import (
    LINK_KEY_LEN,
    Attachment,
    DecryptError,
    Payload,
    RequestKeys,
    access_token,
    format_local_code,
    open_envelope,
    open_sealed,
    parse_local_code,
    respond_token,
    seal,
    seal_to,
)
from .links import InboxLink, RequestLink, ShareLink, origin_of

EXPIRATIONS = {'30s': 30, '1d': 86400, '1w': 604800, '1m': 2592000}
MAX_TOTAL_BYTES = 20 * 1024 * 1024
MIN_PASSWORD = 8

EXIT_ERROR, EXIT_USAGE, EXIT_GONE, EXIT_WRONG_KEY = 1, 2, 3, 4


class CliError(Exception):
    def __init__(self, message: str, code: int = EXIT_ERROR):
        super().__init__(message)
        self.code = code


#
# Entrada
#
def read_secret(args, kind: str, *, required: bool, confirm: bool = False) -> str | None:
    """Contraseña o código: desde una variable de entorno o pidiéndola por teclado. Nunca como argumento."""
    env_name = getattr(args, f'{kind}_env', None)
    if env_name:
        value = os.environ.get(env_name)
        if not value:
            raise CliError(f'La variable de entorno {env_name} está vacía', EXIT_USAGE)
        return value
    if not (getattr(args, kind, False) or required):
        return None
    if not sys.stdin.isatty():
        raise CliError(f'Hace falta {kind}: usa --{kind}-env VARIABLE (no hay terminal para pedirla)', EXIT_USAGE)
    label = 'Contraseña' if kind == 'password' else 'Código del buzón'
    value = getpass.getpass(f'{label}: ')
    if confirm and getpass.getpass(f'Repite la {label.lower()}: ') != value:
        raise CliError('No coinciden', EXIT_USAGE)
    return value


def check_new_secret(value: str | None):
    if value is not None and len(value) < MIN_PASSWORD:
        raise CliError(f'Debe tener al menos {MIN_PASSWORD} caracteres', EXIT_USAGE)


def read_payload(args) -> Payload:
    """Mensaje (argumento o stdin) + archivos (-f)."""
    if args.text == '-' or (args.text is None and not sys.stdin.isatty()):
        message = sys.stdin.buffer.read().decode('utf-8')
    else:
        message = args.text or ''
    files = []
    for path in args.file or []:
        with open(path, 'rb') as f:
            data = f.read()
        files.append(Attachment(os.path.basename(path), data, mimetypes.guess_type(path)[0] or ''))
    if not message.strip() and not files:
        raise CliError('Nada que cifrar: pasa un mensaje, usa stdin o -f ARCHIVO', EXIT_USAGE)
    if len(message.encode()) + sum(len(f.data) for f in files) > MAX_TOTAL_BYTES:
        raise CliError('El contenido supera los 20 MB', EXIT_USAGE)
    return Payload(message.rstrip('\n') if args.text is None or args.text == '-' else message, files)


def parse_expire(value: str) -> int:
    if value in EXPIRATIONS:
        return EXPIRATIONS[value]
    raise argparse.ArgumentTypeError(f'usa uno de: {", ".join(EXPIRATIONS)}')


def server_for(args) -> str:
    server = args.server or default_server()
    if not server:
        raise CliError('Indica el servidor con --server URL o la variable CRYPTO_URL', EXIT_USAGE)
    return origin_of(server)


def client(args, origin: str) -> Client:
    return Client(origin, insecure=args.insecure or os.environ.get('CRYPTO_INSECURE') == '1')


#
# Salida
#
def emit(args, data: dict, human: str):
    print(json.dumps(data, ensure_ascii=False) if args.json else human)


def deliver(args, payload: Payload, extra: dict | None = None):
    """Con -o guarda en archivos sin imprimir el contenido; si no, lo muestra."""
    info = dict(extra or {})
    if args.output:
        os.makedirs(args.output, exist_ok=True)
        saved = []
        if payload.message:
            path = os.path.join(args.output, 'message.txt')
            with open(path, 'w', encoding='utf-8') as f:
                f.write(payload.message)
            saved.append(path)
        for att in payload.files:
            path = unique_path(args.output, att.name)
            with open(path, 'wb') as f:
                f.write(att.data)
            saved.append(path)
        info['saved'] = saved
        emit(args, info, '\n'.join(f'Guardado: {p}' for p in saved) or 'Sin contenido')
        return
    info['message'] = payload.message
    info['files'] = [{'name': a.name, 'size': len(a.data)} for a in payload.files]
    if args.json:
        emit(args, info, '')
        return
    if payload.message:
        print(payload.message)
    if payload.files:
        names = ', '.join(f'{a.name} ({len(a.data)} B)' for a in payload.files)
        print(f'\n[{len(payload.files)} archivo(s): {names}. Usa -o DIRECTORIO para guardarlos]', file=sys.stderr)


def unique_path(directory: str, name: str) -> str:
    safe = ''.join('_' if c in '/\\\0' or ord(c) < 32 else c for c in name).lstrip('.') or 'archivo'
    base, ext = os.path.splitext(safe)
    path, n = os.path.join(directory, safe), 1
    while os.path.exists(path):
        path = os.path.join(directory, f'{base} ({n}){ext}')
        n += 1
    return path


#
# Comandos
#
def cmd_share(args):
    payload = read_payload(args)
    password = read_secret(args, 'password', required=False, confirm=True)
    check_new_secret(password)
    origin = server_for(args)
    link_key = os.urandom(LINK_KEY_LEN)
    envelope = seal(payload.encode(), link_key=link_key, password=password)
    res = client(args, origin).create_share(envelope, args.expire, not args.keep, access_token(link_key))
    link = str(ShareLink(origin, res['id'], link_key))
    emit(
        args,
        {'link': link, 'expires_at': res.get('expires_at'), 'destroy_on_read': not args.keep, 'password': bool(password)},
        link,
    )


def cmd_encrypt(args):
    payload = read_payload(args)
    password = read_secret(args, 'password', required=True, confirm=True)
    check_new_secret(password)
    code = format_local_code(seal(payload.encode(), password=password))
    emit(args, {'code': code}, code)


RECOVERY_KIND = 'crypto-messenger-recovery'


def save_recovery(link: ShareLink, envelope: bytes) -> str:
    """Guarda el contenido cifrado de un mensaje ya destruido para reintentar la contraseña."""
    path = f'crypto-{link.id[:8]}.recovery'
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump({'kind': RECOVERY_KIND, 'link': str(link), 'envelope': base64.b64encode(envelope).decode()}, f)
    return path


def cmd_open(args):
    target = args.target
    if target.startswith(('http://', 'https://')):
        return open_share(args, ShareLink.parse(target))
    if target == '-':
        text = sys.stdin.read()
    elif os.path.isfile(target):
        with open(target, encoding='utf-8') as f:
            text = f.read()
    else:
        text = target
    if RECOVERY_KIND in text[:100]:
        data = json.loads(text)
        link = ShareLink.parse(data['link'])
        password = read_secret(args, 'password', required=True)
        payload = Payload.decode(open_envelope(base64.b64decode(data['envelope']), link_key=link.link_key, password=password))
        deliver(args, payload, {'destroyed': True})
        os.remove(target) if os.path.isfile(target) else None
        return
    envelope = parse_local_code(text)
    password = read_secret(args, 'password', required=True)
    deliver(args, Payload.decode(open_envelope(envelope, password=password)))


def open_share(args, link: ShareLink):
    api = client(args, link.origin)
    token = access_token(link.link_key)
    info = api.meta(link.id, token)
    password = read_secret(args, 'password', required=info['protected'])
    if info['destroy'] and not args.yes and sys.stdin.isatty():
        if input('Este mensaje se borrará del servidor al abrirlo. ¿Continuar? [s/N] ').strip().lower() not in ('s', 'si', 'sí', 'y', 'yes'):
            raise CliError('Cancelado', EXIT_USAGE)
    envelope, destroyed, expires_at = api.fetch_share(link.id, token)
    attempts = 0
    while True:
        try:
            payload = Payload.decode(open_envelope(envelope, link_key=link.link_key, password=password))
            break
        except DecryptError:
            if not destroyed:
                left = api.fail_attempt(link.id, token)
                if left == 0:
                    raise CliError('Demasiados intentos fallidos: el mensaje fue eliminado', EXIT_GONE)
                print(f'Contraseña incorrecta. Intentos restantes: {left}', file=sys.stderr)
            attempts += 1
            # Si ya se borró del servidor, se reintenta localmente con el contenido descargado
            if args.password_env or not sys.stdin.isatty() or attempts >= 3:
                if destroyed:
                    path = save_recovery(link, envelope)
                    raise CliError(
                        f'Contraseña incorrecta. El mensaje ya se borró del servidor, pero su contenido cifrado quedó en {path}.\n'
                        f'Reintenta con: crypto open {path} -p',
                        EXIT_WRONG_KEY,
                    )
                raise CliError('Contraseña incorrecta', EXIT_WRONG_KEY)
            password = getpass.getpass('Contraseña: ')
    deliver(args, payload, {'destroyed': destroyed, 'expires_at': expires_at})
    if destroyed and not args.json:
        print('[El mensaje ya se borró del servidor]', file=sys.stderr)


def cmd_delete(args):
    link = ShareLink.parse(args.link)
    client(args, link.origin).delete_share(link.id, access_token(link.link_key))
    emit(args, {'deleted': True}, 'Mensaje eliminado')


def cmd_request_create(args):
    passcode = read_secret(args, 'passcode', required=False, confirm=True)
    check_new_secret(passcode)
    origin = server_for(args)
    keys = RequestKeys.generate()
    res = client(args, origin).create_request(args.expire, keys.owner_token(), respond_token(keys.public_key))
    request_link = RequestLink(origin, res['id'], keys.public_key, args.label or '')
    if passcode:
        inbox = InboxLink(origin, res['id'], sealed=seal(keys.to_bytes(), password=passcode))
    else:
        inbox = InboxLink(origin, res['id'], keys=keys.to_bytes())
    emit(
        args,
        {'request_link': str(request_link), 'inbox_link': str(inbox), 'expires_at': res.get('expires_at'), 'locked': bool(passcode)},
        f'Enlace para quien responde:\n  {request_link}\n\nTu enlace de buzón (privado, guárdalo):\n  {inbox}',
    )


def cmd_request_respond(args):
    link = RequestLink.parse(args.link)
    api = client(args, link.origin)
    token = respond_token(link.public_key)
    if api.request_info(link.id, token)['status'] != 'pending':
        raise CliError('Esta solicitud ya fue respondida', EXIT_GONE)
    if link.label and not args.json:
        print(f'Solicitud: {link.label}', file=sys.stderr)
    api.respond(link.id, token, seal_to(link.public_key, read_payload(args).encode()))
    emit(args, {'sent': True}, 'Enviado de forma segura')


def inbox_keys(args) -> tuple[InboxLink, RequestKeys]:
    inbox = InboxLink.parse(args.link)
    if inbox.keys:
        return inbox, RequestKeys.from_bytes(inbox.keys)
    passcode = read_secret(args, 'passcode', required=True)
    try:
        return inbox, RequestKeys.from_bytes(open_envelope(inbox.sealed, password=passcode))
    except DecryptError:
        raise CliError('Código del buzón incorrecto', EXIT_WRONG_KEY) from None


def cmd_request_status(args):
    inbox, keys = inbox_keys(args)
    res = client(args, inbox.origin).request_status(inbox.id, keys.owner_token())
    status = {'pending': 'Pendiente', 'answered': 'Respondida'}[res['status']]
    emit(args, res, f'{status} · expira en {remaining(res.get("expires_at"))}')


def cmd_request_open(args):
    inbox, keys = inbox_keys(args)
    box = client(args, inbox.origin).open_request(inbox.id, keys.owner_token())
    deliver(args, Payload.decode(open_sealed(keys, box)), {'destroyed': True})
    if not args.json:
        print('[La respuesta ya se borró del servidor]', file=sys.stderr)


def cmd_request_delete(args):
    inbox, keys = inbox_keys(args)
    client(args, inbox.origin).delete_request(inbox.id, keys.owner_token())
    emit(args, {'deleted': True}, 'Solicitud eliminada')


#
# Argumentos
#
def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument('--server', metavar='URL', help='servidor (o variable CRYPTO_URL)')
    common.add_argument('--json', action='store_true', help='salida en JSON')
    common.add_argument('-k', '--insecure', action='store_true', help='aceptar certificados autofirmados (desarrollo)')

    content = argparse.ArgumentParser(add_help=False)
    content.add_argument('text', nargs='?', help='mensaje; "-" o sin argumento para leer de stdin')
    content.add_argument('-f', '--file', action='append', metavar='ARCHIVO', help='adjuntar archivo (repetible)')

    password = argparse.ArgumentParser(add_help=False)
    password.add_argument('-p', '--password', action='store_true', help='pedir contraseña por teclado')
    password.add_argument('--password-env', metavar='VAR', help='leer la contraseña de una variable de entorno')

    passcode = argparse.ArgumentParser(add_help=False)
    passcode.add_argument('--passcode', action='store_true', help='pedir el código del buzón por teclado')
    passcode.add_argument('--passcode-env', metavar='VAR', help='leer el código del buzón de una variable de entorno')

    output = argparse.ArgumentParser(add_help=False)
    output.add_argument('-o', '--output', metavar='DIR', help='guardar mensaje y archivos en DIR sin mostrarlos')

    expire = argparse.ArgumentParser(add_help=False)
    expire.add_argument('-e', '--expire', type=parse_expire, default=EXPIRATIONS['1w'], help='30s, 1d, 1w (defecto) o 1m')

    parser = argparse.ArgumentParser(prog='crypto', description='Mensajes y archivos cifrados de extremo a extremo.')
    parser.add_argument('--version', action='version', version=f'%(prog)s {__version__}')
    sub = parser.add_subparsers(dest='command', required=True, metavar='COMANDO')

    p = sub.add_parser('share', parents=[common, content, password, expire], help='crear un enlace seguro')
    p.add_argument('--keep', action='store_true', help='no destruir al leer (por defecto se destruye)')
    p.set_defaults(func=cmd_share)

    p = sub.add_parser('encrypt', parents=[common, content, password], help='cifrar localmente con contraseña (sin servidor)')
    p.set_defaults(func=cmd_encrypt)

    p = sub.add_parser('open', parents=[common, password, output], help='abrir un enlace o un código cifrado')
    p.add_argument('target', help='enlace, código cifrado, archivo con el código o "-" (stdin)')
    p.add_argument('-y', '--yes', action='store_true', help='no pedir confirmación si se destruye al leer')
    p.set_defaults(func=cmd_open)

    p = sub.add_parser('delete', parents=[common], help='borrar un mensaje compartido')
    p.add_argument('link')
    p.set_defaults(func=cmd_delete)

    req = sub.add_parser('request', help='solicitudes: pedir un secreto a otra persona')
    rsub = req.add_subparsers(dest='action', required=True, metavar='ACCIÓN')

    p = rsub.add_parser('create', parents=[common, passcode, expire], help='crear una solicitud')
    p.add_argument('-l', '--label', help='qué pedís (lo ve quien responde; viaja en el enlace)')
    p.set_defaults(func=cmd_request_create)

    p = rsub.add_parser('respond', parents=[common], help='responder una solicitud')
    p.add_argument('link', help='enlace de solicitud')
    p.add_argument('text', nargs='?', help='respuesta; "-" o sin argumento para leer de stdin')
    p.add_argument('-f', '--file', action='append', metavar='ARCHIVO', help='adjuntar archivo (repetible)')
    p.set_defaults(func=cmd_request_respond)

    for name, func, helptext, extra in (
        ('status', cmd_request_status, 'ver si ya respondieron', []),
        ('open', cmd_request_open, 'retirar la respuesta (se borra del servidor)', [output]),
        ('delete', cmd_request_delete, 'eliminar la solicitud', []),
    ):
        p = rsub.add_parser(name, parents=[common, passcode, *extra], help=helptext)
        p.add_argument('link', help='enlace de buzón')
        p.set_defaults(func=func)
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        args.func(args)
        return 0
    except CliError as e:
        print(f'crypto: {e}', file=sys.stderr)
        return e.code
    except ApiError as e:
        print(f'crypto: {e}', file=sys.stderr)
        return EXIT_GONE if e.status == 404 else EXIT_ERROR
    except DecryptError as e:
        print(f'crypto: {e}', file=sys.stderr)
        return EXIT_WRONG_KEY
    except OSError as e:
        print(f'crypto: {e}', file=sys.stderr)
        return EXIT_ERROR
    except KeyboardInterrupt:
        return 130


if __name__ == '__main__':
    sys.exit(main())
