import type { WordLookupResult } from '@/shared/types';

/**
 * Auto fill: client gọi API nội bộ → server gọi Google translate_a/single (tránh CORS).
 * @see https://translate.google.com/translate_a/single
 */
const RAW_API_BASE = import.meta.env.VITE_API_BASE?.trim() || '';

function buildApiUrl(path: string): string {
  if (!RAW_API_BASE) return path;
  return `${RAW_API_BASE.replace(/\/+$/, '')}${path}`;
}

export async function lookupWordFromGoogle(word: string): Promise<WordLookupResult> {
  const q = word.trim();
  if (!q) {
    throw new Error('Từ vựng không được để trống');
  }

  const res = await fetch(buildApiUrl(`/api/translate/lookup?q=${encodeURIComponent(q)}`));
  const data = (await res.json().catch(() => ({}))) as WordLookupResult & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}
