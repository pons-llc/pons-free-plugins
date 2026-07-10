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

const PLUGIN_NAME = 'narrowDown';
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
    page.on('dialog', (dialog) => dialog.dismiss());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、絞込条件を1件追加できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    await page.waitForSelector('#mr-button');
    await page.click('#mr-button');

    await page.waitForSelector('.row-element #condition-field');
    await page.select('.row-element #condition-field', 'ドロップダウン');
    await page.select('.row-element #target-field', 'ラジオボタン');
    await page.click('.row-element .add-value-button');

    await page.waitForSelector('.row-element .value-row #condition-value');
    const conditionValueCount = await page.$$eval(
      '.row-element .value-row #condition-value option',
      (opts) => opts.length,
    );
    const targetValueCount = await page.$$eval(
      '.row-element .value-row #target-value option',
      (opts) => opts.length,
    );
    expect(conditionValueCount).toBeGreaterThan(0);
    expect(targetValueCount).toBeGreaterThan(0);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
