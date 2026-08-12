'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD が設定済みであること
//      (対象アプリはfixtures.jsのBAP_TEST_APP_ID、本プラグイン専用の検証環境アプリ)
//
// 実行: pnpm run test:e2e
//
// このテストの主眼は「表示項目」チェックボックスがフォームのフィールドから動的に生成されること
// (静的HTML・単体テストでは検知できない。CLAUDE.mdの開発方針1参照)と、保存後に
// kintone.plugin.app.getConfig()で実際に永続化された値を読み直せることの確認。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { BAP_TEST_APP_ID } = require('./fixtures');

const PLUGIN_NAME = 'bulk_approval';
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
    await kintoneAdmin.ensurePluginAdded(env, BAP_TEST_APP_ID, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 800 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('表示項目チェックボックスがフォームのフィールドから生成され、保存した設定が読み直せる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, BAP_TEST_APP_ID, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('一括承認プラグイン');

    const checkboxValues = await page.$$eval(
      '.js-display-fields input[type="checkbox"]',
      (checkboxes) => checkboxes.map((c) => c.value),
    );
    expect(checkboxValues).toEqual(
      expect.arrayContaining(['bap_title', 'bap_amount']),
    );

    await page.evaluate(() => {
      const checkbox = document.querySelector(
        '.js-display-fields input[value="bap_title"]',
      );
      checkbox.checked = true;
      document.querySelector('.js-group-codes').value = 'Administrators';
    });

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');

    // 保存後はアプリのプロセス管理設定画面へ遷移する(config.jsの仕様、age_grade_field_updateと同じ)。
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    await common.openPluginConfig(page, env, BAP_TEST_APP_ID, pluginId);
    const reloadedChecked = await page.$eval(
      '.js-display-fields input[value="bap_title"]',
      (el) => el.checked,
    );
    const reloadedGroupCodes = await page.$eval(
      '.js-group-codes',
      (el) => el.value,
    );
    expect(reloadedChecked).toBe(true);
    expect(reloadedGroupCodes).toBe('Administrators');
  });
});
