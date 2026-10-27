/**
 * Starts the API server and the React dev server together.
 * Usage: npm run dev   (press Ctrl+C to stop both)
 */
const { spawn } = require('child_process');

const procs = [
  { name: 'api', color: '\x1b[34m', cmd: 'npm run dev -w server' },
  { name: 'web', color: '\x1b[32m', cmd: 'npm run dev -w client' },
].map(({ name, color, cmd }) => {
  const child = spawn(cmd, { shell: true, stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  const prefix = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on('data', (buf) => {
    buf.toString().split(/\r?\n/).filter(Boolean).forEach((line) => out.write(`${prefix}${line}\n`));
  });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix}stopped (code ${code})`);
    shutdown();
  });
  return child;
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  procs.forEach((p) => { if (!p.killed) p.kill(); });
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
