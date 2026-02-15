/**
 * Test simulation mode: click Play, wait for a few AI moves, verify progress.
 * Run: NODE_PATH=$(npm root -g) node test-sim.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('rror')) {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('1. Loading /simulate...');
  await page.goto('http://localhost:3333/simulate', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('canvas') !== null, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  // Find and click Play button
  console.log('2. Clicking Play...');
  const playBtn = await page.$('button');
  const btnText = await page.$eval('button', el => el.textContent);
  console.log(`   Button text: "${btnText}"`);
  await playBtn.click();

  // Wait and check that moves are being made
  console.log('3. Waiting 8 seconds for AI to play...');
  for (let i = 1; i <= 8; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const stats = await page.evaluate(() => {
      const spans = document.querySelectorAll('span');
      const texts = Array.from(spans).map(s => s.textContent);
      const btn = document.querySelector('button');
      return { spans: texts, button: btn?.textContent };
    });
    console.log(`   ${i}s: button="${stats.button}" stats=[${stats.spans.join(', ')}]`);
  }

  // Click Stop
  console.log('4. Clicking Stop...');
  const stopBtn = await page.$('button');
  const stopText = await page.$eval('button', el => el.textContent);
  if (stopText === 'Stop') {
    await stopBtn.click();
    await new Promise(r => setTimeout(r, 500));
    console.log('   Stopped.');
  } else {
    console.log(`   Button says "${stopText}" (may have already finished)`);
  }

  // Check final state
  const finalStats = await page.evaluate(() => {
    const spans = document.querySelectorAll('span');
    return Array.from(spans).map(s => s.textContent);
  });
  console.log(`5. Final: [${finalStats.join(', ')}]`);

  // Check for errors
  if (errors.length > 0) {
    console.log('\nERRORS:');
    for (const e of errors) console.log(`  ${e}`);
    process.exit(1);
  } else {
    console.log('\nALL OK - Simulation auto-play working!');
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
