export const WORD_STATUSES = ['Mới', 'Đang học', 'Hoàn thành'];

export const STATUS = {
  NEW: 'Mới',
  LEARNING: 'Đang học',
  COMPLETED: 'Hoàn thành',
};

export const REVIEW_RESULTS = ['đang học', 'hoàn thành'];

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export const EXAMPLE_TEMPLATE = `[
  {
    "sentence": "She took a quick shower before leaving for work",
    "meaning": "Cô ấy đã tắm nhanh trước khi đi làm."
  }
]`;

export function isWordStatus(value) {
  return WORD_STATUSES.includes(value);
}

export function statusBadgeClass(status) {
  if (status === STATUS.NEW) return 'status-moi';
  if (status === STATUS.LEARNING) return 'status-dang-hoc';
  return 'status-hoan-thanh';
}
