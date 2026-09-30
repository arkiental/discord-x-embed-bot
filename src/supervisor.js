import { spawn } from 'node:child_process';

export function supervise({ spawnChild, delayMs = 5000, log = console.log, onChild = () => {} } = {}) {
  let child, timer, stopping = false, finished = false;
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  const finish = () => { if (!finished) { finished = true; resolveDone(); } };
  const launch = () => {
    if (stopping) { finish(); return; }
    log('Starting bot.');
    let launched;
    try {
      launched = (spawnChild || (() => spawn(process.execPath, ['src/bot.js'], { stdio: 'inherit' })))();
      child = launched; onChild(launched);
    } catch { log('Could not start bot. Retrying.'); schedule(); return; }
    let exited = false;
    const end = (code, signal) => {
      if (exited) return;
      exited = true; child = null;
      if (stopping) { finish(); return; }
      log(`Bot exited (${signal || code || 0}). Restarting in ${delayMs / 1000} seconds.`);
      schedule();
    };
    launched.once('error', () => end('spawn error'));
    launched.once('exit', end);
  };
  const schedule = () => { if (!stopping) timer = setTimeout(launch, delayMs); };
  const stop = () => {
    if (stopping) return;
    stopping = true; clearTimeout(timer);
    log('Stopping bot and restart loop.');
    if (child) child.kill('SIGTERM');
    else finish();
  };
  launch();
  return { stop, done };
}
