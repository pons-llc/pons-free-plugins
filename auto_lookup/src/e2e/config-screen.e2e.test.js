'use strict';

// このプラグイン固有のPuppeteerテスト。公開サイト用のスクリーンショットを撮る最小限のテストのみを置く
// (設定画面が開けること・config.jsの描画が壊れていないことの疎通確認を兼ねる、text_slice等と同じ方針)。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 / TEST_APP_ID_2 が
//      設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { LOOKUP_FIELD_CODE, ensureLookupSetup } = require('./fixtures');

const PLUGIN_NAME = 'auto_lookup';
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
    // 新規プラグインのため、初回実行時はTEST_APP_ID_1にまだ追加されていない(冪等)。
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    await ensureLookupSetup(env, env.TEST_APP_ID_1, env.TEST_APP_ID_2);

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

  test('設定画面が開き、ルックアップフィールドがチェックボックスとして選択できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval('.settings-heading', (el) => el.textContent);
    expect(heading).toContain('自動ルックアッププラグイン');

    const labels = await page.$$eval('#js-lookup-field-list .js-checkbox-label', (els) =>
      els.map((el) => el.textContent),
    );
    expect(labels.some((label) => label.includes(LOOKUP_FIELD_CODE))).toBe(true);

    const checkboxes = await page.$$('#js-lookup-field-list .js-checkbox-input');
    await checkboxes[0].click();
    const checkedCount = await page.$$eval(
      '#js-lookup-field-list .js-checkbox-input',
      (inputs) => inputs.filter((i) => i.checked).length,
    );
    expect(checkedCount).toBe(1);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
