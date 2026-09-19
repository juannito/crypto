"""
Formatos criptográficos, idénticos a los del navegador (frontend/src/crypto).

Sobre v2 (Compartir / Encriptar):
    'C' 'M' 0x02 | flags (1) | salt (16) | iv (12) | ciphertext + tag GCM (16)
    flags: 0x01 = clave de enlace, 0x02 = contraseña. La cabecera es AAD.

Caja sellada v3 (Solicitudes, ECIES):
    'C' 'M' 0x03 0x00 | salt (16) | iv (12) | clave pública efímera P-256 (65) | ciphertext + tag

Contenido cifrado (payload):
    longitud del manifiesto (uint32 BE) | manifiesto JSON {v, m, f:[{n, t, s}]} | bytes de archivos
"""
import base64
import json
import os
import struct
from dataclasses import dataclass, field

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

MAGIC_V2 = b'CM\x02'
MAGIC_V3 = b'CM\x03\x00'
FLAG_LINK_KEY = 0x01
FLAG_PASSWORD = 0x02
SALT_LEN = 16
IV_LEN = 12
TAG_LEN = 16
PUB_LEN = 65
HEADER_V2 = len(MAGIC_V2) + 1 + SALT_LEN + IV_LEN
HEADER_V3 = len(MAGIC_V3) + SALT_LEN + IV_LEN + PUB_LEN
PBKDF2_ITERATIONS = 600_000
LINK_KEY_LEN = 32

ENC_INFO = b'crypto-messenger/v2/encryption'
ACCESS_INFO = b'crypto-messenger/v2/access-token'
SEALED_INFO = b'crypto-messenger/v3/sealed-box'
OWNER_INFO = b'crypto-messenger/v3/owner-token'
RESPOND_INFO = b'crypto-messenger/v3/respond-token'


class DecryptError(Exception):
    """Clave o contraseña incorrecta, o contenido alterado."""


#
# Codificación
#
def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def b64url_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def _hkdf(ikm: bytes, salt: bytes, info: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info).derive(ikm)


def _password_bits(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=PBKDF2_ITERATIONS)
    return kdf.derive(password.encode('utf-8'))


#
# Sobre v2
#
def _aes_key(flags: int, salt: bytes, link_key: bytes | None, password: str | None) -> bytes:
    pw = _password_bits(password or '', salt) if flags & FLAG_PASSWORD else b''
    if not flags & FLAG_LINK_KEY:
        return pw
    return _hkdf(link_key + pw, salt, ENC_INFO)


def seal(plaintext: bytes, link_key: bytes | None = None, password: str | None = None) -> bytes:
    flags = (FLAG_LINK_KEY if link_key else 0) | (FLAG_PASSWORD if password else 0)
    if not flags:
        raise ValueError('Hace falta una clave de enlace o una contraseña')
    salt, iv = os.urandom(SALT_LEN), os.urandom(IV_LEN)
    header = MAGIC_V2 + bytes([flags]) + salt + iv
    return header + AESGCM(_aes_key(flags, salt, link_key, password)).encrypt(iv, plaintext, header)


def envelope_flags(envelope: bytes) -> int:
    if len(envelope) < HEADER_V2 + TAG_LEN or envelope[:3] != MAGIC_V2:
        raise DecryptError('No es un sobre cifrado válido')
    return envelope[3]


def open_envelope(envelope: bytes, link_key: bytes | None = None, password: str | None = None) -> bytes:
    flags = envelope_flags(envelope)
    if flags & FLAG_LINK_KEY and not link_key:
        raise DecryptError('Falta la clave del enlace')
    if flags & FLAG_PASSWORD and not password:
        raise DecryptError('Este contenido pide una contraseña')
    header = envelope[:HEADER_V2]
    salt, iv = header[4:4 + SALT_LEN], header[4 + SALT_LEN:]
    try:
        return AESGCM(_aes_key(flags, salt, link_key, password)).decrypt(iv, envelope[HEADER_V2:], header)
    except InvalidTag:
        raise DecryptError('Contraseña incorrecta o contenido alterado') from None


def access_token(link_key: bytes) -> str:
    return b64url(_hkdf(link_key, b'', ACCESS_INFO))


#
# Caja sellada v3 (Solicitudes)
#
@dataclass
class RequestKeys:
    public_key: bytes  # 65 bytes, sin comprimir
    private_key: bytes  # 32 bytes (d)

    @classmethod
    def generate(cls) -> 'RequestKeys':
        priv = ec.generate_private_key(ec.SECP256R1())
        return cls(_raw_public(priv.public_key()), priv.private_numbers().private_value.to_bytes(32, 'big'))

    @classmethod
    def from_bytes(cls, data: bytes) -> 'RequestKeys':
        if len(data) != PUB_LEN + 32:
            raise DecryptError('Claves de buzón inválidas')
        return cls(data[:PUB_LEN], data[PUB_LEN:])

    def to_bytes(self) -> bytes:
        return self.public_key + self.private_key

    def owner_token(self) -> str:
        return b64url(_hkdf(self.private_key, b'', OWNER_INFO))


def respond_token(public_key: bytes) -> str:
    return b64url(_hkdf(public_key, b'', RESPOND_INFO))


def _raw_public(key: ec.EllipticCurvePublicKey) -> bytes:
    return key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def _sealed_key(shared: bytes, salt: bytes, ephemeral: bytes, recipient: bytes) -> bytes:
    return _hkdf(shared, salt, SEALED_INFO + ephemeral + recipient)


def seal_to(recipient_public: bytes, plaintext: bytes) -> bytes:
    recipient = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), recipient_public)
    eph = ec.generate_private_key(ec.SECP256R1())
    eph_public = _raw_public(eph.public_key())
    shared = eph.exchange(ec.ECDH(), recipient)
    salt, iv = os.urandom(SALT_LEN), os.urandom(IV_LEN)
    header = MAGIC_V3 + salt + iv + eph_public
    key = _sealed_key(shared, salt, eph_public, recipient_public)
    return header + AESGCM(key).encrypt(iv, plaintext, header)


def open_sealed(keys: RequestKeys, box: bytes) -> bytes:
    if len(box) < HEADER_V3 + TAG_LEN or box[:4] != MAGIC_V3:
        raise DecryptError('No es una respuesta cifrada válida')
    header = box[:HEADER_V3]
    salt = header[4:4 + SALT_LEN]
    iv = header[4 + SALT_LEN:4 + SALT_LEN + IV_LEN]
    eph_public = header[-PUB_LEN:]
    priv = ec.derive_private_key(int.from_bytes(keys.private_key, 'big'), ec.SECP256R1())
    shared = priv.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), eph_public))
    try:
        return AESGCM(_sealed_key(shared, salt, eph_public, keys.public_key)).decrypt(iv, box[HEADER_V3:], header)
    except InvalidTag:
        raise DecryptError('La respuesta no se pudo descifrar') from None


#
# Contenido: mensaje + archivos
#
@dataclass
class Attachment:
    name: str
    data: bytes
    type: str = ''


@dataclass
class Payload:
    message: str = ''
    files: list[Attachment] = field(default_factory=list)

    def encode(self) -> bytes:
        manifest = {'v': 1, 'm': self.message, 'f': [{'n': f.name, 't': f.type, 's': len(f.data)} for f in self.files]}
        head = json.dumps(manifest, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        return struct.pack('>I', len(head)) + head + b''.join(f.data for f in self.files)

    @classmethod
    def decode(cls, data: bytes) -> 'Payload':
        if len(data) < 4:
            raise DecryptError('Contenido mal formado')
        (head_len,) = struct.unpack('>I', data[:4])
        try:
            manifest = json.loads(data[4:4 + head_len].decode('utf-8'))
        except ValueError:
            raise DecryptError('Contenido mal formado') from None
        if manifest.get('v') != 1 or not isinstance(manifest.get('m'), str) or not isinstance(manifest.get('f'), list):
            raise DecryptError('Contenido mal formado')
        offset, files = 4 + head_len, []
        for f in manifest['f']:
            size = f.get('s')
            if not isinstance(size, int) or size < 0 or offset + size > len(data):
                raise DecryptError('Contenido mal formado')
            files.append(Attachment(str(f.get('n', 'archivo')), data[offset:offset + size], str(f.get('t') or '')))
            offset += size
        return cls(manifest['m'], files)


#
# Código de la pestaña Encriptar
#
def format_local_code(envelope: bytes) -> str:
    text = base64.b64encode(envelope).decode()
    return '\n'.join(text[i:i + 64] for i in range(0, len(text), 64))


def parse_local_code(text: str) -> bytes:
    compact = ''.join(text.split())
    if compact.startswith('U2FsdGVkX1'):
        raise DecryptError('Código del formato anterior (CryptoJS): ábrelo en la pestaña Descifrar de la web')
    try:
        envelope = base64.b64decode(compact, validate=True)
    except ValueError:
        raise DecryptError('No es un código cifrado válido') from None
    envelope_flags(envelope)
    return envelope
