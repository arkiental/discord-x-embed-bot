import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, unlinkSync, writeFileSync, appendFileSync, statSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { supervise } from '../src/supervisor.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = join(root, 'runtime');
const logs = join(root, 'logs');
mkdirSync(runtime, { recursive: true }); mkdirSync(logs, { recursive: true });
const stopFile = join(runtime, 'stop');
if (existsSync(stopFile)) unlinkSync(stopFile);
const stateFile = join(runtime, 'supervisor.json');
const logFile = join(logs, 'bot.log');
const previous = join(logs, 'bot.previous.log');
const background = process.argv.includes('--background');
const write = chunk => {
  if (existsSync(logFile) && statSync(logFile).size > 5 * 1024 * 1024) {
    if (existsSync(previous)) unlinkSync(previous);
    renameSync(logFile, previous);
  }
  appendFileSync(logFile, chunk);
  if (!background) process.stdout.write(chunk);
};
const log = message => write(`[${new Date().toISOString()}] ${message}\n`);
const supervisor = supervise({
  log,
  spawnChild: () => spawn(process.execPath, [join(root, 'src', 'bot.js')], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  }),
  onChild: child => {
    writeFileSync(stateFile, JSON.stringify({ supervisorPid: process.pid, childPid: child.pid }));
    child.stdout.on('data', write); child.stderr.on('data', write);
  }
});
const stop = () => supervisor.stop();
process.once('SIGINT', stop); process.once('SIGTERM', stop);
const poll = setInterval(() => { if (existsSync(stopFile)) stop(); }, 250);
await supervisor.done;
clearInterval(poll);
if (existsSync(stateFile)) unlinkSync(stateFile);
if (existsSync(stopFile)) unlinkSync(stopFile);
