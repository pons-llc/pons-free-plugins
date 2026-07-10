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

const PLUGIN_NAME = 'text_split';
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

  test('設定画面が開き、設定行に区切り文字と出力先フィールドを追加できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('スプリットプラグイン');

    await page.click('#js-split-add');
    await page.select('.js-split-source', '文字列__1行_');
    await page.click('.js-delimiter-add');
    await page.type('.js-delimiter-value', '-');
    await page.click('.js-target-add');
    await page.click('.js-target-add');

    const targetCount = await page.$$eval(
      '.js-target-row',
      (rows) => rows.length,
    );
    expect(targetCount).toBe(2);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
