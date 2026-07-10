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
// このテストの主眼は「集計対象フィールド」プルダウンが、参照先アプリ(REST API経由)の
// 数値フィールド一覧で実際に絞り込まれることの回帰確認(静的HTML・単体テストでは検知できない。
// CLAUDE.mdの開発方針1参照)。config.js冒頭の「集計種別=件数のときは集計対象フィールドを
// 無効化する」仕様(user-test.mdで一度誤解されたが仕様通りと確認済み)も合わせて確認する。
//
// NOTE: TEST_APP_ID_1には(このテストとは別に)aggregation.e2e.test.jsが保存した設定行が
// 既にある場合があるため、常に「#js-row-add」で新しく追加した最後の.js-rowだけを対象にする
// (既存行を巻き込まないよう保存もしない)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const {
  REFERENCE_FIELD_CODE,
  RELATED_TARGET_FIELD_CODE,
} = require('./fixtures');

const PLUGIN_NAME = 'related_record_summary';
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
    // 集計設定テーブルは列数が多く横に広いため、既定の800pxビューポートでは
    // スクリーンショットが見切れる(公開サイト用に見やすくするため広げる)。
    await page.setViewport({ width: 1280, height: 800 });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定行を追加し、集計種別に応じて集計対象フィールドの選択肢・有効状態が切り替わる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('関連レコード集計プラグイン');

    await page.click('#js-row-add');
    const rows = await page.$$('.js-row');
    const newRow = rows[rows.length - 1];

    // 関連レコード一覧フィールドの候補: REFERENCE_TABLE型のフィールドのみ出る。
    const referenceOptionValues = await newRow.$$eval(
      '.js-row-reference-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(referenceOptionValues).toContain(REFERENCE_FIELD_CODE);

    // 集計種別デフォルト(件数)では、集計対象フィールドは無効化されている
    // (件数集計に対象フィールドは不要という仕様。バグではない)。
    const targetFieldSelect = await newRow.$('.js-row-target-field');
    const initiallyDisabled = await page.evaluate(
      (el) => el.disabled,
      targetFieldSelect,
    );
    expect(initiallyDisabled).toBe(true);

    // 関連レコード一覧フィールドを選ぶと、参照先アプリ(REST API)の数値フィールドが
    // 集計対象フィールドの候補として非同期に読み込まれる。
    const referenceSelect = await newRow.$('.js-row-reference-field');
    await referenceSelect.select(REFERENCE_FIELD_CODE);
    await page.waitForFunction(
      (el) => el.querySelectorAll('option').length > 1,
      {},
      targetFieldSelect,
    );
    const targetOptionValues = await newRow.$$eval(
      '.js-row-target-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(targetOptionValues).toContain(RELATED_TARGET_FIELD_CODE);

    // 集計種別を「合計」に切り替えると、集計対象フィールドが選択可能になる。
    const summaryTypeSelect = await newRow.$('.js-row-summary-type');
    await summaryTypeSelect.select('SUM');
    const enabledAfterSum = await page.evaluate(
      (el) => el.disabled,
      targetFieldSelect,
    );
    expect(enabledAfterSum).toBe(false);

    await targetFieldSelect.select(RELATED_TARGET_FIELD_CODE);
    // スクリーンショットを分かりやすくするため、書き込み先フィールドも選んでおく。
    const writeFieldSelect = await newRow.$('.js-row-write-field');
    await writeFieldSelect.select(RELATED_TARGET_FIELD_CODE);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
