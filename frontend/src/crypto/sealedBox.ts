/*
 * Caja sellada v3 para Solicitudes (cifrado de clave pública, ECIES con WebCrypto).
 *
 *   'C' 'M' 0x03 | 0x00 | salt (16) | iv (12) | clave pública efímera P-256 (65) | ciphertext + tag
 *
 * Quien responde genera un par efímero, hace ECDH con la clave pública del
 * solicitante (que viaja en el fragmento del enlace, no la entrega el
 * servidor) y cifra con AES-256-GCM. Solo la clave privada del buzón descifra.
 */
import { base64UrlToBytes, bytesToBase64Url, concatBytes } from './encoding';
import { randomBytes } from './envelope';

const MAGIC = [0x43, 0x4d, 0x03];
const SALT_LEN = 16;
const IV_LEN = 12;
const PUB_LEN = 65;
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN + PUB_LEN;
const CURVE = { name: 'ECDH', namedCurve: 'P-256' } as const;
const INFO = new TextEncoder().encode('crypto-messenger/v3/sealed-box');
const OWNER_INFO = new TextEncoder().encode('crypto-messenger/v3/owner-token');
const RESPOND_INFO = new TextEncoder().encode('crypto-messenger/v3/respond-token');

export interface RequestKeys {
  publicKey: Uint8Array; // 65 bytes, formato raw sin comprimir
  privateKey: Uint8Array; // 32 bytes (d)
}

export async function generateRequestKeys(): Promise<RequestKeys> {
  const pair = await crypto.subtle.generateKey(CURVE, true, ['deriveBits']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { publicKey, privateKey: base64UrlToBytes(jwk.d!) };
}

function importPrivate(keys: RequestKeys): Promise<CryptoKey> {
  const x = keys.publicKey.subarray(1, 33);
  const y = keys.publicKey.subarray(33, 65);
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: bytesToBase64Url(x), y: bytesToBase64Url(y), d: bytesToBase64Url(keys.privateKey), ext: true },
    CURVE,
    false,
    ['deriveBits']
  );
}

function importPublic(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, CURVE, false, []);
}

async function aesKey(shared: ArrayBuffer, salt: Uint8Array, ephemeral: Uint8Array, recipient: Uint8Array) {
  const ikm = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    // Las claves públicas entran en el info: la clave queda atada a ambos extremos
    { name: 'HKDF', hash: 'SHA-256', salt, info: concatBytes(INFO, ephemeral, recipient) },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function sealTo(recipientPublic: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const recipient = await importPublic(recipientPublic);
  const eph = await crypto.subtle.generateKey(CURVE, true, ['deriveBits']);
  const ephPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipient }, eph.privateKey, 256);
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const header = concatBytes(new Uint8Array([...MAGIC, 0]), salt, iv, ephPublic);
  const key = await aesKey(shared, salt, ephPublic, recipientPublic);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header }, key, plaintext);
  return concatBytes(header, new Uint8Array(ct));
}

export async function openSealed(keys: RequestKeys, box: Uint8Array): Promise<Uint8Array> {
  if (box.length < HEADER_LEN + 16 || !MAGIC.every((b, i) => box[i] === b)) throw new Error('malformed');
  const header = box.subarray(0, HEADER_LEN);
  const salt = header.subarray(4, 4 + SALT_LEN);
  const iv = header.subarray(4 + SALT_LEN, 4 + SALT_LEN + IV_LEN);
  const ephPublic = header.subarray(HEADER_LEN - PUB_LEN);
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: await importPublic(ephPublic) },
    await importPrivate(keys),
    256
  );
  const key = await aesKey(shared, salt, ephPublic, keys.publicKey);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: header }, key, box.subarray(HEADER_LEN));
  return new Uint8Array(pt);
}

async function hkdfToken(secret: Uint8Array, info: Uint8Array): Promise<string> {
  const ikm = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info }, ikm, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}

// Token del dueño (sale de la clave privada): consultar, retirar y borrar la solicitud
export const ownerToken = (keys: RequestKeys) => hkdfToken(keys.privateKey, OWNER_INFO);
// Token de respuesta (sale de la clave pública del enlace): responder una sola vez
export const respondToken = (publicKey: Uint8Array) => hkdfToken(publicKey, RESPOND_INFO);
