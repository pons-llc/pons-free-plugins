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
// このテストの主眼は、対象者フィールド(USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECT)・
// 繰り返し用日付フィールド(DATE)の候補一覧が正しく出ること、テンプレート対象フィールド一覧が
// 対象者フィールド・ルックアップ・テーブル等を正しく除外していること(静的HTML・単体テストでは
// 検知できない。CLAUDE.mdの開発方針1参照)、設定の保存・読み直しができること、
// 保存後にデプロイすれば一覧画面にボタンが表示されることの確認。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'bulk_record_creation';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面・一覧画面ボタン(実環境)', () => {
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

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1100 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  const templateRowLabels = () =>
    page.$$eval('#js-template-field-body tr', (rows) =>
      rows.map((row) => row.children[1].textContent),
    );

  test('候補一覧の絞り込み・保存・再読込・一覧画面ボタン表示までの一連の流れ', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('レコード一括作成プラグイン');

    // 対象者フィールド候補: USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECTのみ。
    const assigneeOptions = await page.$$eval(
      '#js-assignee-field-code option',
      (opts) => opts.map((o) => o.textContent),
    );
    expect(assigneeOptions.some((t) => t.includes('ユーザー選択'))).toBe(true);
    expect(assigneeOptions.some((t) => t.includes('組織選択'))).toBe(true);
    expect(assigneeOptions.some((t) => t.includes('グループ選択'))).toBe(true);
    expect(assigneeOptions.some((t) => t.includes('日付'))).toBe(false);

    // 繰り返し用日付フィールド候補: DATE型のみ。
    const dateOptions = await page.$$eval(
      '#js-date-field-code option',
      (opts) => opts.map((o) => o.textContent),
    );
    expect(dateOptions.some((t) => t.includes('日付'))).toBe(true);
    expect(dateOptions.some((t) => t.includes('ユーザー選択'))).toBe(false);

    // テンプレート対象フィールド一覧: 対象者フィールド系・テーブル・ルックアップ・
    // 対象外システムフィールドは含まれない。
    let rowLabels = await templateRowLabels();
    expect(rowLabels.some((l) => l.includes('ユーザー選択'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('組織選択'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('グループ選択'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('テーブル'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('(ne_lookup)'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('レコード番号'))).toBe(false);
    expect(rowLabels.some((l) => l.includes('(文字列__1行_)'))).toBe(true);

    // 対象者フィールド・繰り返し用日付フィールドを選択する。
    await page.select('#js-assignee-field-code', 'ユーザー選択');
    await page.select('#js-date-field-code', '日付');

    // 日付フィールドを選択すると、テンプレート一覧からそのフィールド自体が除外される。
    rowLabels = await templateRowLabels();
    expect(rowLabels.some((l) => l.includes('(日付)'))).toBe(false);
    // 他の日付フィールド(日付_0等)はテンプレート対象のまま残る。
    expect(rowLabels.some((l) => l.includes('(日付_0)'))).toBe(true);

    const findRow = async (fieldCodeFragment) => {
      const rows = await page.$$('#js-template-field-body tr');
      for (const row of rows) {
        const label = await row.$eval(':nth-child(2)', (el) => el.textContent);
        if (label.includes(fieldCodeFragment)) {
          return row;
        }
      }
      throw new Error(`row not found: ${fieldCodeFragment}`);
    };

    const textRow = await findRow('(文字列__1行_)');
    await textRow.$eval('input[type="checkbox"]', (el) => {
      el.checked = true;
    });
    const checkboxRow = await findRow('(チェックボックス)');
    await checkboxRow.$eval('input[type="checkbox"]', (el) => {
      el.checked = true;
    });

    await page.evaluate(() => {
      document.querySelector('.js-group-codes').value = 'Administrators';
    });

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');

    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const reloadedAssignee = await page.$eval(
      '#js-assignee-field-code',
      (el) => el.value,
    );
    expect(reloadedAssignee).toBe('ユーザー選択');
    const reloadedDate = await page.$eval(
      '#js-date-field-code',
      (el) => el.value,
    );
    expect(reloadedDate).toBe('日付');

    const reloadedTextRow = await findRow('(文字列__1行_)');
    const reloadedTextChecked = await reloadedTextRow.$eval(
      'input[type="checkbox"]',
      (el) => el.checked,
    );
    expect(reloadedTextChecked).toBe(true);

    // プラグイン設定の保存はプレビュー環境にのみ反映されるため、一覧画面等の本番相当の
    // 画面でボタンを表示させるにはアプリのデプロイが必要(project_plugin_config_needs_deploy参照)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.brc-bulk-button', { timeout: 15000 });
    const buttonText = await page.$eval(
      '.brc-bulk-button',
      (el) => el.textContent,
    );
    expect(buttonText).toBe('レコードを一括作成');
  });
});
