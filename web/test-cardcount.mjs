/**
 * Test: run simulation and check for CARD COUNT BUG errors.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const cardBugs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('CARD COUNT BUG')) {
      cardBugs.push(text);
      console.log('  ' + text);
    }
  });

  await page.goto('http://localhost:3333/simulate', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('canvas') !== null, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  // Click Play
  console.log('Starting simulation...');
  await page.click('button');

  // Let it run for 15 seconds
  for (let i = 1; i <= 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const stats = await page.evaluate(() => {
      const spans = document.querySelectorAll('span');
      return Array.from(spans).map(s => s.textContent);
    });
    console.log(`${i}s: ${stats.join(' | ')}`);
  }

  // Stop
  const btnText = await page.$eval('button', el => el.textContent);
  if (btnText === 'Stop') await page.click('button');

  console.log(`\n${'='.repeat(40)}`);
  if (cardBugs.length > 0) {
    console.log(`FAILED: ${cardBugs.length} card count error(s)`);
    process.exit(1);
  } else {
    console.log('PASSED: All card counts correct (52)');
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
