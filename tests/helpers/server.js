// tests/helpers/server.js
// Hugo dev server lifecycle helpers — used by all test runners.

import { spawn } from 'child_process';
import net from 'net';

export const HUGO = process.env.HUGO_PATH || '/opt/homebrew/bin/hugo';
export const PORT = 1313;
export const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 15000;

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

export function killExisting() {
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-ti', `tcp:${PORT}`]);
    let pids = '';
    lsof.stdout.on('data', d => pids += d);
    lsof.on('close', () => {
      const list = pids.trim().split('\n').filter(Boolean);
      if (list.length === 0) return resolve();
      spawn('kill', list).on('close', () => {
        setTimeout(() => {
          spawn('kill', ['-9', ...list]).on('close', () => setTimeout(resolve, 200));
        }, 1000);
      });
    });
  });
}

/**
 * Start a Hugo dev server. Returns the child process.
 * Rejects if the server doesn't respond within TIMEOUT ms.
 */
export async function startServer() {
  await killExisting();

  console.log('[server] Starting Hugo server...');
  const proc = spawn(HUGO, ['server', '-D', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line) process.stderr.write('[hugo] ' + line + '\n');
  });

  const ready = await waitForServer(PORT, TIMEOUT);
  if (!ready) {
    proc.kill();
    throw new Error(`Hugo server did not start within ${TIMEOUT}ms`);
  }

  console.log(`[server] Ready at ${BASE_URL}`);
  return proc;
}

/**
 * Stop a Hugo server process returned by startServer().
 */
export function stopServer(proc) {
  proc.kill();
}
