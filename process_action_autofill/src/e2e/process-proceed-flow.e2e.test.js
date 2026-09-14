'use strict';

// プロセス管理のアクションボタンを実際に実行し、設定したルールに従ってフィールドの値が
// 設定・クリアされること、および日付/日時フィールドの新しい基準(作成日時)からのオフセットが
// 正しく反映されることを検証する実環境テスト(config-screen.e2e.test.jsでは設定画面のUIのみを
// 確認しており、実際のprocess.proceedイベント発火・値の反映まではカバーしていないため)。
//
// 事前準備は config-screen.e2e.test.js と同じ(pnpm run build && pnpm run upload 済みであること)。
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const fixtures = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const FIXED_TEXT_VALUE = '自動入力テスト';
const { clickFilterCheckbox } = fixtures;

// kintoneのプロセス管理アクションボタンをクリックし、確認ポップオーバーの「実行」ボタンまで
// 押し切る。DOM構造は実際に検証環境(process_action_autofillテスト用アプリ)で確認済み
// (`.gaia-app-statusbar-action-label`がアクション名のspan、押すと現れる確認ポップオーバーの
// OKボタンが`.gaia-app-statusbar-assigneepopup-ok`、テキストは「実行」)。この構造はkintoneの
// 内部実装に依存するため、将来のkintoneアップデートで変わる可能性がある。
const runProcessAction = async (page, actionName) => {
  const actionHandle = await page.evaluateHandle((name) => {
    const label = Array.from(
      document.querySelectorAll('.gaia-app-statusbar-action-label'),
    ).find((el) => el.textContent.trim() === name);
    return label ? label.closest('.gaia-app-statusbar-action') : null;
  }, actionName);
  const actionEl = actionHandle.asElement();
  if (!actionEl) {
    throw new Error(`アクションボタン「${actionName}」が見つかりません。`);
  }
  const actionBox = await actionEl.boundingBox();
  await page.mouse.click(
    actionBox.x + actionBox.width / 2,
    actionBox.y + actionBox.height / 2,
  );

  await page.waitForSelector('.gaia-app-statusbar-assigneepopup-ok', {
    timeout: 10000,
  });
  const runEl = await page.$('.gaia-app-statusbar-assigneepopup-ok');
  const runBox = await runEl.boundingBox();
  await page.mouse.click(
    runBox.x + runBox.width / 2,
    runBox.y + runBox.height / 2,
  );
};

// REST APIでレコードの最新状態を取得しつつ、対象フィールドが期待通りに変わるまで短時間ポーリングする
// (process.proceedイベントの保存反映がクリック後すぐには完了しない場合があるため)。
const waitForRecordField = async (
  env,
  appId,
  recordId,
  fieldCode,
  predicate,
  timeoutMs = 15000,
) => {
  const start = Date.now();
  for (;;) {
    const { record } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'GET',
      {
        app: appId,
        id: recordId,
      },
    );
    if (predicate(record[fieldCode])) {
      return record;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `フィールド「${fieldCode}」が期待する状態になりませんでした。現在値: ${JSON.stringify(record[fieldCode])}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

// DATETIMEフィールドへの「瞬間+オフセット」計算を、date-offset-calculator.jsのcomputeInstantOffsetValue
// (DATETIME分岐)と同じ手法で独立に再現する(絶対時刻なのでタイムゾーンの概念が無く、
// ミリ秒をそのまま加算してミリ秒なしISO8601に整形するだけ)。
const addDaysToDatetimeValue = (isoValue, days) =>
  new Date(new Date(isoValue).getTime() + days * 86400000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');

describe('プロセスアクション実行時のフィールド自動更新(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let repoRoot;

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
    await page.setViewport({ width: 1280, height: 900 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('「処理を開始する」アクション実行で、条件に一致するルールの対象フィールドが設定・クリア・オフセット計算される', async () => {
    // --- 1. ルールを組み立てて保存する ---
    // ルール1: filter.actionNames=[処理を開始する] / target=文字列 / SET 固定値
    // ルール2: filter.actionNames=[処理を開始する] / target=チェックボックス / CLEAR
    // ルール3: filter.actionNames=[処理を開始する] / target=日時 / SET 作成日時+1日(CREATED_TIME_OFFSET)
    await common.openPluginConfig(
      page,
      env,
      fixtures.PAF_TEST_APP_ID,
      pluginId,
    );

    for (;;) {
      const removeButton = await page.$('.js-rule-remove');
      if (!removeButton) {
        break;
      }
      await removeButton.click();
    }

    await page.click('#js-rule-add');
    const textRuleRow = await page.$('.js-rule-row');
    await clickFilterCheckbox(
      textRuleRow,
      '.js-filter-action-options',
      fixtures.PROCESS_ACTIONS.start.name,
    );
    await (
      await textRuleRow.$('.js-target')
    ).select(fixtures.FIELD_CODES.textTarget);
    await (
      await textRuleRow.$('.js-source-text-fixed-value')
    ).type(FIXED_TEXT_VALUE);

    await page.click('#js-rule-add');
    let rows = await page.$$('.js-rule-row');
    const checkboxRuleRow = rows[1];
    await clickFilterCheckbox(
      checkboxRuleRow,
      '.js-filter-action-options',
      fixtures.PROCESS_ACTIONS.start.name,
    );
    await (
      await checkboxRuleRow.$('.js-target')
    ).select(fixtures.FIELD_CODES.checkboxTarget);
    await (await checkboxRuleRow.$('.js-op-clear')).click();

    await page.click('#js-rule-add');
    rows = await page.$$('.js-rule-row');
    const datetimeRuleRow = rows[2];
    await clickFilterCheckbox(
      datetimeRuleRow,
      '.js-filter-action-options',
      fixtures.PROCESS_ACTIONS.start.name,
    );
    await (
      await datetimeRuleRow.$('.js-target')
    ).select(fixtures.FIELD_CODES.datetimeTarget);
    await (await datetimeRuleRow.$('.js-source-date-base-created')).click();
    await (await datetimeRuleRow.$('.js-source-date-unit')).select('DAYS');
    await (await datetimeRuleRow.$('.js-source-date-magnitude')).type('1');

    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // プラグイン設定はsetConfig()時点ではプレビューにのみ反映されるため、運用環境で実際に
    // process.proceedイベントを発火させて検証するには明示的なデプロイが必要
    // (project_plugin_config_needs_deployのメモ通り)。
    await kintoneAdmin.deployApp(env, fixtures.PAF_TEST_APP_ID);

    // --- 2. テストレコードを作成する(チェックボックスにあらかじめ値を入れておき、
    //         クリアされることを確認できるようにする) ---
    const created = await kintoneAdmin.addRecords(
      env,
      fixtures.PAF_TEST_APP_ID,
      [{ [fixtures.FIELD_CODES.checkboxTarget]: { value: ['選択肢A'] } }],
    );
    const recordId = created.ids[0];

    // --- 3. レコード詳細画面でアクションを実行する ---
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${fixtures.PAF_TEST_APP_ID}/show#record=${recordId}`,
      { waitUntil: 'networkidle0' },
    );
    await page
      .waitForNetworkIdle({ idleTime: 800, timeout: 15000 })
      .catch(() => {});

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await runProcessAction(page, fixtures.PROCESS_ACTIONS.start.name);

    // --- 4. REST APIで反映結果を確認する ---
    const record = await waitForRecordField(
      env,
      fixtures.PAF_TEST_APP_ID,
      recordId,
      'ステータス',
      (field) => field.value === fixtures.PROCESS_ACTIONS.start.to,
    );

    expect(record[fixtures.FIELD_CODES.textTarget].value).toBe(
      FIXED_TEXT_VALUE,
    );
    expect(record[fixtures.FIELD_CODES.checkboxTarget].value).toEqual([]);

    // 作成日時(CREATED_TIME型)フィールドをコード決め打ちせずtypeで探す(value-resolver.jsの
    // findFieldByTypeと同じ考え方)。
    const createdTimeEntry = Object.values(record).find(
      (f) => f.type === 'CREATED_TIME',
    );
    expect(createdTimeEntry).toBeDefined();
    const expectedDatetimeValue = addDaysToDatetimeValue(
      createdTimeEntry.value,
      1,
    );
    expect(record[fixtures.FIELD_CODES.datetimeTarget].value).toBe(
      expectedDatetimeValue,
    );

    expect(pageErrors).toEqual([]);
  });
});
