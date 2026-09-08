/**
 * 建置產物的煙霧測試
 *
 * 用 tests/mw-stub.js 提供最小的 MediaWiki 環境，在 Chromium 中載入
 * dist/ 裡的建置產物並操作，驗證提示、設定、字型套用等真正可用。
 * 先執行 `pnpm run build`，再執行 `pnpm test`。
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.join(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const STORAGE_KEY = 'unihan-settings';

let server;
let baseUrl;
let browser;

before(async () => {
  for (const file of ['dist/Gadget-unihan-helper.js', 'dist/Gadget-unihan-helper.css']) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `缺少 ${file}，請先執行 pnpm run build`);
  }
  server = http.createServer((req, res) => {
    const rel = req.url.split('?')[0];
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader('content-type', MIME[path.extname(file)] ?? 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

/** 提示的顯示與隱藏都經定時器與動畫，等待實際 DOM 狀態而非固定時長 */
const waitShown = (tip) => tip.waitFor({ state: 'visible' });
const waitGone = (tip) => tip.waitFor({ state: 'detached' });

/** 等待設定樁的 openDialog 被呼叫到指定次數 */
const waitDialogCalls = (page, count) =>
  page.waitForFunction((n) => window.__openDialogCalls.length === n, count);

/**
 * 斷言「不會出現」：hover 延遲為 200ms，等其數倍後仍不存在即可視為不會出現。
 * 解除綁定後元素上已無事件處理器，這裡只是給足餘裕。
 */
const assertNeverShown = async (tip) => {
  await tip.waitFor({ state: 'attached', timeout: 800 }).then(
    () => assert.fail('不應顯示 tooltip'),
    () => {}
  );
};

/**
 * 開啟測試頁；storage 為預先寫入 localStorage 的設定 JSON
 */
async function openPage(storage) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // 分片樣式表不真的去 Toolforge 取
  await page.route('https://tools-static.wmflabs.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  await page.goto(`${baseUrl}/tests/harness.html`, { waitUntil: 'commit' });
  await page.evaluate(
    ([key, value]) => {
      localStorage.clear();
      if (value) localStorage.setItem(key, value);
    },
    [STORAGE_KEY, storage ?? null]
  );
  // reload() 等到 load 事件；小工具在同步腳本裡初始化，此時已完成
  await page.reload();
  return { page, errors };
}

const fontFamilyOf = (page, selector) =>
  page.evaluate((sel) => document.querySelector(sel).style.fontFamily.replace(/"/g, ''), selector);

test('提示：懸停顯示、Esc 關閉、動態內容也會綁定', async () => {
  const { page, errors } = await openPage(null);
  const tip = page.locator('[role=tooltip]');

  assert.equal(await page.locator('.inline-unihan[title]').count(), 0, 'title 應被移除');

  await page.hover('#firstHeading .inline-unihan');
  await waitShown(tip);
  assert.match(await tip.locator('.unihan-tooltip-text').textContent(), /title-char/);
  assert.equal(
    await page.locator('.unihan-settings-button').getAttribute('aria-label'),
    '設定',
    '設定按鈕標籤應依使用者語言為繁體'
  );

  await page.keyboard.press('Escape');
  await waitGone(tip);

  // 替換正文並觸發 wikipage.content
  await page.evaluate(() => {
    const content = document.getElementById('mw-content-text');
    content.innerHTML =
      '<p>新正文 <span class="inline-unihan" title="U+2A700 (dynamic-char)">𪜀</span></p>';
    window.mw.hook('wikipage.content').fire([content]);
  });
  await page.hover('#mw-content-text .inline-unihan');
  await waitShown(tip);
  assert.match(await tip.locator('.unihan-tooltip-text').textContent(), /dynamic-char/);

  await page.setViewportSize({ width: 500, height: 600 });
  await waitShown(tip);
  assert.equal(await tip.count(), 1, '視窗縮放後 tooltip 應仍在');

  assert.deepEqual(errors, []);
  await page.close();
});

test('設定：儲存後即時生效，停用時提供選單入口', async () => {
  const { page, errors } = await openPage(null);
  const tip = page.locator('[role=tooltip]');

  await page.hover('#firstHeading .inline-unihan');
  await waitShown(tip);
  await page.click('.unihan-settings-button');
  await waitDialogCalls(page, 1);
  const calls = await page.evaluate(() => window.__openDialogCalls);
  assert.equal(calls[0].fonts.length, 4, '應傳入四款字型');
  assert.deepEqual(calls[0].settings, {
    enabled: true,
    useWebfont: false,
    loadMode: 'always',
    selectedFont: 'Plangothic',
  });

  // 停用；onSave 內的解除綁定是同步的
  await page.evaluate(() =>
    window.__onSave({
      enabled: false,
      useWebfont: false,
      loadMode: 'always',
      selectedFont: 'Plangothic',
    })
  );
  assert.equal(await tip.count(), 0, '停用後 tooltip 應移除');
  assert.equal(await page.locator('.inline-unihan[title]').count(), 2, '停用後 title 應還原');
  const portlet = page.locator('#unihan-settings-portlet a');
  assert.equal(await portlet.count(), 1, '停用後應出現選單入口');
  assert.equal(await portlet.textContent(), '僻字輔助工具設定');
  await page.hover('#firstHeading .inline-unihan');
  await assertNeverShown(tip);

  // 經選單入口重新啟用並開啟網路字型
  await portlet.click();
  await waitDialogCalls(page, 2);
  await page.evaluate(() =>
    window.__onSave({
      enabled: true,
      useWebfont: true,
      loadMode: 'always',
      selectedFont: 'JigmoTC',
    })
  );
  assert.equal(await page.locator('#unihan-settings-portlet').count(), 0, '啟用後入口應移除');
  assert.equal(await page.locator('.inline-unihan[title]').count(), 0, '啟用後 title 應再次移除');

  const sheets = await page.evaluate(() =>
    [...document.querySelectorAll('link[id^=unihan-webfont-]')].map((l) => l.id).sort()
  );
  assert.deepEqual(sheets, [
    'unihan-webfont-JigmoTC',
    'unihan-webfont-Plangothic',
    'unihan-webfont-SourceHanSans',
    'unihan-webfont-WenJinMincho',
  ]);
  const family = await fontFamilyOf(page, '#mw-content-text .inline-unihan');
  assert.ok(family.startsWith('Jigmo TC, '), `always 模式網路字型應排最前：${family}`);

  await page.hover('#firstHeading .inline-unihan');
  await waitShown(tip);

  const stored = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY));
  assert.equal(stored.selectedFont, 'JigmoTC', '設定應寫入 localStorage');

  assert.deepEqual(errors, []);
  await page.close();
});

test('設定：localStorage 裡的非法值回退預設', async () => {
  const { page, errors } = await openPage(
    JSON.stringify({
      enabled: true,
      useWebfont: true,
      loadMode: 'weird',
      selectedFont: 'NoSuchFont',
    })
  );
  const family = await fontFamilyOf(page, '#mw-content-text .inline-unihan');
  assert.ok(family.startsWith('Plangothic, '), `應回退預設字型與 always 模式：${family}`);

  await page.hover('#firstHeading .inline-unihan');
  await waitShown(page.locator('[role=tooltip]'));
  await page.click('.unihan-settings-button');
  await waitDialogCalls(page, 1);
  const settings = await page.evaluate(() => window.__openDialogCalls[0].settings);
  assert.deepEqual(settings, {
    enabled: true,
    useWebfont: true,
    loadMode: 'always',
    selectedFont: 'Plangothic',
  });

  assert.deepEqual(errors, []);
  await page.close();
});

test('字型：fallback 模式把網路字型排在原字型堆疊之後', async () => {
  const { page, errors } = await openPage(
    JSON.stringify({
      enabled: true,
      useWebfont: true,
      loadMode: 'fallback',
      selectedFont: 'WenJinMincho',
    })
  );
  const family = await fontFamilyOf(page, '#mw-content-text .inline-unihan');
  assert.ok(family.startsWith('sans-serif, FZSongS-Extended, WenJinMincho'), family);

  // 沒有原字型堆疊的元素：網路字型後接 serif
  const bare = await fontFamilyOf(page, '#firstHeading .inline-unihan');
  assert.ok(bare.startsWith('WenJinMincho, ') && bare.endsWith(', serif'), bare);

  assert.deepEqual(errors, []);
  await page.close();
});
