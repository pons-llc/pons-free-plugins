'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e
//
// このテストの主眼は、設定画面でルールを追加し、対象フィールド(DROP_DOWN/RADIO_BUTTON)の選択肢が
// お祝い対象の値チェックボックスとして動的に描画されること・複数選択できること・保存できること
// (config.js冒頭のkintone.app.getFormFields()呼び出しが実際に壊れていないかの回帰確認、
// 静的HTMLだけでは検知できない。CLAUDE.md開発方針1参照)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { findOrCreateSourceField } = require('./fixtures');

const PLUGIN_NAME = 'status_celebration';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面(実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;
  let sourceField;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    // 新規プラグインのため、初回実行時はTEST_APP_ID_1にまだ追加されていない(冪等)。
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    sourceField = await findOrCreateSourceField(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、ルールを追加してお祝い対象の値を複数選択・保存できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval('.settings-heading', (el) => el.textContent);
    expect(heading).toContain('お祝いプラグイン');

    await page.click('#js-rule-add');
    const ruleRows = await page.$$('.js-rule-row');
    expect(ruleRows.length).toBe(1);
    const ruleRow = ruleRows[0];

    // 対象種別は既定でFIELD(ドロップダウン/ラジオボタン)。対象フィールドの選択肢に、
    // 検証環境アプリの実在するDROP_DOWN/RADIO_BUTTONフィールドが含まれることを確認する。
    const fieldOptionValues = await ruleRow.$$eval(
      '.js-rule-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(fieldOptionValues).toContain(sourceField.code);

    await (await ruleRow.$('.js-rule-field')).select(sourceField.code);

    // 対象フィールドの選択肢の数だけチェックボックスが動的に描画され、複数選択できる
    // (config.js冒頭のgetFormFields()呼び出しが壊れていると空のままになる、静的HTMLでは検知できない)。
    const checkboxCount = await ruleRow.$$eval(
      '.js-rule-trigger-values .js-checkbox-input',
      (inputs) => inputs.length,
    );
    expect(checkboxCount).toBe(Object.keys(sourceField.options).length);

    const checkboxes = await ruleRow.$$('.js-rule-trigger-values .js-checkbox-input');
    await checkboxes[0].click();
    if (checkboxes.length > 1) {
      await checkboxes[1].click();
    }
    const checkedCount = await ruleRow.$$eval(
      '.js-rule-trigger-values .js-checkbox-input',
      (inputs) => inputs.filter((i) => i.checked).length,
    );
    expect(checkedCount).toBe(checkboxes.length > 1 ? 2 : 1);

    await (await ruleRow.$('.js-rule-pattern')).select('CRACKER');
    await (await ruleRow.$('.js-rule-message')).type('よくできました!');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // 保存後、設定画面を開き直して内容が保持されているか確認する
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const reloadedCheckedCount = await page.$$eval(
      '.js-rule-trigger-values .js-checkbox-input',
      (inputs) => inputs.filter((i) => i.checked).length,
    );
    expect(reloadedCheckedCount).toBe(checkboxes.length > 1 ? 2 : 1);
    const reloadedPattern = await page.$eval('.js-rule-pattern', (el) => el.value);
    expect(reloadedPattern).toBe('CRACKER');
    const reloadedMessage = await page.$eval('.js-rule-message', (el) => el.value);
    expect(reloadedMessage).toBe('よくできました!');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
