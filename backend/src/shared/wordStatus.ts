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

export function isWordStatus(value: string): value is WordStatus {
  return (WORD_STATUSES as readonly string[]).includes(value);
}
