/*
 * Recibos de lectura guardados en este navegador.
 * Solo el ID, el token del recibo y una nota opcional: nunca el enlace ni la clave,
 * así que con estos datos no se puede reconstruir el mensaje.
 */
export interface StoredReceipt {
  id: string;
  token: string;
  note: string;
  createdAt: number;
  expiresAt: number | null;
  files: number;
  seen: boolean; // el usuario ya vio que se leyó
}

const KEY = 'crypto.receipts.v1';

export function loadReceipts(): StoredReceipt[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(list: StoredReceipt[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // almacenamiento no disponible
  }
}

export function addReceipt(entry: StoredReceipt) {
  save([entry, ...loadReceipts().filter(r => r.id !== entry.id)]);
}

export function removeReceipt(id: string) {
  save(loadReceipts().filter(r => r.id !== id));
}

export function findReceipt(id: string): StoredReceipt | undefined {
  return loadReceipts().find(r => r.id === id);
}

export function markReceiptsSeen(ids: string[]) {
  save(loadReceipts().map(r => (ids.includes(r.id) ? { ...r, seen: true } : r)));
}
