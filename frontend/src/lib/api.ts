import { getBackendURL } from '../config';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public data: any = {}) {
    super(code);
  }
}

export interface ShareMeta {
  legacy: boolean;
  destroy: boolean;
  protected: boolean;
  expires_at: number | null;
}

export interface LegacyShare {
  legacy: true;
  msg: string;
  files: { name: string; size: number; content: string }[];
  destroyed: boolean;
  expires_at: number | null;
}

export interface Share {
  envelope: Uint8Array;
  destroyed: boolean;
  expiresAt: number | null;
}

// Clave i18n para mostrar un error de red/servidor
export function apiErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'notifications.error.network';
    if (error.status === 429) return 'notifications.error.rateLimited';
    if (error.status === 413) return 'notifications.error.tooLarge';
    if (error.status === 503) return 'notifications.error.storageFull';
  }
  if (error instanceof Error && error.message === 'insecure_context') return 'notifications.error.insecureContext';
  return 'notifications.error.unexpectedError';
}

async function request(path: string, fields: Record<string, string | Blob | undefined>): Promise<Response> {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => v !== undefined && form.append(k, v));
  let response: Response;
  try {
    response = await fetch(getBackendURL() + path, { method: 'POST', body: form, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'network_error');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || 'server_error', data);
  }
  return response;
}

export async function createShare(envelope: Uint8Array, expire: string, destroy: boolean, token: string) {
  const res = await request('/post', {
    payload: new Blob([envelope as BlobPart], { type: 'application/octet-stream' }),
    expire,
    destroy: destroy ? '1' : '0',
    token,
  });
  return (await res.json()) as { id: string; expires_at: number | null };
}

export async function getMeta(id: string, token?: string): Promise<ShareMeta> {
  return (await request('/meta', { id, token })).json();
}

export async function fetchShare(id: string, token: string): Promise<Share> {
  const res = await request('/get', { id, token });
  const expires = res.headers.get('X-Expires-At');
  return {
    envelope: new Uint8Array(await res.arrayBuffer()),
    destroyed: res.headers.get('X-Destroyed') === '1',
    expiresAt: expires ? parseInt(expires, 10) : null,
  };
}

export async function fetchLegacyShare(id: string): Promise<LegacyShare> {
  return (await request('/get', { id })).json();
}

export async function reportFailedAttempt(id: string, token?: string): Promise<number> {
  try {
    const res = await request('/fail_attempt', { id, token });
    return (await res.json()).attempts_left;
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'too_many_attempts' || e.status === 404)) return 0;
    throw e;
  }
}

export async function deleteShare(id: string, token?: string): Promise<void> {
  await request('/delete', { id, token });
}

//
// Solicitudes
//
export type RequestStatus = 'pending' | 'answered';

export async function createRequest(expire: string, ownerToken: string, respondToken: string) {
  const res = await request('/request/create', { expire, owner_token: ownerToken, respond_token: respondToken });
  return (await res.json()) as { id: string; expires_at: number | null };
}

// Vista de quien responde
export async function getRequestInfo(id: string, respondToken: string) {
  const res = await request('/request/info', { id, token: respondToken });
  return (await res.json()) as { status: RequestStatus; expires_at: number | null };
}

export async function respondRequest(id: string, respondToken: string, box: Uint8Array) {
  await request('/request/respond', {
    id,
    token: respondToken,
    payload: new Blob([box as BlobPart], { type: 'application/octet-stream' }),
  });
}

// Vista del dueño
export async function getRequestStatus(id: string, ownerToken: string) {
  const res = await request('/request/status', { id, token: ownerToken });
  return (await res.json()) as { status: RequestStatus; expires_at: number | null };
}

export async function openRequest(id: string, ownerToken: string): Promise<Uint8Array> {
  const res = await request('/request/open', { id, token: ownerToken });
  return new Uint8Array(await res.arrayBuffer());
}

export async function deleteRequest(id: string, ownerToken: string) {
  await request('/request/delete', { id, token: ownerToken });
}
