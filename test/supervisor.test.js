import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { supervise } from '../src/supervisor.js';
import { readConfig } from '../src/config.js';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('default configuration works across guilds with no channel restriction', () => {
  assert.equal(readConfig({}).allowedChannels.size, 0);
});

test('crashed bot is restarted, then intentional stop prevents further restarts', async () => {
  const children = [];
  const supervisor = supervise({ delayMs: 10, log: () => {}, spawnChild: () => {
    const child = new EventEmitter(); child.kill = () => { child.emit('exit', null, 'SIGTERM'); return true; };
    children.push(child); return child;
  } });
  children[0].emit('exit', 1);
  await pause(30);
  assert.equal(children.length, 2);
  supervisor.stop(); await supervisor.done; await pause(30);
  assert.equal(children.length, 2);
});

test('stop during backoff cancels the pending restart', async () => {
  let launches = 0;
  const child = new EventEmitter();
  const supervisor = supervise({ delayMs: 10, log: () => {}, spawnChild: () => { launches++; return child; } });
  child.emit('exit', 1); supervisor.stop(); await supervisor.done; await pause(30);
  assert.equal(launches, 1);
});

test('spawn error and exit events schedule only one retry', async () => {
  const children = [];
  const supervisor = supervise({ delayMs: 10, log: () => {}, spawnChild: () => {
    const child = new EventEmitter(); child.kill = () => child.emit('exit', 0);
    children.push(child); return child;
  } });
  children[0].emit('error', new Error('Could not spawn')); children[0].emit('exit', 1);
  await pause(30); assert.equal(children.length, 2);
  supervisor.stop(); await supervisor.done;
});

test('supervisor restarts a real crashing Node process without Discord access', async () => {
  let launches = 0, supervisor;
  supervisor = supervise({ delayMs: 10, spawnChild: () => {
    launches++;
    return spawn(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'ignore', windowsHide: true });
  }, log: message => {
    if (launches === 2 && message.includes('Bot exited')) supervisor.stop();
  } });
  let timeout;
  try {
    await Promise.race([supervisor.done, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Supervisor failed to restart/stop')), 5000);
    })]);
  } finally { clearTimeout(timeout); supervisor.stop(); }
  assert.equal(launches, 2);
});
