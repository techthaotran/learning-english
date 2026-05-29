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

const DEFAULT_USER_NAME = 'guest';

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

function normalizeUserName(userName?: string): string {
  const trimmed = userName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_USER_NAME;
}

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
  userName: string,
  payload: CreateWordPayload
): Promise<DictionaryWord | null> {
  const owner = normalizeUserName(userName);
  const examples = normalizeExamples(payload.example);
  const result = await run(
    `INSERT INTO my_dictionary (user_name, name, type, transcription, meaning, example, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      owner,
      payload.name.trim(),
      payload.type?.trim() || '',
      payload.transcription?.trim() || '',
      payload.meaning?.trim() || '',
      stringifyExamples(examples),
      STATUS.NEW,
    ]
  );
  return getWordById(result.lastInsertRowid, owner);
}

export async function getWordById(
  id: number,
  userName?: string
): Promise<DictionaryWord | null> {
  const owner = userName != null ? normalizeUserName(userName) : null;
  const row = owner
    ? await queryOne<DictionaryRow>(
        'SELECT * FROM my_dictionary WHERE id = ? AND user_name = ?',
        [id, owner]
      )
    : await queryOne<DictionaryRow>('SELECT * FROM my_dictionary WHERE id = ?', [id]);
  return mapDictionaryRow(row);
}

export interface ListWordsParams {
  userName?: string;
  allUsers?: boolean;
  keyword?: string;
  status?: string;
  emptyExample?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listWords({
  userName,
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

  let where = allUsers ? 'WHERE 1=1' : 'WHERE user_name = ?';
  const params: (string | WordStatus)[] = allUsers ? [] : [normalizeUserName(userName)];

  if (keyword?.trim()) {
    where += ' AND name LIKE ? COLLATE NOCASE';
    params.push(`%${keyword.trim()}%`);
  }
  if (status && isWordStatus(status)) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (emptyExample) {
    where +=
      " AND (example = '[]' OR trim(example) = '' OR json_array_length(example) = 0)";
  }

  const countRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM my_dictionary ${where}`,
    params
  );
  const total = countRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  const rows = await queryAll<DictionaryRow>(
    `SELECT * FROM my_dictionary ${where}
     ORDER BY created_date DESC
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
  userName?: string,
  asAdmin = false
): Promise<DictionaryWord | null> {
  const existing = asAdmin
    ? await getWordById(id)
    : await getWordById(id, normalizeUserName(userName));
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

  const owner = normalizeUserName(userName);
  await run(
    `UPDATE my_dictionary
     SET name = ?, type = ?, transcription = ?, meaning = ?, example = ?, status = ?
     WHERE id = ? AND user_name = ?`,
    [name, type, transcription, meaning, example, status, id, owner]
  );

  return getWordById(id, owner);
}

export async function deleteWord(
  id: number,
  userName?: string,
  asAdmin = false
): Promise<boolean> {
  const existing = asAdmin
    ? await getWordById(id)
    : await getWordById(id, normalizeUserName(userName));
  if (!existing) return false;

  if (asAdmin) {
    await run('DELETE FROM my_dictionary WHERE id = ?', [id]);
  } else {
    const owner = normalizeUserName(userName);
    await run('DELETE FROM my_dictionary WHERE id = ? AND user_name = ?', [id, owner]);
  }
  return true;
}

export async function searchWords(
  keyword: string,
  userName?: string
): Promise<DictionaryWord[]> {
  const owner = normalizeUserName(userName);
  const q = `%${keyword.trim()}%`;
  const rows = await queryAll<DictionaryRow>(
    `SELECT * FROM my_dictionary
     WHERE user_name = ? AND name LIKE ? COLLATE NOCASE
     ORDER BY created_date DESC`,
    [owner, q]
  );
  return rows.map((row) => mapDictionaryRow(row)!);
}

export async function getDashboardStats(userName?: string): Promise<DashboardResponse> {
  const owner = userName?.trim() ? userName.trim() : null;
  const userFilter = owner ? 'WHERE user_name = ?' : '';
  const userParams = owner ? [owner] : [];

  const byStatus = await queryAll<{ status: WordStatus; count: number }>(
    `SELECT status, COUNT(*) as count FROM my_dictionary ${userFilter} GROUP BY status`,
    userParams
  );
  const total = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM my_dictionary ${userFilter}`,
    userParams
  );
  const recent = await queryAll<DictionaryRow>(
    `SELECT * FROM my_dictionary ${userFilter} ORDER BY created_date DESC LIMIT 5`,
    userParams
  );
  const studyToday = await queryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT dictionary_id) as count
     FROM study_history
     WHERE date(reviewed_at) = date('now', 'localtime')`
  );
  const dueParams = owner
    ? [owner, STATUS.NEW, STATUS.LEARNING]
    : [STATUS.NEW, STATUS.LEARNING];
  const dueForReview = await queryOne<{ count: number }>(
    owner
      ? `SELECT COUNT(DISTINCT d.id) as count
         FROM my_dictionary d
         WHERE d.user_name = ? AND (${FLASHCARD_DUE_SQL})`
      : `SELECT COUNT(DISTINCT d.id) as count
         FROM my_dictionary d
         WHERE ${FLASHCARD_DUE_SQL}`,
    dueParams
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
    total: total?.count ?? 0,
    byStatus: statusMap,
    studiedToday: studyToday?.count ?? 0,
    dueForReview: dueForReview?.count ?? 0,
    recentWords: recent.map((row) => mapDictionaryRow(row)!),
    me,
    participants,
  };
}

export async function getFlashcardBatch(
  userName: string,
  limit = 10
): Promise<FlashcardWord[]> {
  const owner = normalizeUserName(userName);
  const rows = await queryAll<DictionaryRow>(
    `SELECT * FROM my_dictionary d
     WHERE d.user_name = ? AND (${FLASHCARD_DUE_SQL})
     ORDER BY RANDOM()
     LIMIT ?`,
    [owner, STATUS.NEW, STATUS.LEARNING, limit]
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
  userName,
  result,
}: {
  dictionaryId: number;
  userName: string;
  result: ReviewResult;
}): Promise<DictionaryWord | null> {
  const owner = normalizeUserName(userName);
  await upsertParticipant(owner);

  const word = await getWordById(dictionaryId, owner);
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

  await run(`UPDATE my_dictionary SET status = ? WHERE id = ? AND user_name = ?`, [
    newStatus,
    dictionaryId,
    owner,
  ]);

  if (word.status === STATUS.NEW && newStatus === STATUS.LEARNING) {
    srsLevel = 0;
  }

  await run(
    `INSERT INTO study_history (dictionary_id, user_name, next_review_date, srs_level, result)
     VALUES (?, ?, ?, ?, ?)`,
    [dictionaryId, owner, nextReview, srsLevel, result]
  );

  return getWordById(dictionaryId, owner);
}
