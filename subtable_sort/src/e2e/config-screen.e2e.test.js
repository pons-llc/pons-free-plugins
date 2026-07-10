'use strict';

// このプラグイン固有のPuppeteerテスト。実環境での動作検証はユーザーが別途実施済みのため、
// ここでは公開サイト用のスクリーンショットを撮る最小限のテストのみを置く
// (設定画面が開けること・config.jsの描画が壊れていないことの疎通確認を兼ねる)。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');

const PLUGIN_NAME = 'subtable_sort';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面(実環境, スクリーンショット取得用)', () => {
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
    await page.setViewport({ width: 1280, height: 800 });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、任意実行モードでソート済フィールド欄が表示される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('サブテーブルソートプラグイン');

    await page.click('#js-rule-add');
    await page.select('.js-rule-subtable', 'テーブル');
    await page.select('.js-rule-trigger', 'MANUAL');
    await page.click('.js-sortkey-add');
    await page.select('.js-sortkey-column', '数値_3');
    await page.select('.js-sortkey-order', 'DESC');
    await page.select('.js-sortkey-type', 'NUMBER');

    const flagRowVisible = await page.$eval(
      '.js-rule-flag-row',
      (el) => el.style.display !== 'none',
    );
    expect(flagRowVisible).toBe(true);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
