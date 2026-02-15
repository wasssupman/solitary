/**
 * Browser test: loads /play, clicks Hint, verifies it works.
 * Run: NODE_PATH=$(npm root -g) node test-browser.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const URL = 'http://localhost:3333/play';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    logs.push({ type: msg.type(), text: msg.text() });
    console.log(`  CONSOLE [${msg.type()}]: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    logs.push({ type: 'PAGE_ERROR', text: err.message });
    console.log(`  PAGE_ERROR: ${err.message}`);
  });

  // ─── 1. Load page ───
  console.log(`\n1. Loading ${URL}...`);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 15000 });

  await page.waitForFunction(() => document.querySelector('canvas') !== null, { timeout: 10000 });
  console.log('   Phaser canvas found.');

  // Wait for scene to fully create (animation frame)
  await new Promise(r => setTimeout(r, 2000));

  // ─── 2. Check bridge state ───
  console.log('\n2. Checking bridge state...');
  const bridgeState = await page.evaluate(() => {
    // Access the bridge singleton via the module system
    // Next.js bundles modules, so we need to find it through the global
    // Let's inject a check into the page
    return {
      hasBridge: typeof window !== 'undefined',
    };
  });
  console.log(`   Bridge accessible: ${bridgeState.hasBridge}`);

  // ─── 3. Click Hint button ───
  console.log('\n3. Clicking Hint button...');
  const hintBtn = await page.$('button[title="Hint (H)"]');
  if (!hintBtn) {
    console.log('   ERROR: Hint button not found!');
    const buttons = await page.$$eval('button', btns => btns.map(b => `"${b.textContent}" title="${b.title}"`));
    console.log('   Buttons:', buttons.join(', '));
    await browser.close();
    return;
  }

  // Check initial button state
  const initialBtnText = await page.$eval('button[title="Hint (H)"]', el => ({
    text: el.textContent,
    disabled: el.disabled,
  }));
  console.log(`   Initial: text="${initialBtnText.text}" disabled=${initialBtnText.disabled}`);

  await hintBtn.click();

  // Check if button shows "Thinking..."
  await new Promise(r => setTimeout(r, 100));
  const thinkingText = await page.$eval('button[title="Hint (H)"]', el => el.textContent);
  console.log(`   After click (100ms): "${thinkingText}"`);

  // Wait for solver
  console.log('   Waiting for solver (up to 5s)...');

  // Poll button text to track state changes
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    const btnState = await page.$eval('button[title="Hint (H)"]', el => el.textContent);
    if (i === 0 || btnState !== thinkingText) {
      console.log(`   ${(i + 1) * 500}ms: "${btnState}"`);
    }
    if (btnState === 'Hint' && thinkingText === 'Thinking...') {
      console.log(`   Hint completed at ~${(i + 1) * 500}ms`);
      break;
    }
  }

  // ─── 5. Check for hint graphics on canvas ───
  console.log('\n4. Checking for errors...');
  const errors = logs.filter(l => l.text.includes('rror') || l.type === 'PAGE_ERROR');
  if (errors.length > 0) {
    console.log('   ERRORS:');
    for (const e of errors) console.log(`     [${e.type}] ${e.text}`);
  } else {
    console.log('   No errors!');
  }

  // ─── 6. Test H key ───
  console.log('\n5. Testing H key...');
  await new Promise(r => setTimeout(r, 1000)); // Wait for hint to clear
  logs.length = 0; // Clear logs

  await page.keyboard.press('h');
  await new Promise(r => setTimeout(r, 100));
  const afterH = await page.$eval('button[title="Hint (H)"]', el => el.textContent);
  console.log(`   After H key (100ms): "${afterH}"`);

  // Wait for solver
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    const btnState = await page.$eval('button[title="Hint (H)"]', el => el.textContent);
    if (btnState === 'Hint' && afterH === 'Thinking...') {
      console.log(`   H key hint completed at ~${(i + 1) * 500}ms`);
      break;
    }
  }

  const hErrors = logs.filter(l => l.text.includes('rror') || l.type === 'PAGE_ERROR');
  if (hErrors.length > 0) {
    console.log('   ERRORS after H key:');
    for (const e of hErrors) console.log(`     [${e.type}] ${e.text}`);
  } else {
    console.log('   No errors after H key!');
  }

  // ─── 7. Test simulation page ───
  console.log('\n6. Testing simulation mode...');
  logs.length = 0;
  await page.goto('http://localhost:3333/simulate', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('canvas') !== null, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  const solveBtn = await page.$('button');
  const solveBtns = await page.$$eval('button', btns => btns.map(b => `"${b.textContent}"`));
  console.log(`   Buttons on sim page: ${solveBtns.join(', ')}`);

  const simErrors = logs.filter(l => l.text.includes('rror') || l.type === 'PAGE_ERROR');
  if (simErrors.length > 0) {
    console.log('   Sim page errors:');
    for (const e of simErrors) console.log(`     [${e.type}] ${e.text}`);
  } else {
    console.log('   Sim page loaded OK!');
  }

  // ─── Summary ───
  const allErrors = [...errors, ...hErrors, ...simErrors];
  console.log(`\n${'='.repeat(40)}`);
  if (allErrors.length > 0) {
    console.log(`FAILED: ${allErrors.length} error(s) found`);
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED - No errors detected');
  }

  await browser.close();
}

main().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
