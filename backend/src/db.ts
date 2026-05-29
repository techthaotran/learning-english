import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STATUS, type WordStatus } from './shared/wordStatus.js';
import type { DictionaryWord, ExampleItem } from './shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'learning.db');
const DB_PATH = process.env.DB_PATH?.trim() || DEFAULT_DB_PATH;

export { STATUS };
export const SRS_INTERVALS = [0, 1, 3, 7, 30] as const;

let db: DatabaseSync | undefined;

export interface DictionaryRow {
  id: number;
  name: string;
  type: string;
  transcription: string;
  meaning: string;
  example: string;
  status: WordStatus;
  created_date: string;
}

export function getDb(): DatabaseSync {
  if (!db) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new DatabaseSync(DB_PATH);
    initSchema(db);
  }
  return db;
}

function initSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      transcription TEXT,
      meaning TEXT,
      example TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'Mới' CHECK(status IN ('Mới', 'Đang học', 'Hoàn thành')),
      created_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_dictionary_name ON dictionary(name);
    CREATE INDEX IF NOT EXISTS idx_dictionary_status ON dictionary(status);

    CREATE TABLE IF NOT EXISTS study_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dictionary_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      next_review_date TEXT NOT NULL,
      srs_level INTEGER NOT NULL DEFAULT 0,
      result TEXT CHECK(result IN ('đang học', 'hoàn thành')),
      FOREIGN KEY (dictionary_id) REFERENCES dictionary(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_study_history_dict ON study_history(dictionary_id);
    CREATE INDEX IF NOT EXISTS idx_study_history_user ON study_history(user_name);
    CREATE INDEX IF NOT EXISTS idx_study_history_next ON study_history(next_review_date);

    CREATE TABLE IF NOT EXISTS participants (
      user_name TEXT PRIMARY KEY,
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  database.exec(`
    INSERT OR IGNORE INTO participants (user_name, last_seen_at)
    SELECT user_name, MAX(reviewed_at)
    FROM study_history
    GROUP BY user_name
  `);
}

export function parseExamples(exampleJson: string | null | undefined): ExampleItem[] {
  try {
    const parsed: unknown = JSON.parse(exampleJson || '[]');
    return Array.isArray(parsed) ? (parsed as ExampleItem[]) : [];
  } catch {
    return [];
  }
}

export function stringifyExamples(examples: ExampleItem[]): string {
  return JSON.stringify(examples);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function mapDictionaryRow(row: DictionaryRow | undefined): DictionaryWord | null {
  if (!row) return null;
  return {
    ...row,
    example: parseExamples(row.example),
  };
}
