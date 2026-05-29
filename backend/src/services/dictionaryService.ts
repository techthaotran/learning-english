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
  mapDictionaryRow,
  stringifyExamples,
  SRS_INTERVALS,
  addDays,
  todayLocal,
  queryAll,
  queryOne,
  run,
  type DictionaryRow,
} from '../db.js';
import { getAllParticipantStats, upsertParticipant } from './participantService.js';

/** Words eligible for SRS: all "Mới", or "Đang học" whose next review is today or earlier. */
const FLASHCARD_DUE_SQL = `
  d.status = ?
  OR (
    d.status = ?
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
    )
  )
`;

const DICTIONARY_SELECT = `d.id, d.user_id, d.name, d.type, d.transcription, d.meaning, d.example, d.status, d.created_date`;
const DICTIONARY_SELECT_WITH_USER = `${DICTIONARY_SELECT}, u.username`;

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

export async function createWord(
  userId: number,
  payload: CreateWordPayload
): Promise<DictionaryWord | null> {
  const examples = normalizeExamples(payload.example);
  const result = await run(
    `INSERT INTO my_dictionary (user_id, name, type, transcription, meaning, example, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.name.trim(),
      payload.type?.trim() || '',
      payload.transcription?.trim() || '',
      payload.meaning?.trim() || '',
      stringifyExamples(examples),
      STATUS.NEW,
    ]
  );

  const globalDictionaryId = payload.globalDictionaryId;
  if (globalDictionaryId != null && Number.isFinite(globalDictionaryId)) {
    const { recordGlobalFlashcardLink } = await import('./globalDictionaryService.js');
    await recordGlobalFlashcardLink(userId, Number(globalDictionaryId), result.lastInsertRowid);
  }

  return getWordById(result.lastInsertRowid, userId);
}

export async function getWordById(
  id: number,
  userId?: number
): Promise<DictionaryWord | null> {
  const row = userId != null
    ? await queryOne<DictionaryRow>(
        `SELECT ${DICTIONARY_SELECT_WITH_USER}
         FROM my_dictionary d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.id = ? AND d.user_id = ?`,
        [id, userId]
      )
    : await queryOne<DictionaryRow>(
        `SELECT ${DICTIONARY_SELECT_WITH_USER}
         FROM my_dictionary d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.id = ?`,
        [id]
      );
  return mapDictionaryRow(row);
}

export interface ListWordsParams {
  userId?: number;
  allUsers?: boolean;
  keyword?: string;
  status?: string;
  emptyExample?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listWords({
  userId,
  allUsers = false,
  keyword,
  status,
  emptyExample,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: ListWordsParams = {}): Promise<PaginatedWords> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (safePage - 1) * safePageSize;

  const fromClause = allUsers
    ? `FROM my_dictionary d LEFT JOIN users u ON u.id = d.user_id`
    : `FROM my_dictionary d`;
  let where = allUsers ? 'WHERE 1=1' : 'WHERE d.user_id = ?';
  const params: (string | number | WordStatus)[] = allUsers ? [] : [userId!];

  if (keyword?.trim()) {
    where += ' AND d.name LIKE ? COLLATE NOCASE';
    params.push(`%${keyword.trim()}%`);
  }
  if (status && isWordStatus(status)) {
    where += ' AND d.status = ?';
    params.push(status);
  }
  if (emptyExample) {
    where +=
      " AND (d.example = '[]' OR trim(d.example) = '' OR json_array_length(d.example) = 0)";
  }

  const countRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count ${fromClause} ${where}`,
    params
  );
  const total = countRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  const selectCols = allUsers ? DICTIONARY_SELECT_WITH_USER : DICTIONARY_SELECT;
  const rows = await queryAll<DictionaryRow>(
    `SELECT ${selectCols}
     ${fromClause} ${where}
     ORDER BY d.created_date DESC
     LIMIT ? OFFSET ?`,
    [...params, safePageSize, offset]
  );

  return {
    items: rows.map((row) => mapDictionaryRow(row)!),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export async function updateWord(
  id: number,
  payload: UpdateWordPayload,
  userId?: number,
  asAdmin = false
): Promise<DictionaryWord | null> {
  const existing = asAdmin ? await getWordById(id) : await getWordById(id, userId);
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

  if (asAdmin) {
    await run(
      `UPDATE my_dictionary
       SET name = ?, type = ?, transcription = ?, meaning = ?, example = ?, status = ?
       WHERE id = ?`,
      [name, type, transcription, meaning, example, status, id]
    );
    return getWordById(id);
  }

  await run(
    `UPDATE my_dictionary
     SET name = ?, type = ?, transcription = ?, meaning = ?, example = ?, status = ?
     WHERE id = ? AND user_id = ?`,
    [name, type, transcription, meaning, example, status, id, userId!]
  );

  return getWordById(id, userId);
}

export async function deleteWord(
  id: number,
  userId?: number,
  asAdmin = false
): Promise<boolean> {
  const existing = asAdmin ? await getWordById(id) : await getWordById(id, userId);
  if (!existing) return false;

  if (asAdmin) {
    await run('DELETE FROM my_dictionary WHERE id = ?', [id]);
  } else {
    await run('DELETE FROM my_dictionary WHERE id = ? AND user_id = ?', [id, userId!]);
  }
  return true;
}

export async function searchWords(keyword: string, userId: number): Promise<DictionaryWord[]> {
  const q = `%${keyword.trim()}%`;
  const rows = await queryAll<DictionaryRow>(
    `SELECT ${DICTIONARY_SELECT}
     FROM my_dictionary d
     WHERE d.user_id = ? AND d.name LIKE ? COLLATE NOCASE
     ORDER BY d.created_date DESC`,
    [userId, q]
  );
  return rows.map((row) => mapDictionaryRow(row)!);
}

export async function getDashboardStats(
  userId: number,
  userName: string
): Promise<DashboardResponse> {
  const byStatus = await queryAll<{ status: WordStatus; count: number }>(
    `SELECT status, COUNT(*) as count FROM my_dictionary WHERE user_id = ? GROUP BY status`,
    [userId]
  );
  const total = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM my_dictionary WHERE user_id = ?`,
    [userId]
  );
  const recent = await queryAll<DictionaryRow>(
    `SELECT ${DICTIONARY_SELECT} FROM my_dictionary d WHERE d.user_id = ? ORDER BY d.created_date DESC LIMIT 5`,
    [userId]
  );
  const studyToday = await queryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT dictionary_id) as count
     FROM study_history
     WHERE user_id = ? AND date(reviewed_at) = date('now', 'localtime')`,
    [userId]
  );
  const dueForReview = await queryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT d.id) as count
     FROM my_dictionary d
     WHERE d.user_id = ? AND (${FLASHCARD_DUE_SQL})`,
    [userId, STATUS.NEW, STATUS.LEARNING]
  );

  const statusMap: StatusCounts = {
    [STATUS.NEW]: 0,
    [STATUS.LEARNING]: 0,
    [STATUS.COMPLETED]: 0,
  };
  for (const row of byStatus) {
    statusMap[row.status] = row.count;
  }

  const participants = await getAllParticipantStats();
  const trimmed = userName.trim();
  const me =
    participants.find((p) => p.userName === trimmed) ?? {
      userName: trimmed,
      studiedToday: 0,
      totalReviews: 0,
      completedReviews: 0,
      lastActiveAt: null,
    };

  return {
    total: total?.count ?? 0,
    byStatus: statusMap,
    studiedToday: studyToday?.count ?? 0,
    dueForReview: dueForReview?.count ?? 0,
    recentWords: recent.map((row) => mapDictionaryRow(row)!),
    me,
    participants,
  };
}

export async function getFlashcardBatch(userId: number, limit = 10): Promise<FlashcardWord[]> {
  const rows = await queryAll<DictionaryRow>(
    `SELECT ${DICTIONARY_SELECT} FROM my_dictionary d
     WHERE d.user_id = ? AND (${FLASHCARD_DUE_SQL})
     ORDER BY RANDOM()
     LIMIT ?`,
    [userId, STATUS.NEW, STATUS.LEARNING, limit]
  );

  return Promise.all(
    rows.map(async (row) => {
      const word = mapDictionaryRow(row)!;
      const examples = word.example;
      const pickIndex =
        examples.length > 0 ? Math.floor(Math.random() * examples.length) : 0;
      const flashExample = examples[pickIndex] ?? null;
      const srs = await getLatestSrsLevel(row.id);
      return {
        ...word,
        flashExample,
        srsLevel: srs.level,
        nextReviewDate: srs.nextReviewDate,
      };
    })
  );
}

async function getLatestSrsLevel(dictionaryId: number): Promise<{
  level: number;
  nextReviewDate: string | null;
}> {
  const latest = await queryOne<{ srs_level: number; next_review_date: string }>(
    `SELECT srs_level, next_review_date FROM study_history
     WHERE dictionary_id = ?
     ORDER BY reviewed_at DESC LIMIT 1`,
    [dictionaryId]
  );
  return {
    level: latest?.srs_level ?? -1,
    nextReviewDate: latest?.next_review_date ?? null,
  };
}

export async function recordFlashcardReview({
  dictionaryId,
  userId,
  userName,
  result,
}: {
  dictionaryId: number;
  userId: number;
  userName: string;
  result: ReviewResult;
}): Promise<DictionaryWord | null> {
  await upsertParticipant(userName);

  const word = await getWordById(dictionaryId, userId);
  if (!word) return null;

  const latest = await queryOne<{ srs_level: number }>(
    `SELECT srs_level FROM study_history
     WHERE dictionary_id = ?
     ORDER BY reviewed_at DESC LIMIT 1`,
    [dictionaryId]
  );

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

  await run(`UPDATE my_dictionary SET status = ? WHERE id = ? AND user_id = ?`, [
    newStatus,
    dictionaryId,
    userId,
  ]);

  if (word.status === STATUS.NEW && newStatus === STATUS.LEARNING) {
    srsLevel = 0;
  }

  await run(
    `INSERT INTO study_history (dictionary_id, user_id, next_review_date, srs_level, result)
     VALUES (?, ?, ?, ?, ?)`,
    [dictionaryId, userId, nextReview, srsLevel, result]
  );

  return getWordById(dictionaryId, userId);
}
