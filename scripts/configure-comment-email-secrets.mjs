// Read secrets from a pipe, never command-line arguments or committed files.
// The temporary env file is deleted even if the official CLI fails.
import { createInterface } from 'node:readline';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep, basename } from 'node:path';
import { spawn } from 'node:child_process';

const input = createInterface({ input: process.stdin, terminal: false });
console.log('Awaiting secret configuration on stdin (values will not be logged).');
for await (const line of input) {
  const secrets = JSON.parse(line);
  const allowed = new Set(['RESEND_API_KEY','COMMENT_NOTIFICATION_TO','COMMENT_NOTIFICATIONS_ENABLED','RESEND_WEBHOOK_SECRET']);
  if (!Object.entries(secrets).every(([key, value]) => allowed.has(key) && typeof value === 'string' && !/[\r\n]/.test(value))) {
    throw Error('Invalid secret configuration');
  }
  const directory = await mkdtemp(join(tmpdir(), 'blog-mail-'));
  try {
    const file = join(directory, 'notification.env');
    await writeFile(file, Object.entries(secrets).map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n'), { mode: 0o600 });
    let diagnostic = '';
    const code = await new Promise((resolve, reject) => {
      const args = ['--yes','supabase','secrets','set','--project-ref','uhcmzlhzrgyjnvqnnpss','--env-file',file];
      const child = process.platform === 'win32'
        ? spawn(process.execPath, [join(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js'), ...args], { stdio: ['ignore','pipe','pipe'], windowsHide: true })
        : spawn('npx', args, { stdio: ['ignore','pipe','pipe'] });
      child.stdout.on('data', data => { diagnostic += data; });
      child.stderr.on('data', data => { diagnostic += data; });
      child.on('error', reject); child.on('close', resolve);
    });
    if (code !== 0) {
      for (const value of Object.values(secrets)) diagnostic = diagnostic.split(value).join('[REDACTED]');
      diagnostic = diagnostic.replace(/re_[a-zA-Z0-9_]+|whsec_[a-zA-Z0-9+/=]+/g, '[REDACTED]');
      console.error(diagnostic.slice(0, 2000));
      throw Error('Supabase Secrets configuration failed');
    }
    console.log(`Configured ${Object.keys(secrets).length} notification secrets successfully.`);
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep) || !basename(directory).startsWith('blog-mail-')) {
      throw Error('Refusing cleanup outside the notification temporary directory');
    }
    await rm(directory, { recursive: true, force: true });
  }
  input.close();
  break;
}
