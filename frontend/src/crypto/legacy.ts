/*
 * Descifrado de mensajes del formato anterior (CryptoJS: AES-CBC + EVP_BytesToKey/MD5).
 * Solo lectura, para no dejar inaccesibles códigos y enlaces ya emitidos.
 * La librería se carga bajo demanda: nunca se usa para cifrar.
 */
import { base64ToBytes } from './encoding';
import type { DecryptedPayload, DecryptedFile } from './payload';

export const isLegacyCiphertext = (text: string) => text.startsWith('U2FsdGVkX1');

interface LegacyFile {
  name: string;
  size: number;
  content: string;
}

async function decryptText(ciphertext: string, password: string): Promise<string | null> {
  const CryptoJS = (await import('crypto-js')).default;
  try {
    const result = CryptoJS.AES.decrypt(ciphertext, password).toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch {
    return null;
  }
}

async function decryptFiles(files: LegacyFile[], password: string): Promise<DecryptedFile[]> {
  const out: DecryptedFile[] = [];
  for (const file of files) {
    const b64 = await decryptText(file.content, password);
    if (b64 === null) continue;
    const data = base64ToBytes(b64);
    out.push({ name: file.name, type: '', size: data.length, data });
  }
  return out;
}

// Código generado por la pestaña Encriptar anterior: JSON {message, files} o texto plano
export async function decryptLegacyText(ciphertext: string, password: string): Promise<DecryptedPayload | null> {
  const text = await decryptText(ciphertext, password);
  if (text === null) return null;
  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object' && 'message' in data) {
      return { message: data.message || '', files: await decryptFiles(data.files || [], password) };
    }
  } catch {
    // texto plano
  }
  return { message: text, files: [] };
}

// Mensaje compartido anterior: mensaje y archivos cifrados por separado
export async function decryptLegacyShare(
  msg: string,
  files: LegacyFile[],
  password: string
): Promise<DecryptedPayload | null> {
  const message = msg ? await decryptText(msg, password) : '';
  const decryptedFiles = await decryptFiles(files, password);
  // Un mensaje vacío cifrado también descifra a '': en ese caso deciden los archivos
  if (message === null && decryptedFiles.length === 0) return null;
  return { message: message || '', files: decryptedFiles };
}
