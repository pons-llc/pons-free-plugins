'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境にアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const { ensurePluginAddedToApp } = require('./fixtures');

const PLUGIN_NAME = 'plugin_catalog_builder';
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
    await ensurePluginAddedToApp(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、注意文言・グループ一覧が描画される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('プラグイン利用状況AI検索台帳プラグイン');

    // CDN例外の注意文言(config.htmlの静的テキストだが、config.js自体が壊れていないことの前提確認)
    const notice = await page.$eval('.pcb-notice', (el) => el.textContent);
    expect(notice).toContain('cdn.jsdelivr.net');

    // GET /v1/groups.json の取得・描画(config.js冒頭の非同期処理)が完了するまで待つ。
    // グループが1件も無い環境の可能性があるため、件数そのものではなく「エラーが出ていないこと」を
    // 主眼にする(静的HTMLだけでは検知できないJS実行結果の検証、fiscal_year_numberingと同じ方針)。
    // 固定時間の待機ではなく、config.jsが設定するdata-loadedマーカーで描画完了を確実に待つ。
    await page.waitForFunction(
      () => document.getElementById('js-group-list')?.dataset.loaded === '1',
    );
    const errorsText = await page.$eval('#js-errors', (el) => el.textContent);
    expect(errorsText).toBe('');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
