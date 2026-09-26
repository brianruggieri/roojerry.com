#!/usr/bin/env node
// Captures the empty press and the same bench with a sample photo loaded, same viewport.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
const out = 'static/img/projects/teightysix';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
await page.goto('https://cards.roojerry.com/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: `${out}/press-empty.png` });
// Load a sample photograph. Find the control by reading the DOM first:
// document.querySelectorAll('button, [role=button]') and pick the sample chooser.
const sample = await page.$('button.usesample');
if (!sample) throw new Error('sample control not found; inspect the DOM and update the selector');
await sample.click();
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: `${out}/press-loaded.png` });
await browser.close();
