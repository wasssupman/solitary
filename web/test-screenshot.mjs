import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', msg => console.log(`  [${msg.type()}] ${msg.text()}`));

  await page.goto('http://localhost:3333/play', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('canvas') !== null, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  // Check canvas pixel count before hint
  const beforePixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!ctx) return { error: 'no webgl context' };
    const w = canvas.width, h = canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
    // Count non-green pixels (the green background is ~53,101,77 = #35654d)
    let nonGreen = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      if (Math.abs(r - 53) > 20 || Math.abs(g - 101) > 20 || Math.abs(b - 77) > 20) {
        nonGreen++;
      }
    }
    return { width: w, height: h, totalPixels: w * h, nonGreenPixels: nonGreen };
  });
  console.log('\nBefore hint - canvas pixels:', JSON.stringify(beforePixels));

  // Click hint
  const btn = await page.$('button[title="Hint (H)"]');
  await btn.click();
  await new Promise(r => setTimeout(r, 1000));

  // Check canvas pixel count after hint
  const afterPixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!ctx) return { error: 'no webgl context' };
    const w = canvas.width, h = canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
    let nonGreen = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      if (Math.abs(r - 53) > 20 || Math.abs(g - 101) > 20 || Math.abs(b - 77) > 20) {
        nonGreen++;
      }
    }
    return { width: w, height: h, totalPixels: w * h, nonGreenPixels: nonGreen };
  });
  console.log('After hint  - canvas pixels:', JSON.stringify(afterPixels));

  // Take screenshot with preserveDrawingBuffer-like approach
  // Force a Phaser render then screenshot
  await page.evaluate(() => {
    // Force WebGL preserveDrawingBuffer by reading pixels (already done above)
  });
  await page.screenshot({ path: '/tmp/solitaire-final.png' });
  console.log('Saved /tmp/solitaire-final.png');

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
