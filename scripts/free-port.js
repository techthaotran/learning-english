import { execSync } from 'node:child_process';

const port = process.argv[2];
if (!port) process.exit(0);

try {
  const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
  if (!out) process.exit(0);
  for (const pid of out.split('\n').filter(Boolean)) {
    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
} catch {
  /* nothing listening */
}
