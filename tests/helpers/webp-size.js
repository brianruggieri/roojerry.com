// tests/helpers/webp-size.js
// Reads a .webp file's pixel size straight out of its header, so a test can
// check that an <img>'s width/height attributes still match the bytes on disk.
// Covers the three chunk layouts cwebp emits: lossy, lossless and extended.

import { readFileSync } from 'fs';

export function webpSize(path) {
	const b = readFileSync(path);
	if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') {
		throw new Error(`${path} is not a WebP file`);
	}
	const chunk = b.toString('ascii', 12, 16);

	if (chunk === 'VP8 ') {
		// Key-frame start code, then 14-bit width and height.
		if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) throw new Error(`${path}: bad VP8 start code`);
		return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
	}
	if (chunk === 'VP8L') {
		if (b[20] !== 0x2f) throw new Error(`${path}: bad VP8L signature`);
		const bits = b.readUInt32LE(21);
		return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
	}
	if (chunk === 'VP8X') {
		const u24 = o => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
		return { width: u24(24) + 1, height: u24(27) + 1 };
	}
	throw new Error(`${path}: unknown WebP chunk ${chunk}`);
}
