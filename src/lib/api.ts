export type ApiEnemy = {
  id: string;
  name: string;
  color: string;
  hpMax: number;
  R: number;
  sm: number;
  imageData?: string;
};

// Partida desada al servidor. `data` és un blob opac (l'estat que el frontend
// ja serialitza al save .json); la API no en valida l'estructura interna.
export type ApiSessionMeta = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
};

export type ApiSession = ApiSessionMeta & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export function isApiConfigured(): boolean {
  return BASE.length > 0;
}

function getAuthToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Cert només si el DM està loguejat al back office (té la cookie admin_token).
// Les rutes /sessions estan protegides amb JWT admin: sense token, 401.
export function isAdminLoggedIn(): boolean {
  return getAuthToken() !== null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('NEXT_PUBLIC_API_URL no configurat');
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Error API ${res.status}${body ? `: ${body}` : ''}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  enemies: {
    list: () => apiFetch<ApiEnemy[]>('/enemies'),
    create: (data: Omit<ApiEnemy, 'id'>) =>
      apiFetch<ApiEnemy>('/enemies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Omit<ApiEnemy, 'id'>>) =>
      apiFetch<ApiEnemy>(`/enemies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<void>(`/enemies/${id}`, { method: 'DELETE' }),
  },
  sessions: {
    // Llista lleugera, SENSE el camp pesat `data`.
    list: () => apiFetch<ApiSessionMeta[]>('/sessions'),
    get: (id: string) => apiFetch<ApiSession>(`/sessions/${id}`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (name: string, data: Record<string, any>) =>
      apiFetch<ApiSession>('/sessions', { method: 'POST', body: JSON.stringify({ name, data }) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (id: string, body: { name?: string; data?: Record<string, any> }) =>
      apiFetch<ApiSession>(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) =>
      apiFetch<void>(`/sessions/${id}`, { method: 'DELETE' }),
  },
};
