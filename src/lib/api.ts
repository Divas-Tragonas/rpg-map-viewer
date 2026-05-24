export type ApiEnemy = {
  id: string;
  name: string;
  color: string;
  hpMax: number;
  R: number;
  sm: number;
  imageData?: string;
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export function isApiConfigured(): boolean {
  return BASE.length > 0;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('NEXT_PUBLIC_API_URL no configurat');
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
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
};
