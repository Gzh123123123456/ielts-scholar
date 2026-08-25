import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const port = Number(process.env.PROGRESS_UI_PORT || 3010);
const baseUrl = `http://127.0.0.1:${port}`;
const serverCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const serverArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`]
  : ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];

const server = spawn(serverCommand, serverArgs, {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

const stopServer = () => {
  if (server.killed) return;
  if (process.platform === 'win32' && server.pid) {
    spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  server.kill();
};

const waitForServer = async () => {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`${baseUrl}/progress`);
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Vite server did not become ready at ${baseUrl}\n${serverOutput}`);
};

const expectText = async (page, text) => {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 8000 });
};

const selectText = async (page, text) => {
  const selected = await page.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const source = node.textContent || '';
      const index = source.indexOf(needle);
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return true;
    }
    return false;
  }, text);
  if (!selected) throw new Error(`Could not select text: ${text}`);
};

const expectChart = async (page, testId) => {
  await page.getByTestId(testId).locator('svg').first().waitFor({ timeout: 8000 });
};

const expectNoPersistedDemoRecords = async (page) => {
  const found = await page.evaluate(async () => {
    const localValues = [...Array(localStorage.length)].map((_, index) => localStorage.getItem(localStorage.key(index) || '') || '');
    const sessionValues = [...Array(sessionStorage.length)].map((_, index) => sessionStorage.getItem(sessionStorage.key(index) || '') || '');
    if ([...localValues, ...sessionValues].some(value => value.includes('demo-speaking-') || value.includes('demo-writing-'))) return true;

    const databases = await indexedDB.databases();
    const database = databases.find(item => item.name === 'ielts_scholar_local_db');
    if (!database?.name) return false;
    return new Promise((resolveCheck, reject) => {
      const request = indexedDB.open(database.name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const storeNames = [...db.objectStoreNames];
        if (!storeNames.length) {
          db.close();
          resolveCheck(false);
          return;
        }
        const transaction = db.transaction(storeNames, 'readonly');
        const reads = storeNames.map(storeName => new Promise((resolveRead, rejectRead) => {
          const read = transaction.objectStore(storeName).getAll();
          read.onsuccess = () => resolveRead(read.result);
          read.onerror = () => rejectRead(read.error);
        }));
        Promise.all(reads).then(results => {
          db.close();
          resolveCheck(JSON.stringify(results).includes('demo-speaking-') || JSON.stringify(results).includes('demo-writing-'));
        }, reject);
      };
    });
  });
  if (found) throw new Error('Synthetic demo records leaked into browser persistence');
};

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  await page.goto(`${baseUrl}/progress`, { waitUntil: 'networkidle' });
  await expectText(page, 'Your Training Snapshot');
  await expectText(page, 'Speaking');
  await expectText(page, 'Writing');
  await expectText(page, 'At least two analyzed attempts are needed');
  await page.getByRole('button', { name: 'Clear Local Data' }).waitFor({ timeout: 8000 });

  await page.goto(`${baseUrl}/progress/speaking`, { waitUntil: 'networkidle' });
  await expectText(page, 'Speaking Progress');
  await expectText(page, 'Speaking Profile');
  await expectText(page, 'Saved Expressions');

  await selectText(page, 'Speaking Profile');
  await page.locator('[data-selection-save-ui]').waitFor({ timeout: 5000 });
  await page.locator('[data-selection-save-ui]').getByRole('button', { name: 'Save' }).click();
  await page.locator('[data-selection-save-ui] input').fill('speaking profile phrase');
  await page.locator('[data-selection-save-ui]').getByTitle('Save expression').click();
  await page.waitForTimeout(1000);

  const savedExpressions = await page.evaluate(() => {
    const raw = window.localStorage.getItem('ielts_profile');
    return raw ? JSON.parse(raw).savedExpressions || [] : [];
  });
  if (!savedExpressions.some(item =>
    item.expression === 'speaking profile phrase' &&
    String(item.originalSnippet).toLowerCase() === 'speaking profile'
  )) {
    throw new Error(`Saved expression was not persisted as expected: ${JSON.stringify(savedExpressions)}`);
  }

  await page.goto(`${baseUrl}/progress/writing`, { waitUntil: 'networkidle' });
  await expectText(page, 'Writing Progress');
  await expectText(page, 'Recent Writing Training Estimates');
  await expectText(page, 'Writing Task 2 Topic Coverage');

  const imageDir = resolve(process.cwd(), 'docs', 'images');
  mkdirSync(imageDir, { recursive: true });

  await page.goto(`${baseUrl}/progress?demo=1`, { waitUntil: 'networkidle' });
  await expectText(page, 'Demo data');
  await expectChart(page, 'performance-trajectory-chart');
  await expectChart(page, 'criterion-profile-chart');
  await expectChart(page, 'practice-coverage-chart');
  if (await page.getByRole('button', { name: 'Clear Local Data' }).count()) {
    throw new Error('Destructive personal-data controls should not appear in demo mode');
  }
  await page.screenshot({ path: resolve(imageDir, 'progress-overview-demo.png'), fullPage: true });

  await page.goto(`${baseUrl}/progress/speaking?demo=1`, { waitUntil: 'networkidle' });
  await expectText(page, 'Pronunciation is excluded');
  await expectChart(page, 'criterion-profile-chart');
  await expectChart(page, 'practice-coverage-chart');
  await page.screenshot({ path: resolve(imageDir, 'progress-speaking-demo.png'), fullPage: true });

  await page.goto(`${baseUrl}/progress/writing?demo=1`, { waitUntil: 'networkidle' });
  await expectChart(page, 'performance-trajectory-chart');
  await expectChart(page, 'criterion-profile-chart');
  await expectChart(page, 'practice-coverage-chart');
  await expectNoPersistedDemoRecords(page);
  await page.screenshot({ path: resolve(imageDir, 'progress-writing-demo.png'), fullPage: true });

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.goto(`${baseUrl}/progress?demo=1`, { waitUntil: 'networkidle' });
  await expectChart(mobilePage, 'performance-trajectory-chart');
  await expectChart(mobilePage, 'criterion-profile-chart');
  await expectChart(mobilePage, 'practice-coverage-chart');
  const hasHorizontalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (hasHorizontalOverflow) throw new Error('Progress demo has horizontal overflow at a 390px mobile viewport');
  await mobilePage.close();

  await browser.close();
  console.log('verify:progress-ui passed');
} finally {
  stopServer();
}
