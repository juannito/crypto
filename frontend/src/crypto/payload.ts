/*
 * Contenido que se cifra: mensaje + archivos con sus nombres, tipos y tamaños.
 * Todo va dentro del sobre, así que el servidor no ve ningún metadato.
 *
 *   longitud del manifiesto (uint32 BE) | manifiesto JSON | bytes de los archivos
 */

export interface DecryptedFile {
  name: string;
  type: string;
  size: number;
  data: Uint8Array;
}

export interface DecryptedPayload {
  message: string;
  files: DecryptedFile[];
}

interface Manifest {
  v: 1;
  m: string;
  f: { n: string; t: string; s: number }[];
}

export async function encodePayload(message: string, files: File[]): Promise<Uint8Array> {
  const contents = await Promise.all(files.map(f => f.arrayBuffer().then(b => new Uint8Array(b))));
  const manifest: Manifest = {
    v: 1,
    m: message,
    f: files.map((f, i) => ({ n: f.name, t: f.type, s: contents[i].length })),
  };
  const head = new TextEncoder().encode(JSON.stringify(manifest));
  const total = 4 + head.length + contents.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, head.length);
  out.set(head, 4);
  let offset = 4 + head.length;
  for (const c of contents) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export function decodePayload(data: Uint8Array): DecryptedPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const headLen = view.getUint32(0);
  if (4 + headLen > data.length) throw new Error('malformed_payload');
  const manifest = JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + headLen))) as Manifest;
  if (manifest.v !== 1 || typeof manifest.m !== 'string' || !Array.isArray(manifest.f)) {
    throw new Error('malformed_payload');
  }
  let offset = 4 + headLen;
  const files = manifest.f.map(f => {
    if (!Number.isInteger(f.s) || f.s < 0 || offset + f.s > data.length) throw new Error('malformed_payload');
    const file = { name: String(f.n), type: String(f.t || ''), size: f.s, data: data.slice(offset, offset + f.s) };
    offset += f.s;
    return file;
  });
  return { message: manifest.m, files };
}
