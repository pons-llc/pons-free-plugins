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
// このテストの主眼は「変換元フィールド」プルダウンが実際にDATETIME/TIME型のみに絞り込まれること
// (config.js冒頭のSOURCE_FIELD_TYPESの絞り込みが実際に効いているかの回帰確認、静的HTML・単体テスト
// では検知できない。CLAUDE.mdの開発方針1参照)。このテストはSaveを押さないため、既存の保存済み設定
// (config-save-and-record.e2e.test.jsが作る行を含む)には影響しない。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { findSourceField, findExcludedField } = require('./fixtures');

const PLUGIN_NAME = 'time_band_aggregator';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面(実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;
  let sourceField;
  let excludedField;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    // 新規プラグインのため、初回実行時はTEST_APP_ID_1にまだ追加されていない(冪等)。
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    sourceField = await findSourceField(env, env.TEST_APP_ID_1);
    excludedField = await findExcludedField(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、変換元フィールドの選択肢がDATETIME/TIME型のみに絞り込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('時間帯集計項目自動作成プラグイン');

    await page.click('#js-row-add');
    const rows = await page.$$('.js-row');
    const newRow = rows[rows.length - 1];

    const sourceOptionValues = await newRow.$$eval(
      '.js-source-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(sourceOptionValues).toContain(sourceField.code);
    expect(sourceOptionValues).not.toContain(excludedField.code);

    // 区切り幅のデフォルトは60分(1時間)。
    const bandWidthSelect = await newRow.$('.js-band-width');
    expect(await bandWidthSelect.evaluate((el) => el.value)).toBe('60');

    // 保存前は「作成されるフィールド」が未確定である旨の注記が出る。
    const createdFieldsNote = await newRow.$eval(
      '.js-created-fields',
      (el) => el.textContent,
    );
    expect(createdFieldsNote).toContain('保存時に自動作成されます');

    await (await newRow.$('.js-source-field')).select(sourceField.code);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
