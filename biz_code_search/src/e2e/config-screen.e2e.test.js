'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e
//
// このテストの主眼は「法人番号・法人名フィールド」プルダウンが実際に文字列(1行)フィールドのみに
// 絞り込まれること(数値・レコード番号フィールドは選択肢に出ない)、「ボタン設置スペース」プルダウンに
// kintone.app.getFormLayout()由来の選択肢が実際に出ること、転記項目の属性プルダウンが
// gbiz-attributes.jsの一覧から組み立てられることの回帰確認(静的HTML・単体テストでは検知できない。
// CLAUDE.mdの開発方針1参照)。APIトークンの保存はrecord-lookup.e2e.test.js側で行うため、
// このテストはSaveを押さない(既存の保存済み設定を書き換えない)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { ensureTargetAppFields, ensureButtonSpaces } = require('./fixtures');

const PLUGIN_NAME = 'biz_code_search';
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
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await ensureButtonSpaces(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、設定行を追加すると各プルダウンの選択肢が実際に絞り込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('法人番号検索プラグイン');

    // APIトークンの設定状況が表示されていること(値そのものは表示されない)。
    const tokenStatusText = await page.$eval(
      '#js-token-status',
      (el) => el.textContent,
    );
    expect(tokenStatusText.length).toBeGreaterThan(0);

    await page.click('#js-lookup-add');
    const rows = await page.$$('.js-lookup-row');
    const newRow = rows[rows.length - 1];

    // 法人番号・法人名フィールド: 文字列(1行)のみが選択肢に出ているはず
    // (config.js冒頭のtextFieldsの絞り込みが実際に効いているかの回帰確認)。
    const corporateNumberOptionValues = await newRow.$$eval(
      '.js-lookup-corporate-number option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(corporateNumberOptionValues).toContain('bcs_corporate_number');
    expect(corporateNumberOptionValues).not.toContain('数値');
    expect(corporateNumberOptionValues).not.toContain('レコード番号');

    const companyNameOptionValues = await newRow.$$eval(
      '.js-lookup-company-name option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(companyNameOptionValues).toContain('bcs_company_name');

    // ボタン設置スペース: kintone.app.getFormLayout()の戻り値を誤って{layout:[...]}と
    // ラップ扱いすると常に0件になる(CLAUDE.mdの既知の落とし穴、tab_layoutプラグインで
    // 実際に発生したバグと同種)。fixtures.jsで用意したスペースが出ること。
    const numberSpaceOptionValues = await newRow.$$eval(
      '.js-lookup-number-button-space option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(numberSpaceOptionValues).toContain('bcs_number_button_space');

    const nameSpaceOptionValues = await newRow.$$eval(
      '.js-lookup-name-button-space option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(nameSpaceOptionValues).toContain('bcs_name_button_space');

    // 法人番号・法人名フィールド、ボタン設置スペースを選び、転記項目を1件追加した状態で
    // 保存前バリデーションが通ることも合わせて確認する(このテストはSaveを押さない)。
    const corporateNumberSelect = await newRow.$('.js-lookup-corporate-number');
    await corporateNumberSelect.select('bcs_corporate_number');
    const companyNameSelect = await newRow.$('.js-lookup-company-name');
    await companyNameSelect.select('bcs_company_name');
    const numberSpaceSelect = await newRow.$('.js-lookup-number-button-space');
    await numberSpaceSelect.select('bcs_number_button_space');
    const nameSpaceSelect = await newRow.$('.js-lookup-name-button-space');
    await nameSpaceSelect.select('bcs_name_button_space');

    const mappingAddButton = await newRow.$('.js-mapping-add');
    await mappingAddButton.click();
    const mappingAttributeSelect = await newRow.$('.js-mapping-attribute');
    const mappingAttributeOptionValues = await newRow.$$eval(
      '.js-mapping-attribute option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(mappingAttributeOptionValues).toContain('name');
    expect(mappingAttributeOptionValues).toContain('representative_name');
    await mappingAttributeSelect.select('name');
    const mappingTargetSelect = await newRow.$('.js-mapping-target');
    await mappingTargetSelect.select('bcs_name_output');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
