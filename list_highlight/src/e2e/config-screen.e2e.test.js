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

const PLUGIN_NAME = 'list_highlight';
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

  test('設定画面が開き、ルールと条件を追加して対象フィールドが選択できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval('.settings-heading', (el) => el.textContent);
    expect(heading).toContain('一覧強調プラグイン');

    await page.click('#js-rule-add');
    const ruleRow = await page.$('.js-rule-row');
    expect(ruleRow).not.toBeNull();

    await (await ruleRow.$('.js-clause-add')).click();
    const clauseFieldOptionValues = await ruleRow.$$eval(
      '.js-clause-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(clauseFieldOptionValues).toContain('文字列__1行_');

    await (await ruleRow.$('.js-clause-field')).select('文字列__1行_');
    await (await ruleRow.$('.js-clause-value')).type('テスト');
    await (await ruleRow.$('.js-rule-color')).evaluate((el) => {
      el.value = '#ffcc00';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const colorValue = await ruleRow.$eval('.js-rule-color', (el) => el.value);
    expect(colorValue).toBe('#ffcc00');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
