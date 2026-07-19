'use strict';

// 設定画面で実際に保存し、(1)台帳アプリに必要なフィールドが自動作成されること、
// (2)リロード後も設定値(簡易AI検索ON/OFF)が保持されること、(3)2回目の保存(冪等)でも
// エラーにならないことを検証する。フィールド作成はTEST_APP_ID_1のスキーマを実際に変更する
// (他プラグインのfixtures.jsによるensureFormFields()と同様、検証環境アプリへの永続的な変更)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { ensurePluginAddedToApp } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const REQUIRED_FIELD_CODES = [
  'plugin_id',
  'plugin_name',
  'plugin_version',
  'plugin_detail',
  'pcb_apps_table',
];

describe('設定画面(保存・フィールド自動作成・永続化)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let appId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    appId = env.TEST_APP_ID_1;
    await ensurePluginAddedToApp(env, appId, pluginId);

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

  const setAiSearchCheckbox = (checked) =>
    page.evaluate((value) => {
      const el = document.querySelector('.js-ai-search-enabled');
      if (el.checked !== value) {
        el.click();
      }
    }, checked);

  const uncheckAllGroups = () =>
    page.evaluate(() => {
      document
        .querySelectorAll('.js-group-checkbox:checked')
        .forEach((el) => el.click());
    });

  const save = () =>
    Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

  test('保存すると必要なフィールドが台帳アプリに自動作成され、AI検索設定が永続化される', async () => {
    await common.openPluginConfig(page, env, appId, pluginId);
    // GET /v1/groups.jsonの取得・グループ一覧の描画はconfig.js冒頭の非同期処理のため、
    // openPluginConfig()のnetworkIdle判定より後にDOMへ反映されることがある。uncheckAllGroups()が
    // まだ描画されていないチェックボックスを取りこぼさないよう、data-loadedマーカーで描画完了を待つ。
    await page.waitForFunction(
      () => document.getElementById('js-group-list')?.dataset.loaded === '1',
    );
    await setAiSearchCheckbox(true);
    await uncheckAllGroups();
    await save();

    await common.openPluginConfig(page, env, appId, pluginId);
    const aiSearchEnabled = await page.$eval(
      '.js-ai-search-enabled',
      (el) => el.checked,
    );
    expect(aiSearchEnabled).toBe(true);

    const properties = await kintoneAdmin.getFormFields(env, appId);
    REQUIRED_FIELD_CODES.forEach((code) => {
      expect(properties[code]).toBeDefined();
    });
    expect(properties.pcb_apps_table.type).toBe('SUBTABLE');
    expect(Object.keys(properties.pcb_apps_table.fields)).toEqual(
      expect.arrayContaining(['app_name', 'app_id', 'app_detail']),
    );
  }, 120000);

  test('既にフィールドがある状態で再保存してもエラーにならない(冪等性)', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, appId, pluginId);
    await save();

    expect(pageErrors).toEqual([]);
  }, 120000);
});
