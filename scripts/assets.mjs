#!/usr/bin/env node

/**
 * Asset Import, Format & Compression Pipeline
 *
 * Processes images from source-assets/ into optimised, deployment-ready files
 * in static/img/.  Generates WebP variants alongside compressed originals,
 * tracks every file in a manifest so unchanged assets are never reprocessed.
 *
 * Usage:
 *   npm run assets            # process new / changed source images
 *   npm run assets:check      # verify every source image is up-to-date
 *   npm run assets:clean      # remove generated outputs (keep sources)
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import sharp from "sharp";

// ── Paths ────────────────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_DIR = join(ROOT, "source-assets");
const OUTPUT_DIR = join(ROOT, "static", "img");
const MANIFEST_PATH = join(SOURCE_DIR, "manifest.json");

// ── Supported formats ────────────────────────────────────────────────────────
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".tiff", ".tif", ".bmp", ".svg"]);
const RASTER_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".tiff", ".tif", ".bmp"]);

// ── Compression presets ──────────────────────────────────────────────────────
const WEBP_OPTS = { quality: 80, effort: 6 };
const PNG_OPTS = { compressionLevel: 9, adaptiveFiltering: true };
const JPEG_OPTS = { quality: 82, mozjpeg: true };

// ── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 hex digest of a buffer. */
function hash(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** Recursively collect image files under `dir`. */
async function collectImages(dir) {
  const entries = [];
  if (!existsSync(dir)) return entries;

  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    // parentPath is the canonical property (Node ≥20.12); path is the legacy alias
    const full = join(entry.parentPath ?? entry.path, entry.name);
    entries.push(full);
  }
  return entries;
}

/** Load or initialise the manifest. */
async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return {};
  }
}

/** Persist manifest to disk. */
async function saveManifest(manifest) {
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

/** Ensure a directory exists. */
async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

/** Format bytes in human-readable form. */
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

// ── Core pipeline ────────────────────────────────────────────────────────────

async function processImage(srcPath, manifest) {
  const relPath = relative(SOURCE_DIR, srcPath);
  const srcBuf = await readFile(srcPath);
  const srcHash = hash(srcBuf);

  // Skip if manifest shows the same hash (already processed)
  if (manifest[relPath]?.sourceHash === srcHash) {
    return { relPath, skipped: true };
  }

  const ext = extname(relPath).toLowerCase();
  const outRelDir = dirname(relPath);
  const outDir = join(OUTPUT_DIR, outRelDir);
  await ensureDir(outDir);

  const results = { relPath, skipped: false, outputs: [] };

  // ── SVG: copy as-is (no raster processing) ────────────────────────────
  if (ext === ".svg") {
    const outPath = join(OUTPUT_DIR, relPath);
    await writeFile(outPath, srcBuf);
    results.outputs.push({
      file: relPath,
      format: "svg",
      size: srcBuf.length,
    });
    manifest[relPath] = {
      sourceHash: srcHash,
      processedAt: new Date().toISOString(),
      outputs: results.outputs,
    };
    return results;
  }

  // ── Raster images ─────────────────────────────────────────────────────
  if (!RASTER_EXTS.has(ext)) return results;

  const image = sharp(srcBuf);
  const meta = await image.metadata();

  // 1. Optimised original format
  let optimised;
  let outExt = ext;
  if (ext === ".png") {
    optimised = await image.clone().png(PNG_OPTS).toBuffer();
  } else if (ext === ".jpg" || ext === ".jpeg") {
    optimised = await image.clone().jpeg(JPEG_OPTS).toBuffer();
    outExt = ext; // preserve .jpg vs .jpeg
  } else if (ext === ".gif") {
    // sharp has limited GIF write; keep original
    optimised = srcBuf;
  } else if (ext === ".tiff" || ext === ".tif") {
    optimised = await image.clone().tiff({ compression: "lzw" }).toBuffer();
  } else if (ext === ".bmp") {
    // Convert BMP → PNG for web
    optimised = await image.clone().png(PNG_OPTS).toBuffer();
    outExt = ".png";
  }

  const origOutName = basename(relPath, ext) + outExt;
  const origOutRel = join(outRelDir, origOutName);
  await writeFile(join(OUTPUT_DIR, origOutRel), optimised);
  results.outputs.push({
    file: origOutRel,
    format: outExt.replace(".", ""),
    width: meta.width,
    height: meta.height,
    size: optimised.length,
  });

  // 2. WebP variant
  const webpBuf = await image.clone().webp(WEBP_OPTS).toBuffer();
  const webpName = basename(relPath, ext) + ".webp";
  const webpRel = join(outRelDir, webpName);
  await writeFile(join(OUTPUT_DIR, webpRel), webpBuf);
  results.outputs.push({
    file: webpRel,
    format: "webp",
    width: meta.width,
    height: meta.height,
    size: webpBuf.length,
  });

  // 3. Update manifest
  manifest[relPath] = {
    sourceHash: srcHash,
    processedAt: new Date().toISOString(),
    width: meta.width,
    height: meta.height,
    outputs: results.outputs,
  };

  return results;
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdProcess() {
  const files = await collectImages(SOURCE_DIR);
  if (files.length === 0) {
    console.log("ℹ  No images found in source-assets/. Nothing to process.");
    return;
  }

  const manifest = await loadManifest();
  let processed = 0;
  let skipped = 0;
  let totalSaved = 0;

  for (const f of files) {
    const res = await processImage(f, manifest);
    if (res.skipped) {
      skipped++;
      continue;
    }
    processed++;

    const srcSize = (await stat(f)).size;
    const outSize = res.outputs.reduce((s, o) => s + o.size, 0);
    const saved = srcSize - (res.outputs[0]?.size ?? 0);
    totalSaved += Math.max(0, saved);

    const outSummary = res.outputs
      .map((o) => `${o.format} ${fmtSize(o.size)}`)
      .join(", ");
    console.log(`  ✔ ${res.relPath}  →  ${outSummary}`);
  }

  await saveManifest(manifest);

  console.log("");
  console.log(`Done.  ${processed} processed, ${skipped} unchanged.`);
  if (totalSaved > 0) {
    console.log(`Saved ~${fmtSize(totalSaved)} on optimised originals.`);
  }
}

async function cmdCheck() {
  const files = await collectImages(SOURCE_DIR);
  const manifest = await loadManifest();
  let stale = 0;

  for (const f of files) {
    const relPath = relative(SOURCE_DIR, f);
    const srcBuf = await readFile(f);
    const srcHash = hash(srcBuf);
    if (manifest[relPath]?.sourceHash !== srcHash) {
      console.log(`  ✗ ${relPath}  (needs processing)`);
      stale++;
    }
  }

  if (stale === 0) {
    console.log("All source assets are up-to-date.");
  } else {
    console.log(`\n${stale} asset(s) need processing. Run: npm run assets`);
    process.exitCode = 1;
  }
}

async function cmdClean() {
  const manifest = await loadManifest();
  let removed = 0;

  for (const [_relPath, entry] of Object.entries(manifest)) {
    for (const output of entry.outputs ?? []) {
      const outPath = join(OUTPUT_DIR, output.file);
      if (existsSync(outPath)) {
        await rm(outPath);
        removed++;
      }
    }
  }

  if (existsSync(MANIFEST_PATH)) await rm(MANIFEST_PATH);
  console.log(`Cleaned ${removed} generated file(s) and manifest.`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const cmd = process.argv[2] ?? "process";

switch (cmd) {
  case "process":
    await cmdProcess();
    break;
  case "check":
    await cmdCheck();
    break;
  case "clean":
    await cmdClean();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error("Usage: node scripts/assets.mjs [process|check|clean]");
    process.exitCode = 1;
}
