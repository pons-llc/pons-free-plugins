'use strict';

// このプラグイン固有のPuppeteerテスト。公開サイト用のスクリーンショットを撮る最小限のテストのみを置く
// (設定画面が開けること・config.jsの描画が壊れていないことの疎通確認を兼ねる、text_slice等と同じ方針)。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'number_extract';
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

  test('設定画面が開き、設定行を追加して元フィールド・出力先フィールドが選択できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval('.settings-heading', (el) => el.textContent);
    expect(heading).toContain('数字抽出プラグイン');

    await page.click('#js-extract-add');
    const extractRow = await page.$('.js-extract-row');
    expect(extractRow).not.toBeNull();

    const sourceOptionValues = await extractRow.$$eval(
      '.js-extract-source option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(sourceOptionValues).toContain('文字列__1行_');

    await (await extractRow.$('.js-extract-source')).select('文字列__1行_');
    await (await extractRow.$('.js-extract-fullwidth')).click();

    await (await extractRow.$('.js-target-add')).click();
    const targetOptionValues = await extractRow.$$eval(
      '.js-target-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(targetOptionValues).toContain('文字列__1行__0');

    await (await extractRow.$('.js-target-field')).select('文字列__1行__0');

    const fullwidthChecked = await extractRow.$eval(
      '.js-extract-fullwidth',
      (el) => el.checked,
    );
    expect(fullwidthChecked).toBe(true);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
