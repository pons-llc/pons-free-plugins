'use strict';

// このプラグイン固有のPuppeteerテスト。公開サイト用のスクリーンショットを撮る最小限のテストのみを置く
// (設定画面が開けること・config.jsの描画が壊れていないことの疎通確認を兼ねる、list_highlight等と
// 同じ方針)。TEST_APP_ID_2にはRADIO_BUTTON/DATE/TIME/DATETIME/STATUSフィールドが既に用意されている
// ため、こちらを使う(DROP_DOWN/CHECK_BOXのみfixtures.jsで冪等に追加する)。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_2 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_NAME = 'sidebar_toggle';
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
    await fixtures.ensureConditionFields(env, env.TEST_APP_ID_2);
    // 新規プラグインのため、初回実行時はTEST_APP_ID_2にまだ追加されていない(冪等)。
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_2, pluginId);
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、ルールと条件(ドロップダウン)を追加して値の選択肢が反映される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_2, pluginId);

    const heading = await page.$eval('.settings-heading', (el) => el.textContent);
    expect(heading).toContain('サイドバー');

    await page.click('#js-rule-add');
    const ruleRow = await page.$('.js-rule-row');
    expect(ruleRow).not.toBeNull();

    // 既定はMATCH(条件を満たすとき)なので条件エリアが表示されている。
    const conditionAreaVisible = await ruleRow.$eval(
      '.js-condition-area',
      (el) => !el.hidden,
    );
    expect(conditionAreaVisible).toBe(true);

    await (await ruleRow.$('.js-clause-add')).click();
    await (await ruleRow.$('.js-clause-field-type')).select('DROP_DOWN');

    const fieldOptionValues = await ruleRow.$$eval(
      '.js-clause-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(fieldOptionValues).toContain(fixtures.DROP_DOWN_FALLBACK_CODE);

    await (await ruleRow.$('.js-clause-field')).select(fixtures.DROP_DOWN_FALLBACK_CODE);

    const valueOptionValues = await ruleRow.$$eval(
      '.js-clause-value option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(valueOptionValues).toContain('対応中');

    await (await ruleRow.$('.js-clause-value')).select('対応中');
    await (await ruleRow.$('.js-rule-action')).select('OPEN_HISTORY');

    // 「常に」に切り替えると条件エリアが隠れることを確認する。
    await (await ruleRow.$('.js-rule-mode')).select('ALWAYS');
    const conditionAreaHiddenAfterAlways = await ruleRow.$eval(
      '.js-condition-area',
      (el) => el.hidden,
    );
    expect(conditionAreaHiddenAfterAlways).toBe(true);

    // 元に戻してからスクリーンショットを撮る(条件UI一式が見える状態にするため)。
    await (await ruleRow.$('.js-rule-mode')).select('MATCH');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
