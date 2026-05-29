import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../lib/csv.js';
import {
  getDb,
  mapGlobalDictionaryRow,
  queryAll,
  queryOne,
  run,
  stringifyExamples,
  type GlobalDictionaryRow,
} from '../db.js';
import type {
  ExampleItem,
  GlobalDictionaryWord,
  GlobalLevelSummary,
  GlobalTypeSummary,
  PaginatedGlobalWords,
} from '../shared/types.js';
//https://github.com/winterdl/oxford-5000-vocabulary-audio-definition/blob/main/data/oxford_3000.json

const BATCH_SIZE = 100;
export const GLOBAL_DICTIONARY_PAGE_SIZE = 20;

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

function normalizeCefrLevel(level: string): string {
  return level.trim().toUpperCase();
}

function cefrSortIndex(level: string): number {
  const idx = CEFR_ORDER.indexOf(normalizeCefrLevel(level) as (typeof CEFR_ORDER)[number]);
  return idx >= 0 ? idx : CEFR_ORDER.length;
}

const CSV_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/oxford_3000.csv'
);

interface OxfordCsvRow {
  word: string;
  type: string;
  cefr: string;
  phonBr: string;
  definition: string;
  example: string;
}

function parseOxfordRows(content: string): OxfordCsvRow[] {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim());
  const wordIdx = header.indexOf('word');
  const typeIdx = header.indexOf('type');
  const cefrIdx = header.indexOf('cefr');
  const phonBrIdx = header.indexOf('phon_br');
  const definitionIdx = header.indexOf('definition');
  const exampleIdx = header.indexOf('example');

  if (wordIdx < 0 || cefrIdx < 0) {
    throw new Error('oxford_3000.csv: thiếu cột word hoặc cefr');
  }

  const parsed: OxfordCsvRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const word = row[wordIdx]?.trim();
    const cefr = row[cefrIdx]?.trim();
    if (!word || !cefr) continue;

    parsed.push({
      word,
      type: typeIdx >= 0 ? row[typeIdx]?.trim() ?? '' : '',
      cefr,
      phonBr: phonBrIdx >= 0 ? row[phonBrIdx]?.trim() ?? '' : '',
      definition: definitionIdx >= 0 ? row[definitionIdx]?.trim() ?? '' : '',
      example: exampleIdx >= 0 ? row[exampleIdx]?.trim() ?? '' : '',
    });
  }
  return parsed;
}

function toExampleJson(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed) return '[]';
  const items: ExampleItem[] = [{ sentence: trimmed, meaning: '' }];
  return stringifyExamples(items);
}

export async function seedGlobalDictionary(force = false): Promise<number> {
  const countRow = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM global_dictionary'
  );
  const existing = countRow?.count ?? 0;
  if (existing > 0 && !force) return 0;
  if (force && existing > 0) {
    await getDb().execute('DELETE FROM global_dictionary');
  }

  let content: string;
  try {
    content = await readFile(CSV_PATH, 'utf8');
  } catch {
    console.warn(
      `[seed] Không tìm thấy ${CSV_PATH}. Bỏ qua seed global_dictionary.`
    );
    return 0;
  }

  const rows = parseOxfordRows(content);
  if (rows.length === 0) return 0;

  const db = getDb();
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const statements = chunk.map((row) => ({
      sql: `INSERT INTO global_dictionary (name, level, type, transcription, meaning, example)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        row.word,
        normalizeCefrLevel(row.cefr),
        row.type,
        row.phonBr,
        row.definition,
        toExampleJson(row.example),
      ] as (string | number | null)[],
    }));
    await db.batch(statements, 'write');
    inserted += chunk.length;
  }

  console.info(`[seed] Đã import ${inserted} mục vào global_dictionary.`);
  return inserted;
}

export async function listLevelSummaries(): Promise<GlobalLevelSummary[]> {
  const rows = await queryAll<{ level: string; count: number }>(
    `SELECT level, COUNT(*) as count FROM global_dictionary GROUP BY level`
  );
  return rows
    .map((row) => ({ level: row.level, count: row.count }))
    .sort((a, b) => cefrSortIndex(a.level) - cefrSortIndex(b.level));
}

export interface ListGlobalWordsParams {
  level: string;
  page?: number;
  pageSize?: number;
  userId?: number;
  excludeNotInFlashcard?: boolean;
  type?: string;
}

export async function listTypesByLevel(level: string): Promise<GlobalTypeSummary[]> {
  const trimmedLevel = level.trim();
  if (!trimmedLevel) return [];

  const rows = await queryAll<{ type: string; count: number }>(
    `SELECT type, COUNT(*) as count
     FROM global_dictionary
     WHERE level = ? COLLATE NOCASE
       AND trim(type) != ''
     GROUP BY type
     ORDER BY type ASC`,
    [trimmedLevel]
  );

  return rows.map((row) => ({ type: row.type, count: row.count }));
}

type GlobalDictionaryQueryRow = GlobalDictionaryRow & { in_flashcard?: number };

export async function recordGlobalFlashcardLink(
  userId: number,
  globalDictionaryId: number,
  myDictionaryId: number
): Promise<void> {
  await run(
    `INSERT INTO global_dictionary_flashcard (user_id, global_dictionary_id, my_dictionary_id)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, global_dictionary_id) DO UPDATE SET
       my_dictionary_id = excluded.my_dictionary_id,
       added_at = datetime('now', 'localtime')`,
    [userId, globalDictionaryId, myDictionaryId]
  );
}

export async function listWordsByLevel({
  level,
  page = 1,
  pageSize = GLOBAL_DICTIONARY_PAGE_SIZE,
  userId,
  excludeNotInFlashcard = false,
  type,
}: ListGlobalWordsParams): Promise<PaginatedGlobalWords> {
  const trimmedLevel = level.trim();
  if (!trimmedLevel) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: GLOBAL_DICTIONARY_PAGE_SIZE,
      totalPages: 1,
    };
  }

  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const offset = (safePage - 1) * safePageSize;
  const filterNotAdded = Boolean(excludeNotInFlashcard && userId != null);

  let where = 'WHERE g.level = ?';
  const filterParams: (string | number)[] = [trimmedLevel];

  if (filterNotAdded) {
    where += ` AND NOT EXISTS (
      SELECT 1 FROM global_dictionary_flashcard f
      WHERE f.global_dictionary_id = g.id AND f.user_id = ?
    )`;
    filterParams.push(userId!);
  }

  const trimmedType = type?.trim();
  if (trimmedType) {
    where += ' AND g.type = ? COLLATE NOCASE';
    filterParams.push(trimmedType);
  }

  const countRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM global_dictionary g ${where}`,
    filterParams
  );
  const total = countRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  const inFlashcardSelect =
    userId != null
      ? `, EXISTS (
          SELECT 1 FROM global_dictionary_flashcard f
          WHERE f.global_dictionary_id = g.id AND f.user_id = ?
        ) AS in_flashcard`
      : '';

  const listParams: (string | number)[] = [];
  if (userId != null) {
    listParams.push(userId);
  }
  listParams.push(...filterParams, safePageSize, offset);

  const rows = await queryAll<GlobalDictionaryQueryRow>(
    `SELECT g.id, g.name, g.level, g.type, g.transcription, g.meaning, g.example, g.created_date
     ${inFlashcardSelect}
     FROM global_dictionary g
     ${where}
     ORDER BY g.name ASC
     LIMIT ? OFFSET ?`,
    listParams
  );

  const items: GlobalDictionaryWord[] = [];
  for (const row of rows) {
    const mapped = mapGlobalDictionaryRow(row);
    if (!mapped) continue;
    items.push({
      ...mapped,
      ...(userId != null ? { inFlashcard: Boolean(row.in_flashcard) } : {}),
    });
  }

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}
