import type { WordLookupResult } from '../shared/types.js';

export const GOOGLE_TRANSLATE_API =
  'https://translate.google.com/translate_a/single';
const GOOGLE_TRANSLATE_FALLBACK_API =
  'https://translate.googleapis.com/translate_a/single';

const DT_PARAMS = ['t', 'rmt', 'bd', 'rms', 'qca', 'ss', 'md', 'ld', 'ex', 'rw'] as const;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_RETRY_ON_429 = 2;
const REQUEST_TIMEOUT_MS = 8000;
const BASE_RETRY_DELAY_MS = 300;

const lookupCache = new Map<string, { expiresAt: number; value: WordLookupResult }>();

interface DictEntry {
  pos?: string;
  terms?: string[];
}

interface SentenceEntry {
  trans?: string;
  orig?: string;
  src_translit?: string;
}

interface GoogleTranslateResponse {
  sentences?: SentenceEntry[];
  dict?: DictEntry[];
}

type GoogleTranslateArrayResponse = unknown[];

export function buildGoogleTranslateUrl(word: string): string {
  const params = new URLSearchParams({
    q: word.trim(),
    sl: 'auto',
    tl: 'vi',
    hl: 'en',
    client: 'it',
    otf: '2',
    dj: '1',
    ie: 'UTF-8',
    oe: 'UTF-8',
  });
  for (const dt of DT_PARAMS) {
    params.append('dt', dt);
  }
  return `${GOOGLE_TRANSLATE_API}?${params.toString()}`;
}

function buildGoogleTranslateFallbackUrl(word: string): string {
  const params = new URLSearchParams({
    q: word.trim(),
    sl: 'auto',
    tl: 'vi',
    ie: 'UTF-8',
    oe: 'UTF-8',
    client: 'gtx',
  });
  params.append('dt', 't');
  params.append('dt', 'bd');
  return `${GOOGLE_TRANSLATE_FALLBACK_API}?${params.toString()}`;
}

function normalizeTranscription(raw: string): string {
  return raw.trim().replace(/^\/+|\/+$/g, '');
}

function extractTranscription(sentences: SentenceEntry[] | undefined): string {
  for (const entry of sentences ?? []) {
    const t = entry.src_translit?.trim();
    if (t) return normalizeTranscription(t);
  }
  return '';
}

function extractTranscriptionFromArraySentences(
  sentenceEntries: unknown[]
): string {
  for (const raw of sentenceEntries) {
    if (!Array.isArray(raw)) continue;
    for (const index of [2, 3]) {
      const value = raw[index];
      if (typeof value === 'string' && value.trim()) {
        return normalizeTranscription(value);
      }
    }
  }
  return '';
}

interface DictionaryPhonetic {
  text?: string;
}

interface DictionaryEntry {
  phonetics?: DictionaryPhonetic[];
}

async function fetchTranscriptionFromDictionary(word: string): Promise<string> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
    word.trim().toLowerCase()
  )}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return '';

    const entries = (await res.json()) as DictionaryEntry[];
    for (const entry of entries) {
      for (const phonetic of entry.phonetics ?? []) {
        const text = phonetic.text?.trim();
        if (text) return normalizeTranscription(text);
      }
    }
  } catch {
    return '';
  }
  return '';
}

function parseResponse(word: string, data: GoogleTranslateResponse): WordLookupResult {
  const types = new Set<string>();
  const meanings = new Set<string>();

  for (const entry of data.dict ?? []) {
    if (entry.pos?.trim()) types.add(entry.pos.trim());
    for (const term of entry.terms ?? []) {
      const t = term?.trim();
      if (t) meanings.add(t);
    }
  }

  const sentenceTrans = data.sentences?.[0]?.trans?.trim();
  if (meanings.size === 0 && sentenceTrans) {
    meanings.add(sentenceTrans);
  }

  return {
    word: data.sentences?.[0]?.orig?.trim() || word.trim(),
    type: [...types].join(', '),
    meaning: [...meanings].join(', '),
    transcription: extractTranscription(data.sentences),
  };
}

function parseArrayResponse(word: string, data: GoogleTranslateArrayResponse): WordLookupResult {
  const sentenceEntries = Array.isArray(data[0]) ? data[0] : [];
  const dictEntries = Array.isArray(data[1]) ? data[1] : [];

  const firstSentence = Array.isArray(sentenceEntries[0]) ? sentenceEntries[0] : [];
  const translatedFromSentence = typeof firstSentence[0] === 'string' ? firstSentence[0].trim() : '';
  const originalFromSentence = typeof firstSentence[1] === 'string' ? firstSentence[1].trim() : '';

  const types = new Set<string>();
  const meanings = new Set<string>();

  for (const rawEntry of dictEntries) {
    if (!Array.isArray(rawEntry)) continue;
    const pos = typeof rawEntry[0] === 'string' ? rawEntry[0].trim() : '';
    if (pos) types.add(pos);

    const terms = Array.isArray(rawEntry[1]) ? rawEntry[1] : [];
    for (const term of terms) {
      if (typeof term !== 'string') continue;
      const normalized = term.trim();
      if (normalized) meanings.add(normalized);
    }
  }

  if (meanings.size === 0 && translatedFromSentence) {
    meanings.add(translatedFromSentence);
  }

  return {
    word: originalFromSentence || word.trim(),
    type: [...types].join(', '),
    meaning: [...meanings].join(', '),
    transcription: extractTranscriptionFromArraySentences(sentenceEntries),
  };
}

function isRateLimited(status: number): boolean {
  return status === 429;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || isRateLimited(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url: string): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRY_ON_429; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        if (attempt < MAX_RETRY_ON_429 && isRetryableStatus(res.status)) {
          const jitterMs = Math.floor(Math.random() * 150);
          await sleep(BASE_RETRY_DELAY_MS * (attempt + 1) + jitterMs);
          continue;
        }
        throw new Error(`Google Translate trả về ${res.status}`);
      }

      return (await res.json()) as unknown;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Lỗi không xác định khi gọi Google Translate');
      if (attempt < MAX_RETRY_ON_429) {
        const jitterMs = Math.floor(Math.random() * 150);
        await sleep(BASE_RETRY_DELAY_MS * (attempt + 1) + jitterMs);
      }
    }
  }

  throw lastError ?? new Error('Không thể kết nối Google Translate');
}

export async function fetchWordFromGoogle(word: string): Promise<WordLookupResult> {
  const q = word.trim();
  if (!q) {
    throw new Error('Từ vựng không được để trống');
  }

  const cacheKey = q.toLowerCase();
  const cached = lookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let result: WordLookupResult | null = null;
  let primaryError: Error | null = null;

  try {
    const data = (await fetchJsonWithRetry(buildGoogleTranslateUrl(q))) as GoogleTranslateResponse;
    result = parseResponse(q, data);
  } catch (error) {
    primaryError =
      error instanceof Error ? error : new Error('Không thể gọi endpoint Google Translate chính');
  }

  if (!result || !result.meaning) {
    try {
      const fallbackData = (await fetchJsonWithRetry(
        buildGoogleTranslateFallbackUrl(q)
      )) as GoogleTranslateArrayResponse;
      result = parseArrayResponse(q, fallbackData);
    } catch (error) {
      if (primaryError) {
        throw primaryError;
      }
      throw (error instanceof Error
        ? error
        : new Error('Không thể gọi endpoint Google Translate dự phòng'));
    }
  }

  if (!result.meaning) {
    throw new Error('Không lấy được nghĩa từ Google Translate');
  }

  if (!result.transcription) {
    result.transcription = await fetchTranscriptionFromDictionary(result.word || q);
  }

  lookupCache.set(cacheKey, {
    value: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}
