export const WORD_STATUSES = ['Mới', 'Đang học', 'Hoàn thành'] as const;
export type WordStatus = (typeof WORD_STATUSES)[number];

export const STATUS = {
  NEW: 'Mới',
  LEARNING: 'Đang học',
  COMPLETED: 'Hoàn thành',
} as const satisfies Record<string, WordStatus>;

export const REVIEW_RESULTS = ['đang học', 'hoàn thành'] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export const EXAMPLE_TEMPLATE = `[
  {
    "sentence": "She took a quick shower before leaving for work",
    "meaning": "Cô ấy đã tắm nhanh trước khi đi làm."
  }
]`;

export function isWordStatus(value: string): value is WordStatus {
  return (WORD_STATUSES as readonly string[]).includes(value);
}

export function statusBadgeClass(status: WordStatus): string {
  if (status === STATUS.NEW) return 'status-moi';
  if (status === STATUS.LEARNING) return 'status-dang-hoc';
  return 'status-hoan-thanh';
}

export interface ExampleItem {
  sentence: string;
  meaning: string;
}

export interface DictionaryWord {
  id: number;
  name: string;
  type: string;
  transcription: string;
  meaning: string;
  example: ExampleItem[];
  status: WordStatus;
  created_date: string;
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
}

export interface WordLookupResult {
  word: string;
  type: string;
  meaning: string;
  transcription: string;
}

export interface UpdateWordPayload {
  name?: string;
  type?: string;
  transcription?: string;
  meaning?: string;
  example?: ExampleItem[] | string;
  status?: WordStatus;
}
