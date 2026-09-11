const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const wantsMac = args.includes('-mac') || args.includes('--mac');
const wantsWin = args.includes('-win') || args.includes('--win');

const platformFlag = wantsMac && !wantsWin ? '--mac' : '--win';
const label = platformFlag === '--mac' ? 'macOS' : 'Windows';

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[dist] building for ${label} (${platformFlag})`);
run('npm', ['run', 'build']);
run('npx', ['electron-builder', platformFlag]);
