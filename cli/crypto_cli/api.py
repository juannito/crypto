"""Cliente HTTP de la API (solo biblioteca estándar)."""
import json
import os
import ssl
import time
import urllib.error
import urllib.request
import uuid

USER_AGENT = 'crypto-messenger-cli/1.0'

ERRORS = {
    -1: 'Certificado no válido. Si es un servidor de desarrollo con certificado autofirmado, usa -k',
    0: 'No se pudo conectar con el servidor',
    404: 'No existe, expiró o el enlace está incompleto',
    409: 'Ya fue respondida o todavía no hay respuesta',
    413: 'El contenido supera el tamaño máximo permitido',
    429: 'Demasiadas peticiones: espera un momento',
    503: 'El servidor no tiene espacio disponible',
}


class ApiError(Exception):
    def __init__(self, status: int, code: str):
        self.status, self.code = status, code
        super().__init__(ERRORS.get(status, f'Error del servidor ({status}: {code})'))


class Client:
    def __init__(self, origin: str, insecure: bool = False, timeout: int = 60):
        self.origin = origin.rstrip('/')
        self.timeout = timeout
        self.context = ssl._create_unverified_context() if insecure else None

    def _post(self, path: str, fields: dict, files: dict | None = None) -> tuple[bytes, dict]:
        boundary = uuid.uuid4().hex
        body = bytearray()
        for name, value in fields.items():
            if value is None:
                continue
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        for name, data in (files or {}).items():
            body += (
                f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="blob"\r\n'
                'Content-Type: application/octet-stream\r\n\r\n'
            ).encode() + data + b'\r\n'
        body += f'--{boundary}--\r\n'.encode()
        req = urllib.request.Request(
            self.origin + path,
            data=bytes(body),
            method='POST',
            headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'User-Agent': USER_AGENT},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self.context) as res:
                return res.read(), dict(res.headers)
        except urllib.error.HTTPError as e:
            try:
                code = json.loads(e.read()).get('error', 'server_error')
            except ValueError:
                code = 'server_error'
            raise ApiError(e.code, code) from None
        except (urllib.error.URLError, OSError) as e:
            reason = getattr(e, 'reason', e)
            if isinstance(reason, ssl.SSLCertVerificationError):
                raise ApiError(-1, 'certificate') from None
            raise ApiError(0, str(reason)) from None

    def _json(self, path, fields, files=None):
        return json.loads(self._post(path, fields, files)[0])

    # Compartir
    def create_share(self, envelope: bytes, expire: int, destroy: bool, token: str) -> dict:
        return self._json('/post', {'expire': expire, 'destroy': '1' if destroy else '0', 'token': token}, {'payload': envelope})

    def meta(self, msg_id: str, token: str) -> dict:
        return self._json('/meta', {'id': msg_id, 'token': token})

    def fetch_share(self, msg_id: str, token: str) -> tuple[bytes, bool, int | None]:
        data, headers = self._post('/get', {'id': msg_id, 'token': token})
        headers = {k.lower(): v for k, v in headers.items()}
        expires = headers.get('x-expires-at')
        return data, headers.get('x-destroyed') == '1', int(expires) if expires else None

    def fail_attempt(self, msg_id: str, token: str) -> int:
        try:
            return self._json('/fail_attempt', {'id': msg_id, 'token': token})['attempts_left']
        except ApiError as e:
            if e.status in (403, 404):
                return 0
            raise

    def delete_share(self, msg_id: str, token: str) -> None:
        self._json('/delete', {'id': msg_id, 'token': token})

    # Solicitudes
    def create_request(self, expire: int, owner_token: str, respond_token: str) -> dict:
        return self._json('/request/create', {'expire': expire, 'owner_token': owner_token, 'respond_token': respond_token})

    def request_info(self, req_id: str, token: str) -> dict:
        return self._json('/request/info', {'id': req_id, 'token': token})

    def respond(self, req_id: str, token: str, box: bytes) -> None:
        self._json('/request/respond', {'id': req_id, 'token': token}, {'payload': box})

    def request_status(self, req_id: str, token: str) -> dict:
        return self._json('/request/status', {'id': req_id, 'token': token})

    def open_request(self, req_id: str, token: str) -> bytes:
        return self._post('/request/open', {'id': req_id, 'token': token})[0]

    def delete_request(self, req_id: str, token: str) -> None:
        self._json('/request/delete', {'id': req_id, 'token': token})


def default_server() -> str | None:
    return os.environ.get('CRYPTO_URL')


def remaining(expires_at: int | None) -> str:
    if not expires_at:
        return 'sin expiración'
    secs = max(0, expires_at - int(time.time()))
    for unit, size in (('d', 86400), ('h', 3600), ('min', 60)):
        if secs >= size:
            return f'{secs // size} {unit}'
    return f'{secs} s'
