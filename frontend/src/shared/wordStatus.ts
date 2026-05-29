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

export const EXAMPLE_TEMPLATE = `[
  {
    "sentence": "She took a quick shower before leaving for work",
    "meaning": "Cô ấy đã tắm nhanh trước khi đi làm."
  }
]`;

export function statusBadgeClass(status: WordStatus): string {
  if (status === STATUS.NEW) return 'status-moi';
  if (status === STATUS.LEARNING) return 'status-dang-hoc';
  return 'status-hoan-thanh';
}
