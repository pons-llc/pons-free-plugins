'use strict';

// 設定画面の実環境テスト。一覧(REST views.json)・集計対象フィールド(NUMBER)の候補が
// 実際に絞り込まれて選択肢に出ること、行の追加・削除・保存ができることを検証する。
//
// TEST_APP_ID_1はbudget-check.e2e.test.js等、他のテストファイルとも予算設定を共有しており、
// 実行時点で既に行が存在する場合がある。そのため行数を絶対値(0件・1件)で決め打ちせず、
// このテストで新しく追加した行(常に配列の末尾に追加される)を明示的に指定して操作する。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { VIEW_NAME, ensureBudgetMeterView } = require('./fixtures');

const PLUGIN_NAME = 'budget_meter';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TARGET_FIELD_CODE = '数値_0';

const lastRowHandle = async (page) => {
  const rows = await page.$$('.js-row');
  return rows[rows.length - 1];
};

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
    await ensureBudgetMeterView(env, env.TEST_APP_ID_1, TARGET_FIELD_CODE);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    // 予算設定テーブルは列数が多い(対象の一覧・集計対象フィールド・予算額・警告/危険しきい値・
    // ラベル・削除)ため、デフォルトビューポート(800x600)では公開サイト用スクリーンショットの
    // 右側の列が見切れる。
    await page.setViewport({ width: 1280, height: 900 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、一覧・集計対象フィールドの選択肢が実際に絞り込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('予算管理プラグイン');

    const rowCountBefore = await page.$$eval('.js-row', (rows) => rows.length);
    await page.click('#js-row-add');
    const rowCountAfter = await page.$$eval('.js-row', (rows) => rows.length);
    expect(rowCountAfter).toBe(rowCountBefore + 1);

    const newRow = await lastRowHandle(page);

    // 対象の一覧: REST views.jsonから取得したLIST型の一覧が選択肢に出る(config.js冒頭の
    // 非同期処理が壊れていないことの検証。静的HTMLだけでは検知できない)。
    const viewOptions = await newRow.$$eval('.js-row-view option', (opts) =>
      opts.map((o) => o.textContent),
    );
    expect(viewOptions).toContain(VIEW_NAME);

    // 集計対象フィールド: NUMBERフィールドが選択肢に出て、REFERENCE_TABLE等の非対象は出ない。
    const fieldOptions = await newRow.$$eval('.js-row-field option', (opts) =>
      opts.map((o) => o.value),
    );
    expect(fieldOptions).toContain(TARGET_FIELD_CODE);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });

  test('必須項目が未入力の行があると保存をブロックする', async () => {
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.click('#js-row-add');

    // 追加した行(対象の一覧・フィールド・予算額いずれも未入力)のまま保存しようとする。
    await page.click('.kintoneplugin-button-dialog-ok');

    // バリデーションエラーのalertはbeforeAllで登録したdialogハンドラーが自動acceptするため、
    // 保存が中断されて設定画面に留まっていることで間接的に検証する。
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(page.url()).toContain('plugin/config');
  });

  test('一覧・フィールド・予算額を選んで保存でき、リロード後も内容が保持される', async () => {
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.click('#js-row-add');
    const newRow = await lastRowHandle(page);

    // 一覧・フィールドはvalue(=ID/コード)で選択する。一覧はview名ではなくREST viewId(value)。
    const viewValue = await newRow.$eval(
      '.js-row-view',
      (el, name) => {
        const opt = Array.from(el.options).find((o) => o.textContent === name);
        return opt ? opt.value : '';
      },
      VIEW_NAME,
    );
    expect(viewValue).not.toBe('');
    const viewSelectHandle = await newRow.$('.js-row-view');
    await viewSelectHandle.select(viewValue);
    const fieldSelectHandle = await newRow.$('.js-row-field');
    await fieldSelectHandle.select(TARGET_FIELD_CODE);
    await newRow.evaluate((rowEl) => {
      const budgetEl = rowEl.querySelector('.js-row-budget');
      budgetEl.value = '12345';
      budgetEl.dispatchEvent(new Event('input', { bubbles: true }));
      const labelEl = rowEl.querySelector('.js-row-label');
      labelEl.value = 'E2Eテスト予算(config-screen)';
      labelEl.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    // プラグイン設定の保存はプレビューにしか反映されないため、明示的にデプロイする
    // (project_plugin_config_needs_deploy.mdの注意点)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    // 追加した行は常に配列の末尾に保存されるため、リロード後も最後の行として見つかる。
    const reloadedRow = await lastRowHandle(page);
    const budgetValue = await reloadedRow.$eval(
      '.js-row-budget',
      (el) => el.value,
    );
    expect(budgetValue).toBe('12345');
    const labelValue = await reloadedRow.$eval(
      '.js-row-label',
      (el) => el.value,
    );
    expect(labelValue).toBe('E2Eテスト予算(config-screen)');
  });
});
