'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');

const PLUGIN_NAME = 'fiscal_year_numbering';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面(実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、見出しとconfig.jsによる動的描画が表示される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval('.settings-heading', (el) => el.textContent);
    expect(heading).toContain('年度リセット自動採番プラグイン');

    // config.js が最後まで実行されないと描画されない部分(静的HTMLだけでは検知できないため、
    // config.js冒頭のkintone.app.getFormFields()呼び出しが実際に壊れていたバグはここでしか検知できなかった)
    const eraRowCount = await page.$$eval('.js-era-row', (rows) => rows.length);
    expect(eraRowCount).toBe(1); // 未保存時に令和(2019年〜)が1件シードされる

    await page.click('#js-era-add');
    const eraRowCountAfterAdd = await page.$$eval('.js-era-row', (rows) => rows.length);
    expect(eraRowCountAfterAdd).toBe(2);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
