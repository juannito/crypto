/*
 * "Mis solicitudes": copia local (opcional) de los enlaces de buzón.
 * Si el buzón está protegido con código, aquí solo se guarda cifrado.
 */
export interface StoredRequest {
  id: string;
  label: string;
  createdAt: number;
  expiresAt: number | null;
  requestLink: string;
  inboxLink: string;
  locked: boolean;
  // Solo permite consultar el estado o borrar la solicitud; no descifra nada
  ownerToken: string;
}

const KEY = 'crypto.requests.v1';

export function loadRequests(): StoredRequest[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(list: StoredRequest[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // almacenamiento no disponible (modo privado): la lista queda solo en memoria
  }
}

export function addRequest(entry: StoredRequest) {
  save([entry, ...loadRequests().filter(r => r.id !== entry.id)]);
}

export function findRequest(id: string): StoredRequest | undefined {
  return loadRequests().find(r => r.id === id);
}

export function removeRequest(id: string) {
  save(loadRequests().filter(r => r.id !== id));
}
