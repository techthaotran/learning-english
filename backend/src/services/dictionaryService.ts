import {
  STATUS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  isWordStatus,
  type ReviewResult,
  type WordStatus,
} from '../shared/wordStatus.js';
import type {
  CreateWordPayload,
  DashboardResponse,
  DictionaryWord,
  FlashcardWord,
  PaginatedWords,
  StatusCounts,
  UpdateWordPayload,
} from '../shared/types.js';
import {
  getDb,
  mapDictionaryRow,
  stringifyExamples,
  SRS_INTERVALS,
  addDays,
  todayLocal,
  type DictionaryRow,
} from '../db.js';
import { getAllParticipantStats, upsertParticipant } from './participantService.js';

function normalizeExamples(example: CreateWordPayload['example']): DictionaryWord['example'] {
  if (Array.isArray(example)) return example;
  if (typeof example === 'string') {
    try {
      const parsed: unknown = JSON.parse(example);
      if (Array.isArray(parsed)) return parsed as DictionaryWord['example'];
    } catch {
      return [];
    }
  }
  return [];
}

export function createWord(payload: CreateWordPayload): DictionaryWord | null {
  const db = getDb();
  const examples = normalizeExamples(payload.example);
  const result = db
    .prepare(
      `INSERT INTO dictionary (name, type, transcription, meaning, example, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.name.trim(),
      payload.type?.trim() || '',
      payload.transcription?.trim() || '',
      payload.meaning?.trim() || '',
      stringifyExamples(examples),
      STATUS.NEW
    );
  return getWordById(Number(result.lastInsertRowid));
}

export function getWordById(id: number): DictionaryWord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM dictionary WHERE id = ?').get(id) as
    | DictionaryRow
    | undefined;
  return mapDictionaryRow(row);
}

export interface ListWordsParams {
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function listWords({
  keyword,
  status,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: ListWordsParams = {}): PaginatedWords {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (safePage - 1) * safePageSize;

  let where = 'WHERE 1=1';
  const params: (string | WordStatus)[] = [];

  if (keyword?.trim()) {
    where += ' AND name LIKE ? COLLATE NOCASE';
    params.push(`%${keyword.trim()}%`);
  }
  if (status && isWordStatus(status)) {
    where += ' AND status = ?';
    params.push(status);
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM dictionary ${where}`)
    .get(...params) as { count: number };
  const total = countRow.count;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  const rows = db
    .prepare(
      `SELECT * FROM dictionary ${where}
       ORDER BY created_date DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, safePageSize, offset) as unknown as DictionaryRow[];

  return {
    items: rows.map((row) => mapDictionaryRow(row)!),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export function updateWord(
  id: number,
  payload: UpdateWordPayload
): DictionaryWord | null {
  const db = getDb();
  const existing = getWordById(id);
  if (!existing) return null;

  const name = payload.name?.trim() ?? existing.name;
  const type = payload.type !== undefined ? String(payload.type).trim() : existing.type;
  const transcription =
    payload.transcription !== undefined
      ? String(payload.transcription).trim()
      : existing.transcription;
  const meaning =
    payload.meaning !== undefined ? String(payload.meaning).trim() : existing.meaning;
  const example =
    payload.example !== undefined
      ? stringifyExamples(normalizeExamples(payload.example))
      : stringifyExamples(existing.example);
  const status =
    payload.status && isWordStatus(payload.status) ? payload.status : existing.status;

  if (!name) {
    throw new Error('Tên từ không được để trống');
  }

  db.prepare(
    `UPDATE dictionary
     SET name = ?, type = ?, transcription = ?, meaning = ?, example = ?, status = ?
     WHERE id = ?`
  ).run(name, type, transcription, meaning, example, status, id);

  return getWordById(id);
}

export function deleteWord(id: number): boolean {
  const db = getDb();
  const existing = getWordById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM dictionary WHERE id = ?').run(id);
  return true;
}

export function searchWords(keyword: string): DictionaryWord[] {
  const db = getDb();
  const q = `%${keyword.trim()}%`;
  const rows = db
    .prepare(
      `SELECT * FROM dictionary
       WHERE name LIKE ? COLLATE NOCASE
       ORDER BY created_date DESC`
    )
    .all(q) as unknown as DictionaryRow[];
  return rows.map((row) => mapDictionaryRow(row)!);
}

export function getDashboardStats(userName?: string): DashboardResponse {
  const db = getDb();
  const byStatus = db
    .prepare(`SELECT status, COUNT(*) as count FROM dictionary GROUP BY status`)
    .all() as { status: WordStatus; count: number }[];
  const total = db.prepare('SELECT COUNT(*) as count FROM dictionary').get() as {
    count: number;
  };
  const recent = db
    .prepare(`SELECT * FROM dictionary ORDER BY created_date DESC LIMIT 5`)
    .all() as unknown as DictionaryRow[];
  const studyToday = db
    .prepare(
      `SELECT COUNT(DISTINCT dictionary_id) as count
       FROM study_history
       WHERE date(reviewed_at) = date('now', 'localtime')`
    )
    .get() as { count: number };
  const dueForReview = db
    .prepare(
      `SELECT COUNT(DISTINCT d.id) as count
       FROM dictionary d
       WHERE d.status = ?
       AND (
         NOT EXISTS (SELECT 1 FROM study_history sh WHERE sh.dictionary_id = d.id)
         OR EXISTS (
           SELECT 1 FROM study_history sh2
           WHERE sh2.dictionary_id = d.id
           AND sh2.id = (
             SELECT id FROM study_history
             WHERE dictionary_id = d.id
             ORDER BY reviewed_at DESC LIMIT 1
           )
           AND date(sh2.next_review_date) <= date('now', 'localtime')
         )
       )`
    )
    .get(STATUS.LEARNING) as { count: number };

  const statusMap: StatusCounts = {
    [STATUS.NEW]: 0,
    [STATUS.LEARNING]: 0,
    [STATUS.COMPLETED]: 0,
  };
  for (const row of byStatus) {
    statusMap[row.status] = row.count;
  }

  const participants = getAllParticipantStats();
  const trimmed = userName?.trim();
  const me =
    trimmed != null && trimmed !== ''
      ? participants.find((p) => p.userName === trimmed) ?? {
          userName: trimmed,
          studiedToday: 0,
          totalReviews: 0,
          completedReviews: 0,
          lastActiveAt: null,
        }
      : null;

  return {
    total: total.count,
    byStatus: statusMap,
    studiedToday: studyToday.count,
    dueForReview: dueForReview.count,
    recentWords: recent.map((row) => mapDictionaryRow(row)!),
    me,
    participants,
  };
}

export function getFlashcardBatch(
  userName: string,
  limit = 10
): FlashcardWord[] {
  const db = getDb();
  void userName;
  const rows = db
    .prepare(
      `SELECT * FROM dictionary
       WHERE status = ?
       ORDER BY RANDOM()
       LIMIT ?`
    )
    .all(STATUS.LEARNING, limit) as unknown as DictionaryRow[];

  return rows.map((row) => {
    const word = mapDictionaryRow(row)!;
    const examples = word.example;
    const pickIndex =
      examples.length > 0 ? Math.floor(Math.random() * examples.length) : 0;
    const flashExample = examples[pickIndex] ?? null;
    const srs = getLatestSrsLevel(row.id);
    return {
      ...word,
      flashExample,
      srsLevel: srs.level,
      nextReviewDate: srs.nextReviewDate,
    };
  });
}

function getLatestSrsLevel(dictionaryId: number): {
  level: number;
  nextReviewDate: string | null;
} {
  const db = getDb();
  const latest = db
    .prepare(
      `SELECT srs_level, next_review_date FROM study_history
       WHERE dictionary_id = ?
       ORDER BY reviewed_at DESC LIMIT 1`
    )
    .get(dictionaryId) as
    | { srs_level: number; next_review_date: string }
    | undefined;
  return {
    level: latest?.srs_level ?? -1,
    nextReviewDate: latest?.next_review_date ?? null,
  };
}

export function recordFlashcardReview({
  dictionaryId,
  userName,
  result,
}: {
  dictionaryId: number;
  userName: string;
  result: ReviewResult;
}): DictionaryWord | null {
  const db = getDb();
  upsertParticipant(userName);

  const word = getWordById(dictionaryId);
  if (!word) return null;

  const latest = db
    .prepare(
      `SELECT srs_level FROM study_history
       WHERE dictionary_id = ?
       ORDER BY reviewed_at DESC LIMIT 1`
    )
    .get(dictionaryId) as { srs_level: number } | undefined;

  let srsLevel = (latest?.srs_level ?? -1) + 1;
  if (result === 'hoàn thành') {
    srsLevel = SRS_INTERVALS.length - 1;
  }
  srsLevel = Math.min(srsLevel, SRS_INTERVALS.length - 1);

  const intervalDays = SRS_INTERVALS[srsLevel];
  const today = todayLocal();
  const nextReview = addDays(today, intervalDays);

  const newStatus =
    result === 'hoàn thành' ? STATUS.COMPLETED : STATUS.LEARNING;

  db.prepare(`UPDATE dictionary SET status = ? WHERE id = ?`).run(
    newStatus,
    dictionaryId
  );

  if (word.status === STATUS.NEW && newStatus === STATUS.LEARNING) {
    srsLevel = 0;
  }

  db.prepare(
    `INSERT INTO study_history (dictionary_id, user_name, next_review_date, srs_level, result)
     VALUES (?, ?, ?, ?, ?)`
  ).run(dictionaryId, userName, nextReview, srsLevel, result);

  return getWordById(dictionaryId);
}
