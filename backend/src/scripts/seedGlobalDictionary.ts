import '../loadEnv.js';
import { initDb } from '../db.js';
import { seedGlobalDictionary } from '../services/globalDictionaryService.js';

const force = process.argv.includes('--force');

await initDb();
const inserted = await seedGlobalDictionary(force);
console.log(force ? `Re-seeded ${inserted} rows.` : `Inserted ${inserted} rows (skipped if already seeded).`);
