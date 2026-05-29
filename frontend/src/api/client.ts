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

interface ApiError {
  error?: string;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
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
  page?: number;
  pageSize?: number;
}

export function listWords(params: ListWordsParams = {}): Promise<PaginatedWords> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.status) search.set('status', params.status);
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
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (res.status === 204) return;
  const data = (await res.json().catch(() => ({}))) as ApiError;
  throw new Error(data.error || `HTTP ${res.status}`);
}

export function searchWords(q: string): Promise<DictionaryWord[]> {
  return request(`${BASE}/search?q=${encodeURIComponent(q)}`);
}

export function getDashboard(userName: string): Promise<DashboardResponse> {
  return request(
    `${BASE}/dashboard?userName=${encodeURIComponent(userName)}`
  );
}

export function registerParticipant(userName: string): Promise<{ userName: string }> {
  return request(buildApiUrl('/api/participants'), {
    method: 'POST',
    body: JSON.stringify({ userName }),
  });
}

export function getFlashcards(userName: string): Promise<FlashcardWord[]> {
  return request(
    `${BASE}/flashcards?userName=${encodeURIComponent(userName)}`
  );
}

export function submitFlashcardReview(payload: {
  dictionaryId: number;
  userName: string;
  result: ReviewResult;
}): Promise<DictionaryWord> {
  return request(`${BASE}/flashcards/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
