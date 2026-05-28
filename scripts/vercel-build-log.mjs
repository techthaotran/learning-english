import { spawnSync } from 'node:child_process';

function logStep(message) {
  const time = new Date().toISOString();
  console.log(`[vercel-build][${time}] ${message}`);
}

function run(command, args) {
  const printable = [command, ...args].join(' ');
  logStep(`START ${printable}`);

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    logStep(`ERROR ${printable}: ${result.error.message}`);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    logStep(`FAIL ${printable} (exit=${result.status})`);
    process.exit(result.status);
  }

  logStep(`DONE ${printable}`);
}

logStep('Build script started');
logStep(`Node=${process.version}`);
logStep(`Vercel env=${process.env.VERCEL_ENV ?? 'unknown'}`);
logStep(`Git commit=${process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown'}`);

run('pnpm', ['-C', 'backend', 'build']);

logStep('Build script finished successfully');
