import { createClient, type Client } from '@libsql/client';
import { STATUS, type WordStatus } from './shared/wordStatus.js';
import type { DictionaryWord, ExampleItem } from './shared/types.js';

export { STATUS };
export const SRS_INTERVALS = [0, 1, 3, 7, 30] as const;

let client: Client | undefined;
let initPromise: Promise<void> | undefined;

export interface DictionaryRow {
  id: number;
  user_id: number;
  username?: string;
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

async function renameDictionaryTableIfNeeded(database: Client): Promise<void> {
  const tables = await database.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('dictionary', 'my_dictionary')`
  );
  const tableNames = tables.rows.map((row) => String(row.name));

  if (tableNames.includes('dictionary') && !tableNames.includes('my_dictionary')) {
    await database.execute('ALTER TABLE dictionary RENAME TO my_dictionary');
  }
}

async function tableHasColumn(
  database: Client,
  table: string,
  column: string
): Promise<boolean> {
  const cols = await database.execute(`PRAGMA table_info(${table})`);
  return cols.rows.some((row) => String(row.name) === column);
}

async function ensureUsersForLegacyNames(database: Client): Promise<void> {
  const usersTable = await database.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`
  );
  if (usersTable.rows.length === 0) return;

  const legacySelects: string[] = [];
  const dictExists = await database.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'my_dictionary'`
  );
  if (
    dictExists.rows.length > 0 &&
    (await tableHasColumn(database, 'my_dictionary', 'user_name'))
  ) {
    legacySelects.push('SELECT user_name FROM my_dictionary');
  }

  const historyExists = await database.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'study_history'`
  );
  if (
    historyExists.rows.length > 0 &&
    (await tableHasColumn(database, 'study_history', 'user_name'))
  ) {
    legacySelects.push('SELECT user_name FROM study_history');
  }

  if (legacySelects.length === 0) return;

  const { hashPassword } = await import('./lib/password.js');
  const distinct = await database.execute(`
    SELECT DISTINCT user_name AS name FROM (
      ${legacySelects.join(' UNION ')}
    )
    WHERE trim(user_name) != ''
  `);

  for (const row of distinct.rows) {
    const name = String(row.name);
    const existing = await database.execute({
      sql: `SELECT id FROM users WHERE username = ? COLLATE NOCASE`,
      args: [name],
    });
    if (existing.rows.length > 0) continue;

    const passwordHash = await hashPassword(`legacy-migrate:${name}`);
    await database.execute({
      sql: `INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)`,
      args: [name, passwordHash],
    });
  }
}

async function migrateMyDictionaryUserNameToUserId(database: Client): Promise<void> {
  const dictExists = await database.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'my_dictionary'`
  );
  if (dictExists.rows.length === 0) return;
  if (!(await tableHasColumn(database, 'my_dictionary', 'user_name'))) return;

  await ensureUsersForLegacyNames(database);

  await database.batch(
    [
      {
        sql: `
          CREATE TABLE my_dictionary_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            transcription TEXT,
            meaning TEXT,
            example TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'Mới' CHECK(status IN ('Mới', 'Đang học', 'Hoàn thành')),
            created_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `,
      },
      {
        sql: `
          INSERT INTO my_dictionary_new (id, user_id, name, type, transcription, meaning, example, status, created_date)
          SELECT d.id, u.id, d.name, d.type, d.transcription, d.meaning, d.example, d.status, d.created_date
          FROM my_dictionary d
          INNER JOIN users u ON u.username = d.user_name COLLATE NOCASE
        `,
      },
      { sql: 'DROP TABLE my_dictionary' },
      { sql: 'ALTER TABLE my_dictionary_new RENAME TO my_dictionary' },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_my_dictionary_user ON my_dictionary(user_id)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_my_dictionary_name ON my_dictionary(name)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_my_dictionary_status ON my_dictionary(status)`,
      },
    ],
    'write'
  );
}

async function migrateStudyHistoryUserNameToUserId(database: Client): Promise<void> {
  const historyExists = await database.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'study_history'`
  );
  if (historyExists.rows.length === 0) return;
  if (!(await tableHasColumn(database, 'study_history', 'user_name'))) return;

  await ensureUsersForLegacyNames(database);

  await database.batch(
    [
      {
        sql: `
          CREATE TABLE study_history_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dictionary_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            reviewed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            next_review_date TEXT NOT NULL,
            srs_level INTEGER NOT NULL DEFAULT 0,
            result TEXT CHECK(result IN ('đang học', 'hoàn thành')),
            FOREIGN KEY (dictionary_id) REFERENCES my_dictionary(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `,
      },
      {
        sql: `
          INSERT INTO study_history_new (id, dictionary_id, user_id, reviewed_at, next_review_date, srs_level, result)
          SELECT sh.id, sh.dictionary_id, u.id, sh.reviewed_at, sh.next_review_date, sh.srs_level, sh.result
          FROM study_history sh
          INNER JOIN users u ON u.username = sh.user_name COLLATE NOCASE
        `,
      },
      { sql: 'DROP TABLE study_history' },
      { sql: 'ALTER TABLE study_history_new RENAME TO study_history' },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_study_history_dict ON study_history(dictionary_id)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_study_history_user ON study_history(user_id)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_study_history_next ON study_history(next_review_date)`,
      },
    ],
    'write'
  );
}

async function migrateUserNameToUserId(database: Client): Promise<void> {
  await migrateMyDictionaryUserNameToUserId(database);
  await migrateStudyHistoryUserNameToUserId(database);
}

async function migrateUsersTable(database: Client): Promise<void> {
  const tables = await database.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`
  );
  if (tables.rows.length === 0) return;

  const columns = await database.execute('PRAGMA table_info(users)');
  const hasIsAdmin = columns.rows.some((row) => String(row.name) === 'is_admin');
  if (!hasIsAdmin) {
    await database.execute(
      `ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`
    );
  }
}

async function initSchema(database: Client): Promise<void> {
  await renameDictionaryTableIfNeeded(database);

  await database.batch(
    [
      {
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
          )
        `,
      },
      {
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)`,
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS my_dictionary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            transcription TEXT,
            meaning TEXT,
            example TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'Mới' CHECK(status IN ('Mới', 'Đang học', 'Hoàn thành')),
            created_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_my_dictionary_user ON my_dictionary(user_id)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_my_dictionary_name ON my_dictionary(name)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_my_dictionary_status ON my_dictionary(status)`,
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS study_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dictionary_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            reviewed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            next_review_date TEXT NOT NULL,
            srs_level INTEGER NOT NULL DEFAULT 0,
            result TEXT CHECK(result IN ('đang học', 'hoàn thành')),
            FOREIGN KEY (dictionary_id) REFERENCES my_dictionary(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_study_history_dict ON study_history(dictionary_id)`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_study_history_user ON study_history(user_id)`,
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

  await migrateUserNameToUserId(database);
  await migrateUsersTable(database);

  const { seedAdminUser } = await import('./services/userService.js');
  await seedAdminUser();

  await database.execute(`
    INSERT OR IGNORE INTO participants (user_name, last_seen_at)
    SELECT u.username, MAX(sh.reviewed_at)
    FROM study_history sh
    INNER JOIN users u ON u.id = sh.user_id
    GROUP BY u.id
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
  const { username, ...rest } = row;
  return {
    ...rest,
    example: parseExamples(row.example),
    ...(username != null ? { username } : {}),
  };
}
