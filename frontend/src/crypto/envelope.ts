/*
 * Sobre cifrado v2 (WebCrypto, AES-256-GCM autenticado).
 *
 *   'C' 'M' 0x02 | flags (1) | salt (16) | iv (12) | ciphertext + tag (16)
 *
 * La cabecera completa se autentica como AAD: cualquier byte alterado hace
 * fallar el descifrado.
 *
 * Derivación de la clave AES:
 *   - Solo contraseña (modo Encriptar): PBKDF2-SHA256, 600.000 iteraciones.
 *   - Clave de enlace (modo Compartir): HKDF-SHA256 sobre 32 bytes aleatorios
 *     que viajan en el fragmento (#) del enlace; si además hay contraseña, su
 *     PBKDF2 se mezcla en el HKDF como segundo factor.
 */
import { concatBytes, bytesToBase64Url } from './encoding';

const MAGIC = [0x43, 0x4d, 0x02];
export const FLAG_LINK_KEY = 0x01;
export const FLAG_PASSWORD = 0x02;
const SALT_LEN = 16;
const IV_LEN = 12;
export const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN;
export const PBKDF2_ITERATIONS = 600_000;
export const LINK_KEY_LEN = 32;

const ENC_INFO = new TextEncoder().encode('crypto-messenger/v2/encryption');
const AUTH_INFO = new TextEncoder().encode('crypto-messenger/v2/access-token');

export class DecryptError extends Error {
  constructor(public reason: 'wrong_key' | 'malformed' | 'needs_link_key' | 'needs_password') {
    super(reason);
  }
}

export interface KeyMaterial {
  linkKey?: Uint8Array;
  password?: string;
}

const subtle = () => {
  if (!window.crypto?.subtle) {
    // WebCrypto solo existe en contextos seguros (https o localhost)
    throw new Error('insecure_context');
  }
  return window.crypto.subtle;
};

export function randomBytes(n: number): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(n));
}

async function passwordBits(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    base,
    256
  );
  return new Uint8Array(bits);
}

async function deriveAesKey(flags: number, salt: Uint8Array, keys: KeyMaterial): Promise<CryptoKey> {
  const pw = flags & FLAG_PASSWORD ? await passwordBits(keys.password || '', salt) : new Uint8Array(0);
  if (!(flags & FLAG_LINK_KEY)) {
    return subtle().importKey('raw', pw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const ikm = await subtle().importKey('raw', concatBytes(keys.linkKey!, pw), 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: ENC_INFO },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function seal(plaintext: Uint8Array, keys: KeyMaterial): Promise<Uint8Array> {
  let flags = 0;
  if (keys.linkKey) flags |= FLAG_LINK_KEY;
  if (keys.password) flags |= FLAG_PASSWORD;
  if (!flags) throw new Error('no_key');

  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const header = concatBytes(new Uint8Array(MAGIC), new Uint8Array([flags]), salt, iv);
  const key = await deriveAesKey(flags, salt, keys);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: header }, key, plaintext);
  return concatBytes(header, new Uint8Array(ct));
}

export function isEnvelope(data: Uint8Array): boolean {
  return data.length >= HEADER_LEN + 16 && MAGIC.every((b, i) => data[i] === b);
}

export function envelopeFlags(data: Uint8Array): number {
  if (!isEnvelope(data)) throw new DecryptError('malformed');
  return data[MAGIC.length];
}

export async function open(envelope: Uint8Array, keys: KeyMaterial): Promise<Uint8Array> {
  const flags = envelopeFlags(envelope);
  if (flags & FLAG_LINK_KEY && !keys.linkKey) throw new DecryptError('needs_link_key');
  if (flags & FLAG_PASSWORD && !keys.password) throw new DecryptError('needs_password');

  const header = envelope.subarray(0, HEADER_LEN);
  const salt = header.subarray(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN);
  const iv = header.subarray(HEADER_LEN - IV_LEN);
  const key = await deriveAesKey(flags, salt, keys);
  try {
    const pt = await subtle().decrypt(
      { name: 'AES-GCM', iv, additionalData: header },
      key,
      envelope.subarray(HEADER_LEN)
    );
    return new Uint8Array(pt);
  } catch {
    throw new DecryptError('wrong_key');
  }
}

// Token que prueba ante el servidor que se posee la clave del enlace, sin revelarla
export async function accessToken(linkKey: Uint8Array): Promise<string> {
  const ikm = await subtle().importKey('raw', linkKey, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: AUTH_INFO },
    ikm,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
}
