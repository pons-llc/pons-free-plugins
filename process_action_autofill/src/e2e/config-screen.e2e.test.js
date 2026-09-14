'use strict';

// このプラグイン固有のPuppeteerテスト。設定画面が開けること・フィルター条件の選択肢構築(プロセス
// 管理のプレビュー設定REST取得)・対象フィールドの型に応じたソース入力欄の出し分け・保存時
// バリデーション・保存内容の読み直しができることに加え、複数ルールを作成しても互いの選択状態が
// 壊れないこと(ラジオボタンのname属性がルール行ごとに一意になっているか)を確認する
// (静的HTML・単体テストでは検知できない実環境固有の挙動、CLAUDE.mdの開発方針1参照)。
// 公開サイト用のスクリーンショットもここで撮る。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD が設定済みであること
//   3. process_action_autofill/provisioning/seed-test-app.js で専用テストアプリ(PAF_TEST_APP_ID)を
//      作成済みであること(プロセス管理が無効なTEST_APP_ID_1/2は使わない、fixtures.js参照)
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_NAME = 'process_action_autofill';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const { clickFilterCheckbox, isFilterCheckboxChecked } = fixtures;

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
    await kintoneAdmin.ensurePluginAdded(
      env,
      fixtures.PAF_TEST_APP_ID,
      pluginId,
    );
    await fixtures.ensureFields(env, fixtures.PAF_TEST_APP_ID);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1100 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('ルールを追加し、フィルター選択肢・型別ソース欄の出し分け・バリデーション・保存内容の読み直しができる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(
      page,
      env,
      fixtures.PAF_TEST_APP_ID,
      pluginId,
    );

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('プロセスアクション自動入力プラグイン');

    // プロセス管理が有効なアプリでは警告が表示されない。
    const warningHidden = await page.$eval(
      '#js-process-warning',
      (el) => el.hidden,
    );
    expect(warningHidden).toBe(true);

    // このテストは繰り返し実行される(前回保存した設定が残っている)ため、既存のルールを
    // すべて削除してから新規に組み立てる(冪等にするため)。
    for (;;) {
      const removeButton = await page.$('.js-rule-remove');
      if (!removeButton) {
        break;
      }
      await removeButton.click();
    }

    await page.click('#js-rule-add');
    const ruleRow = await page.$('.js-rule-row');
    expect(ruleRow).not.toBeNull();

    // フィルター条件のアクション名チェックボックスに、プレビューのプロセス管理設定(REST API)から
    // 取得したアクション名が含まれる。
    const actionCheckboxValues = await ruleRow.$$eval(
      '.js-filter-action-options input[type=checkbox]',
      (checkboxes) => checkboxes.map((c) => c.value),
    );
    expect(actionCheckboxValues).toContain(fixtures.PROCESS_ACTIONS.start.name);
    expect(actionCheckboxValues).toContain(
      fixtures.PROCESS_ACTIONS.complete.name,
    );
    await clickFilterCheckbox(
      ruleRow,
      '.js-filter-action-options',
      fixtures.PROCESS_ACTIONS.start.name,
    );

    // 対象フィールドの選択肢に、対応型のフィールドが列挙される。
    const targetOptionValues = await ruleRow.$$eval(
      '.js-target option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(targetOptionValues).toContain(fixtures.FIELD_CODES.textTarget);
    expect(targetOptionValues).toContain(fixtures.FIELD_CODES.radioTarget);
    expect(targetOptionValues).toContain(fixtures.FIELD_CODES.dateTarget);

    // TEXTカテゴリ: 文字列ソースのブロックだけが表示される。
    await (
      await ruleRow.$('.js-target')
    ).select(fixtures.FIELD_CODES.textTarget);
    expect(await ruleRow.$eval('.js-source-text', (el) => el.hidden)).toBe(
      false,
    );
    expect(await ruleRow.$eval('.js-source-choice', (el) => el.hidden)).toBe(
      true,
    );
    await (
      await ruleRow.$('.js-source-text-fixed-value')
    ).type('自動入力テスト');

    // CHOICEカテゴリ: 選択肢がフィールド自身のoptionsから構築される。
    await (
      await ruleRow.$('.js-target')
    ).select(fixtures.FIELD_CODES.radioTarget);
    expect(await ruleRow.$eval('.js-source-text', (el) => el.hidden)).toBe(
      true,
    );
    expect(await ruleRow.$eval('.js-source-choice', (el) => el.hidden)).toBe(
      false,
    );
    const choiceOptionValues = await ruleRow.$$eval(
      '.js-source-choice-value option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(choiceOptionValues).toEqual(['選択肢A', '選択肢B']);

    // 動作を「値をクリア」に切り替えると、RADIO_BUTTON特有の注意書きが表示される。
    await (await ruleRow.$('.js-op-clear')).click();
    expect(
      await ruleRow.$eval('.js-clear-radio-caution', (el) => el.hidden),
    ).toBe(false);
    // SETに戻す(以降のルールと動作を揃えるため)。
    await (await ruleRow.$('.js-op-set')).click();
    await (await ruleRow.$('.js-source-choice-value')).select('選択肢A');

    // DATE_TIMEカテゴリ: 基準の既定は「実行時点」で、「特定の日付/日時フィールド」に切り替えると
    // 対象フィールドと同じ型(DATE)のフィールドだけが候補に並ぶ。
    await (
      await ruleRow.$('.js-target')
    ).select(fixtures.FIELD_CODES.dateTarget);
    expect(
      await ruleRow.$eval('.js-source-date-base-now', (el) => el.checked),
    ).toBe(true);
    await (await ruleRow.$('.js-source-date-base-field')).click();
    expect(
      await ruleRow.$eval('.js-source-date-field-row', (el) => el.hidden),
    ).toBe(false);
    const dateFieldOptionValues = await ruleRow.$$eval(
      '.js-source-date-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(dateFieldOptionValues).toContain(fixtures.FIELD_CODES.dateTarget);
    expect(dateFieldOptionValues).not.toContain(
      fixtures.FIELD_CODES.datetimeTarget,
    );
    // 「作成日時」に切り替えるとフィールド選択欄は隠れる(コード指定不要なため)。
    await (await ruleRow.$('.js-source-date-base-created')).click();
    expect(
      await ruleRow.$eval('.js-source-date-field-row', (el) => el.hidden),
    ).toBe(true);
    // 元のTEXTルールとして完成させるため、対象フィールドを文字列に戻す。
    await (
      await ruleRow.$('.js-target')
    ).select(fixtures.FIELD_CODES.textTarget);
    await (
      await ruleRow.$('.js-source-text-fixed-value')
    ).type('自動入力テスト');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');

    // --- ラジオボタンのname衝突バグ回帰テスト ---
    // 1件目のルールを「値をクリア」にしたあと、2件目のルールを追加して「値を設定」を選んでも、
    // 1件目の動作ラジオの選択状態が(name属性の衝突により)巻き込まれてリセットされないこと。
    await (await ruleRow.$('.js-op-clear')).click();
    expect(await ruleRow.$eval('.js-op-clear', (el) => el.checked)).toBe(true);

    // #js-rule-add はルール一覧全体を再描画するため、それ以前に取得した要素ハンドル(ruleRow)は
    // 無効(detached)になる。以降は再描画後に取得し直したハンドルを使う。
    await page.click('#js-rule-add');
    const rowsAfterAdd = await page.$$('.js-rule-row');
    const firstRuleRowAfterAdd = rowsAfterAdd[0];
    const secondRuleRow = rowsAfterAdd[1];
    await (await secondRuleRow.$('.js-op-set')).click();
    expect(await secondRuleRow.$eval('.js-op-set', (el) => el.checked)).toBe(
      true,
    );

    // 2件目を追加・操作しても、1件目の「値をクリア」チェックは維持されている(修正前は外れていた)。
    expect(
      await firstRuleRowAfterAdd.$eval('.js-op-clear', (el) => el.checked),
    ).toBe(true);
    expect(
      await firstRuleRowAfterAdd.$eval('.js-op-set', (el) => el.checked),
    ).toBe(false);

    // 1件目を「値を設定」に戻す。
    await (await firstRuleRowAfterAdd.$('.js-op-set')).click();

    // 2件目(対象フィールド未選択のまま)を保存しようとすると、保存時バリデーションでエラーになる。
    await page.click('.kintoneplugin-button-dialog-ok');
    const errorText = await page.$eval('#js-errors', (el) => el.textContent);
    expect(errorText).toContain('対象フィールドが選択されていません');

    // 2件目のルールを削除すれば保存できる。
    const ruleRowsBeforeSave = await page.$$('.js-rule-row');
    await (await ruleRowsBeforeSave[1].$('.js-rule-remove')).click();

    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    await common.openPluginConfig(
      page,
      env,
      fixtures.PAF_TEST_APP_ID,
      pluginId,
    );
    const reloadedRuleRow = await page.$('.js-rule-row');
    const reloadedActionChecked = await isFilterCheckboxChecked(
      reloadedRuleRow,
      '.js-filter-action-options',
      fixtures.PROCESS_ACTIONS.start.name,
    );
    const reloadedTarget = await reloadedRuleRow.$eval(
      '.js-target',
      (el) => el.value,
    );
    expect(reloadedActionChecked).toBe(true);
    expect(reloadedTarget).toBe(fixtures.FIELD_CODES.textTarget);
  });
});
