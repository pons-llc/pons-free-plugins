'use strict';

// オフライン版(genogram/webapp/dist/genogram-offline.html)を file:// で開いて操作する。
// kintone・インターネット接続は使わない。外部へのリクエストが1件も発生しないこと、
// 保存(ダウンロード)→ 開く の往復、未保存の確認、不正なファイル、kintone版のJSON、画像の保存、印刷用の表示を確認し、
// 公開サイト用のスクリーンショットを撮る。
//
// 事前準備: node genogram/webapp/build.js
// 実行: pnpm run test:e2e

const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const APP = path.join(__dirname, '../../webapp/dist/genogram-offline.html');
const FIXTURE = path.join(__dirname, 'fixtures/case-example.json');
const SCREENSHOT_DIR = path.join(
  __dirname,
  '../../../site/plugins/genogram/screenshots',
);

describe('オフライン版(1つのHTMLファイル)', () => {
  let browser;
  let page;
  let downloadDir;
  const pageErrors = [];
  const consoleErrors = [];
  const externalRequests = [];
  const dialogs = [];

  const waitForDownload = async (ext, timeout = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const files = fs
        .readdirSync(downloadDir)
        .filter((f) => f.endsWith(ext) && !f.endsWith('.crdownload'));
      if (files.length > 0) {
        return path.join(downloadDir, files[0]);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`ダウンロードされませんでした: *${ext}`);
  };

  const click = (selector) => page.$eval(selector, (el) => el.click());
  const type = async (selector, text) => {
    await page.$eval(selector, (el) => el.focus());
    await page.keyboard.type(text);
  };
  const status = () => page.$eval('.js-app-status', (el) => el.textContent);
  const personCount = () =>
    page.$$eval('.gng-svg .g-person:not(.g-client-outer)', (els) => els.length);
  const openFile = async (file) => {
    const input = await page.$('.js-app-file');
    await input.uploadFile(file);
    await page.waitForFunction(
      () => document.querySelector('.js-app-status').textContent !== '',
    );
  };

  beforeAll(async () => {
    if (!fs.existsSync(APP)) {
      throw new Error('先に node genogram/webapp/build.js を実行してください。');
    }
    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genogram-offline-'));
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    const cdp = await page.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('request', (req) => {
      if (!/^(file|data|blob):/.test(req.url())) {
        externalRequests.push(req.url());
      }
    });
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      // 未保存の確認は「キャンセル」(変更を残す)を選ぶ。beforeunloadは閉じてよい
      if (dialog.type() === 'beforeunload') {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
    await page.goto(`file://${APP}`);
    await page.waitForSelector('.gng-edit');
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (downloadDir) {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    }
  });

  test('入力して保存すると、ケース名・記入者つきのケースファイルがダウンロードされる', async () => {
    await type('.js-app-case-name', 'テスト ケース');
    await type('.js-app-author', '相談員 田中');
    await click('.js-gng-add-person');
    await type('.js-gng-person-name', '本人 花子');
    await page.select('.js-gng-person-gender', 'female');
    await click('.js-gng-add-partner');
    await type('.js-gng-person-name', '夫 太郎');
    await type('.gng-memos .js-gng-memo-text', '初回面談');
    await click('.gng-memos .js-gng-memo-add');
    expect(await personCount()).toBe(2);

    await click('.js-app-save');
    const file = await waitForDownload('.json');
    expect(path.basename(file)).toMatch(/^テスト ケース_\d{8}\.json$/);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(saved.format).toBe('govapps-genogram-case');
    expect(saved.caseName).toBe('テスト ケース');
    expect(saved.genogram.persons.map((p) => p.name)).toEqual([
      '本人 花子',
      '夫 太郎',
    ]);
    expect(saved.genogram.unions).toHaveLength(1);
    expect(saved.genogram.memos[0]).toMatchObject({
      text: '初回面談',
      author: { name: '相談員 田中' },
    });
    expect(await status()).toContain('保存しました');
  });

  test('未保存の変更があると「新規」で確認し、キャンセルすれば内容は残る', async () => {
    dialogs.length = 0;
    // 保存直後は確認なしで新規にできる状態。ここで変更を加える
    await click('.js-gng-add-person');
    await click('.js-app-new');
    expect(dialogs.some((m) => m.includes('保存していない変更'))).toBe(true);
    expect(await personCount()).toBe(3);
  });

  test('保存したファイルを開くと、ケース名と図が元に戻る', async () => {
    const saved = await waitForDownload('.json');
    await page.reload();
    await page.waitForSelector('.gng-edit');
    expect(await personCount()).toBe(0);
    await openFile(saved);
    expect(await status()).toContain('開きました');
    expect(await page.$eval('.js-app-case-name', (el) => el.value)).toBe(
      'テスト ケース',
    );
    expect(await personCount()).toBe(2);
    expect(
      await page.$$eval('.gng-memos .gng-memo-text', (els) =>
        els.map((el) => el.textContent),
      ),
    ).toEqual(['初回面談']);
  });

  test('ジェノグラムでないファイルはエラーを表示し、今の内容を変えない', async () => {
    const bad = path.join(downloadDir, 'bad.txt');
    fs.writeFileSync(bad, '{"foo": 1}');
    await page.$eval('.js-app-status', (el) => {
      el.textContent = '';
    });
    await openFile(bad);
    expect(await status()).toContain('開けませんでした');
    expect(await page.$eval('.js-app-status', (el) => el.className)).toContain(
      'is-error',
    );
    expect(await personCount()).toBe(2);
  });

  test('kintone版のデータ(フィールドの値のJSON)も開ける', async () => {
    const raw = path.join(downloadDir, 'kintone-field.json');
    fs.writeFileSync(
      raw,
      JSON.stringify({
        version: 1,
        persons: [{ id: 'a', name: 'kintoneの人', gender: 'male' }],
      }),
    );
    await openFile(raw);
    expect(await status()).toContain('開きました');
    expect(await personCount()).toBe(1);
  });

  test('画像(PNG)を保存できる', async () => {
    await click('.js-gng-png');
    const png = await waitForDownload('.png');
    const head = fs.readFileSync(png).subarray(0, 8);
    expect(head.toString('hex')).toBe('89504e470d0a1a0a');
  });

  test('架空のケースを開いて、公開サイト用のスクリーンショットを撮る・印刷用の表示を確認する', async () => {
    await page.reload();
    await page.waitForSelector('.gng-edit');
    await openFile(FIXTURE);
    expect(await personCount()).toBe(13);
    await page.$eval('.js-app-status', (el) => {
      el.textContent = '';
    });
    // 本人を選んだ状態(編集パネルが出る)で撮る
    await page.$eval('.gng-lists', (el) => el.scrollIntoView());
    await page.evaluate(() => window.scrollTo(0, 0));
    const client = await page.$('.gng-svg .g-client-outer');
    const box = await client.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'offline-app.png'),
      clip: { x: 0, y: 0, width: 1400, height: 860 },
    });

    await page.emulateMediaType('print');
    const hidden = await page.evaluate(() =>
      ['.app-header', '.gng-toolbar', '.gng-panel', '.gng-memo-form'].map(
        (s) => getComputedStyle(document.querySelector(s)).display,
      ),
    );
    expect(hidden).toEqual(['none', 'none', 'none', 'none']);
    expect(
      await page.$eval('.js-app-print-title', (el) => [
        getComputedStyle(el).display,
        el.textContent,
      ]),
    ).toEqual(['block', 'ジェノグラム: 佐藤 美咲さん(架空のケース)']);
    await page.emulateMediaType(null);
  });

  test('外部へのリクエスト・ページエラー・コンソールエラー(CSP違反を含む)が無い', () => {
    expect(externalRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
