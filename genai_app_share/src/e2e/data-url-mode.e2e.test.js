'use strict';

// 実行方式(data URL)の実環境テスト。href の形式のみを確認し、実際のクリック・別タブ遷移は
// 行わない。
//
// 別ファイル(react-mode.e2e.test.js)で実際に確認したとおり、`<a target="_blank"
// href="data:...">` へのクリック遷移は、このE2E環境のChrome(Puppeteerバンドル版)では
// targetcreatedイベントが一切発火せずブロックされる(idea.md「実行方式の選択」に記載した
// 「主要ブラウザはフィッシング対策としてdata:URLへのトップレベル遷移を制限・ブロックする
// 傾向がある」という設計上のリスクが実際に顕在化したもの)。そのためこのテストではナビゲーションを
// 伴わず、プラグインが正しく`data:text/html`形式のURLを組み立ててリンクのhrefに設定していることだけを
// 確認する(実際に開けるかどうかはブラウザ・バージョン・環境に依存し、このプラグイン側では
// 制御できない)。
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

// 他のE2Eテストファイルと同じ考え方で、実行方式・Reactサポートの状態も含めて自己完結で
// 確認・保存する。
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
    current.executionMode === 'data' &&
    current.enableReact === false
  ) {
    return;
  }
  await page.select('.js-html-field', HTML_FIELD_CODE);
  await page.select('.js-css-field', CSS_FIELD_CODE);
  await page.select('.js-js-field', JS_FIELD_CODE);
  await page.click('.js-execution-mode[value="data"]');
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

describe('実行方式(data URL、実環境・href確認のみ)', () => {
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

  test('リンクのhrefがdata:text/html形式になり、HTML/CSS/JSの内容がそのまま含まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await openRecordDetailViaIndex(page, env, env.TEST_APP_ID_1, seedRecordId);

    const linkEl = await page.waitForSelector('.genai-app-share-link');
    const href = await page.evaluate((el) => el.getAttribute('href'), linkEl);
    expect(href).toMatch(/^data:text\/html;charset=utf-8,/);

    const decoded = decodeURIComponent(
      href.replace('data:text/html;charset=utf-8,', ''),
    );
    expect(decoded).toContain(MARKER_TEXT);
    expect(decoded).toContain('<script type="module">');
    // 実機のChromeで「別タブは開くが初回は白紙のまま止まり、リロードすると表示される」ことが
    // 確認されたため、自己リロードのガードスクリプトを含める(idea.md「実行方式の選択」参照。
    // このガード自体が実際に症状を解消するかはヘッドレスChromeでは再現できず未検証)。
    expect(decoded).toContain('location.reload();');

    expect(pageErrors).toEqual([]);
  }, 60000);
});
