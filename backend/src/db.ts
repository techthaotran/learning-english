import { createClient, type Client } from '@libsql/client';
import { STATUS, type WordStatus } from './shared/wordStatus.js';
import type { DictionaryWord, ExampleItem } from './shared/types.js';

export { STATUS };
export const SRS_INTERVALS = [0, 1, 3, 7, 30] as const;

let client: Client | undefined;
let initPromise: Promise<void> | undefined;

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

function resolveTursoConfig(): { url: string; authToken: string } {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url) {
    throw new Error('Thiếu TURSO_DATABASE_URL. Xem backend/.env.development hoặc .env.example.');
  }
  if (!authToken) {
    throw new Error('Thiếu TURSO_AUTH_TOKEN. Chạy: turso db tokens create learning-english');
  }
  if (url.includes('your-org') || url.includes('your-database')) {
    throw new Error(
      'TURSO_DATABASE_URL đang là placeholder. Lấy URL thật: turso db show <tên-db> --url (hoặc Turso Dashboard → database → Connect).'
    );
  }
  if (!url.startsWith('libsql://') && !url.startsWith('https://')) {
    throw new Error('TURSO_DATABASE_URL phải bắt đầu bằng libsql:// hoặc https://');
  }

  return { url, authToken };
}

function mapRow<T>(row: Record<string, unknown>): T {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[key] = typeof value === 'bigint' ? Number(value) : value;
  }
  return mapped as T;
}

export function getDb(): Client {
  if (!client) {
    throw new Error('Database chưa khởi tạo. Gọi initDb() trước.');
  }
  return client;
}

export async function initDb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    client = createClient(resolveTursoConfig());
    await initSchema(client);
  })();

  return initPromise;
}

async function initSchema(database: Client): Promise<void> {
  await database.batch(
    [
      {
        sql: `
          CREATE TABLE IF NOT EXISTS dictionary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT,
            transcription TEXT,
            meaning TEXT,
            example TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'Mới' CHECK(status IN ('Mới', 'Đang học', 'Hoàn thành')),
            created_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
          )
        `,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_dictionary_name ON dictionary(name)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_dictionary_status ON dictionary(status)`,
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS study_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dictionary_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            reviewed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            next_review_date TEXT NOT NULL,
            srs_level INTEGER NOT NULL DEFAULT 0,
            result TEXT CHECK(result IN ('đang học', 'hoàn thành')),
            FOREIGN KEY (dictionary_id) REFERENCES dictionary(id) ON DELETE CASCADE
          )
        `,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_study_history_dict ON study_history(dictionary_id)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_study_history_user ON study_history(user_name)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_study_history_next ON study_history(next_review_date)`,
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS participants (
            user_name TEXT PRIMARY KEY,
            last_seen_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
          )
        `,
      },
    ],
    'write'
  );

  await database.execute(`
    INSERT OR IGNORE INTO participants (user_name, last_seen_at)
    SELECT user_name, MAX(reviewed_at)
    FROM study_history
    GROUP BY user_name
  `);
}

export async function queryAll<T>(
  sql: string,
  args: (string | number | null)[] = []
): Promise<T[]> {
  const result = await getDb().execute({ sql, args });
  return result.rows.map((row) => mapRow<T>(row as Record<string, unknown>));
}

export async function queryOne<T>(
  sql: string,
  args: (string | number | null)[] = []
): Promise<T | undefined> {
  const rows = await queryAll<T>(sql, args);
  return rows[0];
}

export async function run(
  sql: string,
  args: (string | number | null)[] = []
): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
  const result = await getDb().execute({ sql, args });
  return {
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
    rowsAffected: result.rowsAffected,
  };
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
