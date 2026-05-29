import type {
  CreateWordPayload,
  DashboardResponse,
  DictionaryWord,
  FlashcardWord,
  PaginatedWords,
  ReviewResult,
  UpdateWordPayload,
  WordStatus,
} from '@/shared/types';

const RAW_API_BASE = import.meta.env.VITE_API_BASE?.trim() || '';

function buildApiUrl(path: string): string {
  if (!RAW_API_BASE) return path;
  return `${RAW_API_BASE.replace(/\/+$/, '')}${path}`;
}

const BASE = buildApiUrl('/api/dictionary');
const AUTH_BASE = buildApiUrl('/api/auth');

interface ApiError {
  error?: string;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = (await res.json().catch(() => ({}))) as ApiError;
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export interface ListWordsParams {
  q?: string;
  status?: WordStatus | '';
  emptyExample?: boolean;
  page?: number;
  pageSize?: number;
}

export function listWords(params: ListWordsParams = {}): Promise<PaginatedWords> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.status) search.set('status', params.status);
  if (params.emptyExample) search.set('emptyExample', 'true');
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return request(`${BASE}${qs ? `?${qs}` : ''}`);
}

export function getWordById(id: number): Promise<DictionaryWord> {
  return request(`${BASE}/${id}`);
}

export function createWord(payload: CreateWordPayload): Promise<DictionaryWord> {
  return request(BASE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateWord(
  id: number,
  payload: UpdateWordPayload
): Promise<DictionaryWord> {
  return request(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteWord(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (res.status === 204) return;
  const data = (await res.json().catch(() => ({}))) as ApiError;
  throw new Error(data.error || `HTTP ${res.status}`);
}

export function searchWords(q: string): Promise<DictionaryWord[]> {
  return request(`${BASE}/search?q=${encodeURIComponent(q)}`);
}

export function getDashboard(): Promise<DashboardResponse> {
  return request(`${BASE}/dashboard`);
}

export function loginUser(payload: {
  username: string;
  password: string;
}): Promise<{ userName: string; isAdmin: boolean }> {
  return request(`${AUTH_BASE}/login`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function registerUser(payload: {
  username: string;
  password: string;
}): Promise<{ userName: string; isAdmin: boolean }> {
  return request(`${AUTH_BASE}/register`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchCurrentUser(): Promise<{
  userName: string;
  isAdmin: boolean;
} | null> {
  const res = await fetch(`${AUTH_BASE}/me`, {
    credentials: 'include',
  });
  if (res.status === 401) return null;
  const data = (await res.json().catch(() => ({}))) as ApiError & {
    userName?: string;
    isAdmin?: boolean;
  };
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  if (!data.userName?.trim()) return null;
  return { userName: data.userName.trim(), isAdmin: Boolean(data.isAdmin) };
}

export async function logoutUser(): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (res.status === 204) return;
  const data = (await res.json().catch(() => ({}))) as ApiError;
  throw new Error(data.error || `HTTP ${res.status}`);
}

export function getFlashcards(): Promise<FlashcardWord[]> {
  return request(`${BASE}/flashcards`);
}

export function submitFlashcardReview(payload: {
  dictionaryId: number;
  result: ReviewResult;
}): Promise<DictionaryWord> {
  return request(`${BASE}/flashcards/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
