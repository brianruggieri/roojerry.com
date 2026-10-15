#!/usr/bin/env node
// tests/simulation/project-assets.test.js
// Every image path a project page references must exist under static/.
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'content', 'projects');

// Pre-existing screenshots that predate the webp-sibling convention this test
// enforces. Dog Playground's PNGs were shipped PNG-only before this rule
// existed; regenerating them is out of scope for the teightysix showpiece work
// (image ownership there is static/img/projects/teightysix/** only).
const NO_WEBP_SIBLING_OK = new Set([
	'/img/projects/dog-playground/dog-playground-hero.png',
	'/img/projects/dog-playground/drag-frisbee.png',
	'/img/projects/dog-playground/throw-bone.png',
	'/img/projects/dog-playground/mobile-drag.png',
]);

let failures = 0;
for (const f of readdirSync(dir).filter(n => n.endsWith('.md') && n !== '_index.md')) {
	const text = readFileSync(join(dir, f), 'utf8');
	const paths = [...text.matchAll(/["']?(\/img\/[^"'\s]+\.(?:png|jpg|jpeg|webp|gif))["']?/g)].map(m => m[1]);
	for (const p of new Set(paths)) {
		const disk = join(root, 'static', p);
		if (!existsSync(disk)) { failures++; console.error(`  ✗ ${f}: missing ${p}`); }
		const webp = disk.replace(/\.(png|jpg|jpeg)$/, '.webp');
		if (/\.(png|jpg|jpeg)$/.test(disk) && !existsSync(webp) && !NO_WEBP_SIBLING_OK.has(p)) {
			failures++; console.error(`  ✗ ${f}: no webp beside ${p}`);
		}
	}
}
console.log(failures ? `  ${failures} asset problem(s)` : '  ✓ all project image paths exist with webp siblings');
process.exit(failures ? 1 : 0);
