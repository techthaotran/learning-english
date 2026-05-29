import type { WordStatus } from './wordStatus.js';

export interface ExampleItem {
  sentence: string;
  meaning: string;
}

export interface DictionaryWord {
  id: number;
  user_id: number;
  username?: string;
  name: string;
  type: string;
  transcription: string;
  meaning: string;
  example: ExampleItem[];
  status: WordStatus;
  created_date: string;
}

export interface GlobalDictionaryWord {
  id: number;
  name: string;
  level: string;
  type: string;
  transcription: string;
  meaning: string;
  example: ExampleItem[];
  created_date: string;
  inFlashcard?: boolean;
}

export interface GlobalLevelSummary {
  level: string;
  count: number;
}

export interface GlobalTypeSummary {
  type: string;
  count: number;
}

export interface PaginatedGlobalWords {
  items: GlobalDictionaryWord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedWords {
  items: DictionaryWord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ParticipantStats {
  userName: string;
  studiedToday: number;
  totalReviews: number;
  completedReviews: number;
  lastActiveAt: string | null;
}

export type StatusCounts = Record<WordStatus, number>;

export interface DashboardResponse {
  total: number;
  byStatus: StatusCounts;
  studiedToday: number;
  dueForReview: number;
  recentWords: DictionaryWord[];
  me: ParticipantStats | null;
  participants: ParticipantStats[];
}

export interface FlashcardWord extends DictionaryWord {
  flashExample: ExampleItem | null;
  srsLevel: number;
  nextReviewDate: string | null;
}

export interface CreateWordPayload {
  name: string;
  type?: string;
  transcription?: string;
  meaning?: string;
  example: ExampleItem[] | string;
  globalDictionaryId?: number;
}

export interface WordLookupResult {
  word: string;
  type: string;
  meaning: string;
  transcription: string;
}

export interface TextTranslateResult {
  text: string;
  translation: string;
}

export interface UpdateWordPayload {
  name?: string;
  type?: string;
  transcription?: string;
  meaning?: string;
  example?: ExampleItem[] | string;
  status?: WordStatus;
}
