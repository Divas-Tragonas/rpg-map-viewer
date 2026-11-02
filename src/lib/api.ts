export type ApiEnemy = {
  id: string;
  name: string;
  color: string;
  hpMax: number;
  R: number;
  sm: number;
  imageData?: string;
  // Text lliure per agrupar-los (`src/lib/enemy-groups.ts`); '' = sense projecte/categoria.
  // Opcionals perquè una API anterior no els retorna.
  project?: string;
  category?: string;
  /** XP que dona en ser derrotat (0 = cap). Opcional: una API anterior no el retorna. */
  xp?: number;
};

/** Entrada de l'historial d'experiència d'un personatge (els 200 últims, els nous al final). */
export type ApiXpLogEntry = { amount: number; reason: string; source: string; awardId: string; at: string };

/**
 * Fitxa d'un personatge de la campanya (`/characters`, protegit amb el JWT del back office
 * també per llegir). Els camps que fa servir l'app són columnes; la resta de la fitxa va a
 * `sheet`, opac per a la API (format a `src/lib/characters.ts`). `xp` només es mou pels punts
 * d'experiència (`awardXp`), mai per `create`/`update`.
 */
export type ApiCharacter = {
  id: string;
  name: string;
  player: string;
  race: string;
  className: string;
  level: number;
  xp: number;
  hpMax: number;
  ac: number;
  speed: number;
  passivePerception: number;
  portrait: string;
  notionUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheet: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  /** Només a `GET /characters/:id`. */
  xpLog?: ApiXpLogEntry[];
};

export type ApiCharacterInput = Omit<ApiCharacter, 'id' | 'xp' | 'xpLog' | 'createdAt' | 'updatedAt'>;
export type XpMeta = { reason?: string; source?: string; awardId?: string };

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
  characters: {
    // Llista SENSE l'historial d'experiència.
    list: () => apiFetch<ApiCharacter[]>('/characters'),
    get: (id: string) => apiFetch<ApiCharacter>(`/characters/${id}`),
    create: (data: Partial<ApiCharacterInput> & { name: string }) =>
      apiFetch<ApiCharacter>('/characters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ApiCharacterInput>) =>
      apiFetch<ApiCharacter>(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<void>(`/characters/${id}`, { method: 'DELETE' }),
    /** Suma (o resta) experiència. Amb `awardId`, la API no la torna a sumar si ja hi és. */
    awardXp: (id: string, amount: number, meta: XpMeta = {}) =>
      apiFetch<ApiCharacter>(`/characters/${id}/xp`, { method: 'POST', body: JSON.stringify({ amount, ...meta }) }),
    /** Repartiment a uns quants alhora (fi d'un combat). Un id que no existeix → 404 i no s'aplica cap. */
    awardXpBatch: (awards: { id: string; amount: number }[], meta: XpMeta = {}) =>
      apiFetch<ApiCharacter[]>('/characters/xp', { method: 'POST', body: JSON.stringify({ awards, ...meta }) }),
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
