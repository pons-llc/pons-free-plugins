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
// このテストの主眼は、タブ切り替え式の設定画面が実際にDOM上で動くこと(ボタン追加でタブが増える、
// ラベル入力がタブ見出しに反映される、フィールド選択肢が対応フィールド型のみに絞り込まれること
// [js/lib/field-eligibility.jsの回帰確認]、空白項目の追加、項目の並び替え)の回帰確認。
// このテストはSaveを押さないため、既存の保存済み設定を書き換えることはない
// (record-panel.e2e.test.jsが実際の保存・レコードへの反映を確認する)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const { TEXT_FIELD_CODE } = require('./fixtures');

const PLUGIN_NAME = 'field_input_panel';
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

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('ボタンを追加すると設定タブが増え、対応フィールド型のみが選択肢に出る', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('入力箇所モーダル表示プラグイン');

    // NOTE: TEST_APP_ID_1には本テストとは別に、record-panel.e2e.test.jsが保存した設定
    // (E2E_BUTTON_LABEL)が既に存在することがあるため、「ボタン0件」の絶対的な初期状態は
    // 前提にしない(冪等性のため)。ボタン追加の前後でタブ数が1件増えること、追加直後は
    // 「ボタンが無い」空メッセージが必ず非表示になることのみを確認する。
    const tabCountBefore = (await page.$$('.fip-tab')).length;

    await page.click('#js-button-add');
    expect(await page.$eval('#js-no-button-message', (el) => el.hidden)).toBe(
      true,
    );
    const tabCountAfter = (await page.$$('.fip-tab')).length;
    expect(tabCountAfter).toBe(tabCountBefore + 1);

    // タブ見出しは未入力時「ボタンN」(Nは追加後の件数)。
    let tabLabels = await page.$$eval('.fip-tab', (els) =>
      els.map((el) => el.textContent),
    );
    expect(tabLabels.some((t) => t.includes(`ボタン${tabCountAfter}`))).toBe(
      true,
    );

    // ラベル入力がタブ見出しにリアルタイムで反映される。
    await page.type('.js-button-label', 'テスト入力ボタン');
    tabLabels = await page.$$eval('.fip-tab', (els) =>
      els.map((el) => el.textContent),
    );
    expect(tabLabels.some((t) => t.includes('テスト入力ボタン'))).toBe(true);

    // フィールドを1件追加し、対応フィールド型(文字列1行等)のみが選択肢に出て、
    // 対象外の型(ユーザー選択・テーブル)は出ないことを確認する
    // (js/lib/field-eligibility.jsのisEligibleField()の回帰確認)。
    await page.click('.js-item-add-field');
    const fieldSelects = await page.$$('.js-item-field-select');
    const optionValues = await fieldSelects[0].evaluate((el) =>
      Array.from(el.options).map((o) => o.value),
    );
    expect(optionValues).toContain(TEXT_FIELD_CODE);
    expect(optionValues).not.toContain('ユーザー選択');
    expect(optionValues).not.toContain('テーブル');
    expect(optionValues).not.toContain('関連レコード一覧');

    await fieldSelects[0].select(TEXT_FIELD_CODE);

    // 空白を1件追加すると、選択肢は出ずに「(空白)」ラベルの行になる。
    await page.click('.js-item-add-spacer');
    const itemRows = await page.$$('.js-item-row');
    expect(itemRows.length).toBe(2);
    const secondRowSpacerHidden = await itemRows[1].$eval(
      '.js-item-spacer-label',
      (el) => el.hidden,
    );
    expect(secondRowSpacerHidden).toBe(false);

    // 2件目(空白)を「↑」で1件目と入れ替えると、1件目が空白行になる。
    await itemRows[1].$eval('.js-item-move-up', (el) => el.click());
    const reorderedRows = await page.$$('.js-item-row');
    const firstRowSpacerHidden = await reorderedRows[0].$eval(
      '.js-item-spacer-label',
      (el) => el.hidden,
    );
    expect(firstRowSpacerHidden).toBe(false);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
