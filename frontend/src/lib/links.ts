import { base64ToBytes, base64UrlToBytes, bytesToBase64, bytesToBase64Url } from '../crypto/encoding';
import { isEnvelope, LINK_KEY_LEN } from '../crypto/envelope';
import { isLegacyCiphertext } from '../crypto/legacy';

export type ParsedInput =
  | { kind: 'share'; id: string; linkKey: Uint8Array }
  | { kind: 'legacyShare'; id: string }
  | { kind: 'local'; envelope: Uint8Array }
  | { kind: 'legacyLocal'; ciphertext: string };

const SHARE_ID = /^[A-Za-z0-9]{22}$/;
const LEGACY_ID = /^[A-Za-z0-9]{10}$/;

// La clave va en el fragmento (#): el navegador nunca lo envía al servidor
export function buildShareLink(id: string, linkKey: Uint8Array): string {
  return `${window.location.origin}/message#c=${id}&k=${bytesToBase64Url(linkKey)}`;
}

function parseFragment(hash: string): ParsedInput | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const id = params.get('c') || '';
  const key = params.get('k') || '';
  if (!SHARE_ID.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(key)) return null;
  const linkKey = base64UrlToBytes(key);
  return linkKey.length === LINK_KEY_LEN ? { kind: 'share', id, linkKey } : null;
}

export function parseLocation(loc: Location = window.location): ParsedInput | null {
  const share = parseFragment(loc.hash);
  if (share) return share;
  const code = new URLSearchParams(loc.search).get('code') || '';
  if (LEGACY_ID.test(code)) return { kind: 'legacyShare', id: code };
  return null;
}

export function parseInput(raw: string): ParsedInput | null {
  const input = raw.trim();
  if (!input) return null;

  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      const fromUrl = parseLocation(url as unknown as Location);
      if (fromUrl) return fromUrl;
      const path = url.pathname.replace(/^\//, '');
      if (LEGACY_ID.test(path)) return { kind: 'legacyShare', id: path };
    } catch {
      // no es una URL válida: se trata como código cifrado
    }
    return null;
  }

  if (LEGACY_ID.test(input)) return { kind: 'legacyShare', id: input };

  const compact = input.replace(/\s+/g, '');
  if (isLegacyCiphertext(compact)) return { kind: 'legacyLocal', ciphertext: compact };
  try {
    const envelope = base64ToBytes(compact);
    if (isEnvelope(envelope)) return { kind: 'local', envelope };
  } catch {
    // base64 inválido
  }
  return null;
}

// Código de la pestaña Encriptar: base64 en líneas de 64 caracteres
export function formatLocalCiphertext(envelope: Uint8Array): string {
  return bytesToBase64(envelope).replace(/(.{64})/g, '$1\n').replace(/\n$/, '');
}

//
// Solicitudes: enlace para responder y enlace privado de buzón
//
export interface RequestLink {
  id: string;
  publicKey: Uint8Array;
  label: string;
}

export type InboxLink =
  | { id: string; kind: 'plain'; keys: Uint8Array } // clave pública (65) + privada (32)
  | { id: string; kind: 'locked'; sealed: Uint8Array }; // mismas claves cifradas con un código

const REQUEST_ID = /^[A-Za-z0-9]{22}$/;

const encodeLabel = (label: string) => bytesToBase64Url(new TextEncoder().encode(label));
const decodeLabel = (value: string) => {
  try {
    return new TextDecoder().decode(base64UrlToBytes(value));
  } catch {
    return '';
  }
};

export function buildRequestLink(id: string, publicKey: Uint8Array, label: string): string {
  const l = label ? `&l=${encodeLabel(label)}` : '';
  return `${window.location.origin}/request#r=${id}&p=${bytesToBase64Url(publicKey)}${l}`;
}

export function buildInboxLink(inbox: InboxLink): string {
  const secret = inbox.kind === 'plain' ? `s=${bytesToBase64Url(inbox.keys)}` : `e=${bytesToBase64Url(inbox.sealed)}`;
  return `${window.location.origin}/inbox#r=${inbox.id}&${secret}`;
}

function hashParams(loc: { hash: string }) {
  return new URLSearchParams(loc.hash.replace(/^#/, ''));
}

export function parseRequestLink(loc: { pathname: string; hash: string }): RequestLink | null {
  if (!loc.pathname.startsWith('/request')) return null;
  const params = hashParams(loc);
  const id = params.get('r') || '';
  const p = params.get('p') || '';
  if (!REQUEST_ID.test(id) || !/^[A-Za-z0-9_-]{87}$/.test(p)) return null;
  const publicKey = base64UrlToBytes(p);
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) return null;
  return { id, publicKey, label: decodeLabel(params.get('l') || '').slice(0, 120) };
}

export function parseInboxLink(loc: { pathname: string; hash: string }): InboxLink | null {
  if (!loc.pathname.startsWith('/inbox')) return null;
  const params = hashParams(loc);
  const id = params.get('r') || '';
  if (!REQUEST_ID.test(id)) return null;
  const s = params.get('s');
  const e = params.get('e');
  try {
    if (s) {
      const keys = base64UrlToBytes(s);
      return keys.length === 97 ? { id, kind: 'plain', keys } : null;
    }
    if (e) return { id, kind: 'locked', sealed: base64UrlToBytes(e) };
  } catch {
    // base64 inválido
  }
  return null;
}

export function parseInboxInput(raw: string): InboxLink | null {
  try {
    return parseInboxLink(new URL(raw.trim()));
  } catch {
    return null;
  }
}
