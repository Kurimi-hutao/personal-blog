const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const profiles = process.argv[2] ? [process.argv[2]] : ['desktop', 'mobile'];
if (profiles.some(profile => !['desktop', 'mobile'].includes(profile))) throw new Error('Use desktop or mobile');
const cli = require.resolve('@lhci/cli/src/cli.js');
let failed = false;
for (const profile of profiles) {
  fs.rmSync(path.join('.lighthouseci-reports', profile), { recursive: true, force: true });
  const env = { ...process.env, LHCI_PROFILE: profile };
  // Explicit commands avoid autorun fallbacks or any public temporary storage.
  for (const command of ['collect', 'assert', 'upload']) {
    const args = [cli, command, '--config=lighthouserc.cjs'];
    if (command === 'upload') args.push('--target=filesystem', `--outputDir=.lighthouseci-reports/${profile}`);
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    if (result.status !== 0) {
      failed = true;
      if (command === 'collect') process.exit(1);
    }
  }
  if (fs.existsSync('.lighthouseci')) {
    fs.cpSync('.lighthouseci', path.join('.lighthouseci-reports', profile, 'raw'), { recursive: true });
  }
  const summary = spawnSync(process.execPath, ['scripts/summarize-lighthouse.cjs', profile], { env, stdio: 'inherit' });
  if (summary.status !== 0) failed = true;
}
if (!failed && profiles.length === 2) {
  const summary = spawnSync(process.execPath, ['scripts/summarize-lighthouse.cjs'], { stdio: 'inherit' });
  if (summary.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
