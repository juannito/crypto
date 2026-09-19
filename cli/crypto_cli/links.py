"""Enlaces: la clave va siempre en el fragmento (#), que no se envía al servidor."""
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

from .formats import LINK_KEY_LEN, PUB_LEN, DecryptError, b64url, b64url_decode

ID_RE = re.compile(r'^[A-Za-z0-9]{22}$')


def origin_of(url: str) -> str:
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.netloc:
        raise DecryptError(f'URL inválida: {url}')
    return f'{parts.scheme}://{parts.netloc}'


def _fragment(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlsplit(url).fragment).items()}


@dataclass
class ShareLink:
    origin: str
    id: str
    link_key: bytes

    def __str__(self) -> str:
        return f'{self.origin}/message#c={self.id}&k={b64url(self.link_key)}'

    @classmethod
    def parse(cls, url: str) -> 'ShareLink':
        frag = _fragment(url)
        try:
            key = b64url_decode(frag.get('k', ''))
        except ValueError:
            key = b''
        if not ID_RE.match(frag.get('c', '')) or len(key) != LINK_KEY_LEN:
            raise DecryptError('No es un enlace de Compartir válido (¿está completo, con la parte después de #?)')
        return cls(origin_of(url), frag['c'], key)


@dataclass
class RequestLink:
    origin: str
    id: str
    public_key: bytes
    label: str = ''

    def __str__(self) -> str:
        label = f'&l={b64url(self.label.encode())}' if self.label else ''
        return f'{self.origin}/request#r={self.id}&p={b64url(self.public_key)}{label}'

    @classmethod
    def parse(cls, url: str) -> 'RequestLink':
        frag = _fragment(url)
        try:
            pub = b64url_decode(frag.get('p', ''))
            label = b64url_decode(frag['l']).decode('utf-8') if frag.get('l') else ''
        except ValueError:
            pub, label = b'', ''
        if not ID_RE.match(frag.get('r', '')) or len(pub) != PUB_LEN or pub[0] != 0x04:
            raise DecryptError('No es un enlace de solicitud válido')
        return cls(origin_of(url), frag['r'], pub, label[:120])


@dataclass
class InboxLink:
    origin: str
    id: str
    keys: bytes | None = None  # clave pública + privada (97 bytes)
    sealed: bytes | None = None  # las mismas claves, cifradas con un código

    def __str__(self) -> str:
        secret = f's={b64url(self.keys)}' if self.keys else f'e={b64url(self.sealed)}'
        return f'{self.origin}/inbox#r={self.id}&{secret}'

    @classmethod
    def parse(cls, url: str) -> 'InboxLink':
        frag = _fragment(url)
        if not ID_RE.match(frag.get('r', '')):
            raise DecryptError('No es un enlace de buzón válido')
        try:
            if frag.get('s'):
                return cls(origin_of(url), frag['r'], keys=b64url_decode(frag['s']))
            if frag.get('e'):
                return cls(origin_of(url), frag['r'], sealed=b64url_decode(frag['e']))
        except ValueError:
            pass
        raise DecryptError('No es un enlace de buzón válido')
