#!/usr/bin/env node
/**
 * test-runner.js
 *
 * Starts a fresh Hugo dev server, runs the test suite, then tears it down.
 * Ensures tests always run against current source files.
 */

import { spawn, execFileSync } from 'child_process';
import net from 'net';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HUGO    = process.env.HUGO_PATH || '/opt/homebrew/bin/hugo';
const PORT    = 1313;
const TIMEOUT = 15000;
const __dirname = dirname(fileURLToPath(import.meta.url));

function probe(port) {
  return new Promise((resolve) => {
    const conn = new net.Socket();
    conn.setTimeout(300);
    conn.once('connect', () => { conn.destroy(); resolve(true); });
    conn.once('error',   () => resolve(false));
    conn.once('timeout', () => resolve(false));
    conn.connect(port, '127.0.0.1');
  });
}

async function waitForServer(port, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await probe(port)) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

function killExisting() {
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-ti', `tcp:${PORT}`]);
    let pids = '';
    lsof.stdout.on('data', d => pids += d);
    lsof.on('close', () => {
      const list = pids.trim().split('\n').filter(Boolean);
      if (list.length === 0) return resolve();
      // Graceful shutdown first, then force-kill if still running after 1s
      spawn('kill', list).on('close', () => {
        setTimeout(() => {
          spawn('kill', ['-9', ...list]).on('close', () => setTimeout(resolve, 200));
        }, 1000);
      });
    });
  });
}

async function main() {
  await killExisting();

  console.log('[test-runner] Starting Hugo server...');
  const server = spawn(HUGO, ['server', '-D', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line) process.stderr.write('[hugo] ' + line + '\n');
  });

  const ready = await waitForServer(PORT, TIMEOUT);
  if (!ready) {
    console.error('[test-runner] Hugo server did not start within', TIMEOUT, 'ms');
    server.kill();
    process.exit(1);
  }
  console.log('[test-runner] Server ready at http://localhost:' + PORT);

  const testFile = join(__dirname, 'test-achievements.js');
  let exitCode = 0;
  try {
    execFileSync(process.execPath, [testFile], { stdio: 'inherit' });
  } catch (e) {
    exitCode = e.status || 1;
  }

  server.kill();
  process.exit(exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
