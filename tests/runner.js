#!/usr/bin/env node
// tests/runner.js
// Starts Hugo, runs all e2e + simulation tests, tears down.

import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import { startServer, stopServer } from './helpers/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function discoverTests(...dirs) {
  return dirs.flatMap(dir => {
    const abs = join(__dirname, dir);
    try {
      return readdirSync(abs)
        .filter(f => f.endsWith('.test.js'))
        .map(f => join(abs, f));
    } catch {
      return [];
    }
  });
}

async function main() {
  const server = await startServer();

  const tests = discoverTests('e2e', 'simulation');
  console.log(`\n[runner] Found ${tests.length} test file(s)\n`);

  let exitCode = 0;
  for (const testFile of tests) {
    console.log(`[runner] Running: ${testFile}`);
    try {
      execFileSync(process.execPath, [testFile], { stdio: 'inherit' });
    } catch (e) {
      exitCode = e.status || 1;
    }
  }

  stopServer(server);
  process.exit(exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
