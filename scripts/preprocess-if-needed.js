import { spawnSync } from 'node:child_process';

if (process.env.SKIP_PREPROCESS === '1') {
  console.log('SKIP_PREPROCESS=1 set, skipping preprocessing.');
  process.exit(0);
}

const result = spawnSync('node', ['scripts/preprocess-data.js'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
