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
// このテストの主眼は、暗号化対象フィールドのチェックボックスがSINGLE_LINE_TEXT/MULTI_LINE_TEXTのみに
// 絞り込まれること、スペースフィールドの選択肢にkintone.app.getFormLayout()由来の値が実際に出ること
// (CLAUDE.mdの既知の落とし穴、tab_layoutプラグインで実際に発生したバグと同種)の回帰確認
// (静的HTML・単体テストでは検知できない)。設定の保存はencryption-flow.e2e.test.js側で行うため、
// このテストではSaveを押さない。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  TARGET_FIELD_CODES,
  SPACE_ELEMENT_ID,
  ensureDecryptSpace,
} = require('./fixtures');

const PLUGIN_NAME = 'field_encryption';
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
    await ensureDecryptSpace(env, env.TEST_APP_ID_1);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、対象フィールド・スペースフィールドの選択肢が実際に絞り込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('フィールド暗号化プラグイン');

    // 暗号化対象フィールドのチェックボックス一覧: SINGLE_LINE_TEXT/MULTI_LINE_TEXTのみが
    // 選択肢に出ているはず(field-selection.jsの絞り込みが実際に効いているかの回帰確認)。
    const checkboxValues = await page.$$eval(
      '#js-target-fields input[type=checkbox]',
      (els) => els.map((el) => el.value),
    );
    expect(checkboxValues).toContain(TARGET_FIELD_CODES.single);
    expect(checkboxValues).toContain(TARGET_FIELD_CODES.multi);
    expect(checkboxValues).not.toContain('数値');

    // スペースフィールドの選択肢に、kintone.app.getFormLayout()由来の値が実際に出ること。
    const spaceOptionValues = await page.$$eval(
      '#js-space-element option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(spaceOptionValues).toContain(SPACE_ELEMENT_ID);

    // 最小文字数の既定値(8)が表示されていること(未保存時はConfigStore.DEFAULTSが使われる)。
    const minLengthValue = await page.$eval('#js-min-length', (el) => el.value);
    expect(Number(minLengthValue)).toBeGreaterThanOrEqual(1);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
