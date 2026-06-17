import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
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

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  await page.goto(`${baseUrl}/progress`, { waitUntil: 'networkidle' });
  await expectText(page, 'Your Training Snapshot');
  await expectText(page, 'Speaking');
  await expectText(page, 'Writing');

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

  await browser.close();
  console.log('verify:progress-ui passed');
} finally {
  stopServer();
}
