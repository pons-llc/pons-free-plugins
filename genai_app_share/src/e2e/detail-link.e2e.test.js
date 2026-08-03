'use strict';

// レコード詳細画面の実環境テスト。以下を確認する:
//   1. HTML/CSS/JSの入力フィールドが非表示になること(kintone.app.record.isFieldVisible())
//   2. 「生成AIアプリを開く」リンクと警告文が表示されること
//   3. リンクを開くと別タブが開き、その中の(sandbox化された)iframeで実際にHTML/CSS/JSが
//      実行されること(CSSで指定した色、JSによるDOM書き換えの両方を確認)
//   4. そのiframeにsandbox属性が設定されており、allow-same-originが含まれないこと
//      (idea.md「セキュリティ設計」のオリジン分離が実際に効いていることの確認)
//   5. レコード作成画面では入力フィールドが表示された状態であること
//
// 事前準備・実行方法はconfig-screen.e2e.test.jsと同様。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  HTML_FIELD_CODE,
  CSS_FIELD_CODE,
  JS_FIELD_CODE,
  MARKER_TEXT,
  ensureSeedRecord,
  openRecordDetailViaIndex,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

// このテストは他のテストファイルより先に実行されるとは限らないため(Jestは実行順を保証しない)、
// config-screen.e2e.test.jsに依存せず自分自身で設定済みか確認し、必要なら保存する
// (related_record_summary/aggregation.e2e.test.jsの「alreadyConfigured」判定と同じ考え方)。
// このテストはblob方式・Reactサポートなしを前提にしているため、実行方式・Reactサポートの
// 状態も含めて明示的に確認・保存する(react-mode.e2e.test.jsが別の値を保存している場合に
// 備えた自己完結化。related_record_summary/aggregation.e2e.test.jsの「alreadyConfigured」
// 判定と同じ考え方)。
const ensureConfigured = async (page, env, appId, pluginId) => {
  await common.openPluginConfig(page, env, appId, pluginId);
  const current = await page.evaluate(() => ({
    html: document.querySelector('.js-html-field').value,
    css: document.querySelector('.js-css-field').value,
    js: document.querySelector('.js-js-field').value,
    executionMode: document.querySelector('.js-execution-mode:checked')?.value,
    enableReact: document.querySelector('.js-enable-react').checked,
  }));
  if (
    current.html === HTML_FIELD_CODE &&
    current.css === CSS_FIELD_CODE &&
    current.js === JS_FIELD_CODE &&
    current.executionMode === 'blob' &&
    current.enableReact === false
  ) {
    return;
  }
  await page.select('.js-html-field', HTML_FIELD_CODE);
  await page.select('.js-css-field', CSS_FIELD_CODE);
  await page.select('.js-js-field', JS_FIELD_CODE);
  await page.click('.js-execution-mode[value="blob"]');
  await page.evaluate(() => {
    const el = document.querySelector('.js-enable-react');
    if (el.checked) {
      el.click();
    }
  });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('.kintoneplugin-button-dialog-ok'),
  ]);
  await kintoneAdmin.deployApp(env, appId);
};

describe('レコード詳細画面(実環境)', () => {
  let browser;
  let page;
  let env;
  let seedRecordId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    const seed = await ensureSeedRecord(env, env.TEST_APP_ID_1);
    seedRecordId = seed.recordId;

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    await ensureConfigured(page, env, env.TEST_APP_ID_1, pluginId);
  }, 90000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('入力フィールドが非表示になり、別タブでsandbox化されたアプリが実際に動く', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await openRecordDetailViaIndex(page, env, env.TEST_APP_ID_1, seedRecordId);

    const [htmlVisible, cssVisible, jsVisible] = await page.evaluate(
      async (htmlCode, cssCode, jsCode) => [
        await kintone.app.record.isFieldVisible(htmlCode),
        await kintone.app.record.isFieldVisible(cssCode),
        await kintone.app.record.isFieldVisible(jsCode),
      ],
      HTML_FIELD_CODE,
      CSS_FIELD_CODE,
      JS_FIELD_CODE,
    );
    expect(htmlVisible).toBe(false);
    expect(cssVisible).toBe(false);
    expect(jsVisible).toBe(false);

    const linkEl = await page.waitForSelector('.genai-app-share-link');
    const href = await page.evaluate((el) => el.getAttribute('href'), linkEl);
    expect(href).toMatch(/^blob:/);
    const rel = await page.evaluate((el) => el.getAttribute('rel'), linkEl);
    expect(rel).toBe('noopener noreferrer');

    const warningText = await page.$eval(
      '.genai-app-share-warning',
      (el) => el.textContent,
    );
    expect(warningText).toContain('信頼できる相手');

    const [newPage] = await Promise.all([
      new Promise((resolve) =>
        browser.once('targetcreated', async (target) =>
          resolve(await target.page()),
        ),
      ),
      linkEl.click(),
    ]);
    await newPage.waitForSelector('iframe');

    const sandboxAttr = await newPage.$eval('iframe', (el) =>
      el.getAttribute('sandbox'),
    );
    expect(sandboxAttr).toContain('allow-scripts');
    expect(sandboxAttr).not.toMatch(/allow-same-origin/);

    const innerFrame = newPage
      .frames()
      .find((frame) => frame.parentFrame() !== null);
    expect(innerFrame).toBeDefined();

    await innerFrame.waitForSelector('#greeting');
    const greetingText = await innerFrame.$eval(
      '#greeting',
      (el) => el.textContent,
    );
    // JSがDOMを書き換えた結果を確認(元のHTMLの文言のままではないこと)。
    expect(greetingText).toBe('hello from js');
    expect(greetingText).not.toBe(MARKER_TEXT);

    const color = await innerFrame.$eval(
      '#greeting',
      (el) => getComputedStyle(el).color,
    );
    expect(color).toBe('rgb(255, 0, 0)'); // CSSで指定したred

    await newPage.close();
    expect(pageErrors).toEqual([]);
  }, 60000);

  test('レコード作成画面では入力フィールドが表示された状態になる', async () => {
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/edit`,
      {
        waitUntil: 'networkidle0',
      },
    );
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    const [htmlVisible, cssVisible, jsVisible] = await page.evaluate(
      async (htmlCode, cssCode, jsCode) => [
        await kintone.app.record.isFieldVisible(htmlCode),
        await kintone.app.record.isFieldVisible(cssCode),
        await kintone.app.record.isFieldVisible(jsCode),
      ],
      HTML_FIELD_CODE,
      CSS_FIELD_CODE,
      JS_FIELD_CODE,
    );
    expect(htmlVisible).toBe(true);
    expect(cssVisible).toBe(true);
    expect(jsVisible).toBe(true);
  }, 30000);
});
