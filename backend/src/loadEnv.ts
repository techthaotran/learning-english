import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envName = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const envFile = path.join(root, `.env.${envName}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config({ path: path.join(root, '.env') });
}
