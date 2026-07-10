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

const PLUGIN_NAME = 'box_gdrive_iframe';
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

  test('設定画面が開き、埋め込みタブを追加できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('box・Googleドライブ埋め込み設定');

    // 「スペースフィールドが見つかりません」警告が出ていないこと(TEST_APP_ID_1にはSPACERが
    // あらかじめ用意されている)を確認しつつ、実際に埋め込みタブを1件追加してみる
    // (config.js が最後まで実行されないと描画されない部分の疎通確認)。
    const warningVisible = await page.$eval(
      '#js-no-space-warning',
      (el) => el.style.display !== 'none',
    );
    expect(warningVisible).toBe(false);

    await page.click('#js-add-tab');
    await page.type('.js-embed-title', '契約書フォルダ');
    await page.click('.js-embed-service[value="google"]');

    const tabCount = await page.$$eval(
      '.embed-tab-button',
      (tabs) => tabs.length,
    );
    expect(tabCount).toBe(1);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
