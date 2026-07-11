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
// このテストの主眼は「元フィールド」プルダウンが実際に文字列1行/組織選択のみに絞り込まれること、
// 「出力先フィールド」プルダウンが文字列1行のみに絞り込まれること、「ボタンを設置するスペース
// フィールド」プルダウンにkintone.app.getFormLayout()由来の選択肢が実際に出ることの回帰確認
// (静的HTML・単体テストでは検知できない。CLAUDE.mdの開発方針1参照)。
//
// NOTE: TEST_APP_ID_1には(record-lookup.e2e.test.jsとは別に)手動検証済みの設定行がすでに1件保存
// されていることがあるため、「#js-row-add」で追加した新しい行だけを対象にする(既存行を巻き込まない
// よう、常に最後の.js-rowをスコープに操作する)。このテストはSaveを押さないため、既存の保存済み設定を
// 書き換えることはない。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const { ensureTargetAppFields, ensureButtonSpace } = require('./fixtures');

const PLUGIN_NAME = 'org_lookup';
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
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await ensureButtonSpace(env, env.TEST_APP_ID_1);

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
    expect(heading).toContain('組織ルックアッププラグイン');

    await page.click('#js-row-add');
    const rows = await page.$$('.js-row');
    const newRow = rows[rows.length - 1];

    // 元フィールド: 文字列1行/組織選択のみが選択肢に出ているはず(config.js冒頭の
    // SOURCE_FIELD_TYPESの絞り込みが実際に効いているかの回帰確認)。fixtures.jsで用意した
    // 「orgl_org_code」(文字列1行)と、TEST_APP_ID_1に既存の「組織選択」が含まれ、数値型の
    // 「数値」は含まれない。
    const sourceOptionValues = await newRow.$$eval(
      '.js-source-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(sourceOptionValues).toContain('orgl_org_code');
    expect(sourceOptionValues).toContain('組織選択');
    expect(sourceOptionValues).not.toContain('数値');

    // 発動条件はデフォルトでボタン押下時(BUTTON)。ボタン設置スペースの選択肢に
    // kintone.app.getFormLayout()由来の値が実際に出ること(CLAUDE.mdの既知の落とし穴、
    // tab_layoutプラグインで実際に発生したバグと同種)。
    const triggerSelect = await newRow.$('.js-trigger');
    expect(await triggerSelect.evaluate((el) => el.value)).toBe('BUTTON');
    const spaceOptionValues = await newRow.$$eval(
      '.js-button-space option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(spaceOptionValues).toContain('orgl_button_space');

    // 転記項目を1件追加し、属性の選択肢に親組織系の項目が含まれること・出力先フィールドの選択肢が
    // 文字列1行のみに絞り込まれていることを確認する。
    await (await newRow.$('.js-mapping-add')).click();
    const attributeOptionValues = await newRow.$$eval(
      '.js-mapping-attribute option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(attributeOptionValues).toContain('name');
    expect(attributeOptionValues).toContain('parentName');

    const destinationOptionValues = await newRow.$$eval(
      '.js-mapping-destination option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(destinationOptionValues).toContain('orgl_out_name');
    expect(destinationOptionValues).not.toContain('数値');
    expect(destinationOptionValues).not.toContain('文字列__複数行_');

    // 元フィールド・ボタン設置スペース・転記項目(属性→出力先)を選び、保存前バリデーションが
    // 通る状態を作る(このテストはSaveを押さないため、既存の保存済み設定には影響しない)。
    await (await newRow.$('.js-source-field')).select('orgl_org_code');
    await (await newRow.$('.js-button-space')).select('orgl_button_space');
    await (await newRow.$('.js-mapping-attribute')).select('name');
    await (await newRow.$('.js-mapping-destination')).select('orgl_out_name');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
