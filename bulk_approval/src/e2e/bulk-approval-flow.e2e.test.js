'use strict';

// 一覧画面ボタン → 対象レコード選択(チェックボックス・アクション選択) → 最終確認 → 実行までの
// 実環境テスト。config-screen.e2e.test.jsが設定画面の疎通確認なのに対し、こちらは
// 「プロセス管理のアクションが実際にレコードへ反映されるか」というこのプラグインの中核機能を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様。
// 実行: pnpm run test:e2e
//
// NOTE: 一覧画面ボタンはグループによる絞り込みを行わない設計のため(idea.md「ボタンの表示制御
// について」参照)、対象アプリでプロセス管理が有効であればログインユーザーに関わらず表示される。
//
// NOTE: kintone.createDialog()が生成するOK/キャンセルボタンはkintone内部のUIコンポーネント
// (`gaia-argoui-dialog-buttons-*`)のため、`button[name="ok"]`(name属性)で特定する
// (age_grade_field_updateのbulk-update-flow.e2e.test.jsと同じ、実環境で確認済み)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { BAP_TEST_APP_ID, seedRecords } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

const clickLastOkButton = () =>
  page.evaluate(() => {
    const buttons = document.querySelectorAll('button[name="ok"]');
    buttons[buttons.length - 1].click();
  });

let browser;
let page;
let env;
let recordIds;

describe('一覧画面ボタンでの一括承認(実環境)', () => {
  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, BAP_TEST_APP_ID, pluginId);

    recordIds = await seedRecords(env, BAP_TEST_APP_ID, [
      'bap_e2e_target_1',
      'bap_e2e_target_2',
    ]);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 800 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 表示項目=件名 で保存する。
    await common.openPluginConfig(page, env, BAP_TEST_APP_ID, pluginId);
    await page.evaluate(() => {
      document.querySelector(
        '.js-display-fields input[value="bap_title"]',
      ).checked = true;
    });
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    // プラグイン設定の保存はプレビューにしか反映されないため、明示的にデプロイする
    // (project_plugin_config_needs_deploy.mdの注意点)。
    await kintoneAdmin.deployApp(env, BAP_TEST_APP_ID);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('対象レコードを選択し「申請する」を実行すると、実際のステータスが遷移する', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${BAP_TEST_APP_ID}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.bap-bulk-button'));
      },
      { timeout: 15000 },
    );

    await page.click('.bap-bulk-button');
    // 種となる2レコードはどちらも「未処理」ステータスのため、グループセクションは1つになる。
    await page.waitForSelector('.bap-status-group .bap-record-table tbody tr', {
      timeout: 15000,
    });

    const groupHeading = await page.$eval(
      '.bap-group-heading',
      (el) => el.textContent,
    );
    expect(groupHeading).toBe('未処理(2件)');

    const rowCount = await page.$$eval(
      '.bap-status-group .bap-record-table tbody tr',
      (rows) => rows.length,
    );
    expect(rowCount).toBe(2);

    // 未処理グループの実行可能なアクションとして「申請する」が候補に入っているはず。
    const optionLabels = await page.$$eval(
      '.bap-status-group .bap-action-select option',
      (opts) => opts.map((o) => o.textContent),
    );
    expect(optionLabels).toContain('申請する');

    await page.select('.bap-status-group .bap-action-select', '申請する');
    await clickLastOkButton();

    // 最終確認ダイアログへ遷移するのを待つ。
    await page.waitForSelector('.bap-confirm-body', { timeout: 15000 });
    const summaryText = await page.$eval(
      '.bap-confirm-body .bap-message',
      (el) => el.textContent,
    );
    expect(summaryText).toBe(
      '合計2件のレコードに対して、次のアクションを実行します。',
    );

    const planText = await page.$eval(
      '.bap-confirm-body .bap-plan-list',
      (el) => el.textContent,
    );
    expect(planText).toContain('「未処理」の2件 → 「申請する」を実行');

    await clickLastOkButton();

    // 実行完了(alertはbeforeAllで登録したdialogハンドラーが自動acceptする)後、
    // 実際のステータスが「承認待ち」へ遷移するまで待つ。
    await page.waitForFunction(
      (appId, ids) =>
        kintone
          .api(kintone.api.url('/k/v1/records.json', true), 'GET', {
            app: appId,
            query: `$id in (${ids.join(',')})`,
            fields: ['$id', 'ステータス'],
          })
          .then(
            (res) =>
              res.records.length === ids.length &&
              res.records.every((r) => r['ステータス'].value === '承認待ち'),
          )
          .catch(() => false),
      { timeout: 30000, polling: 1000 },
      Number(BAP_TEST_APP_ID),
      recordIds.map(Number),
    );

    expect(pageErrors).toEqual([]);
  });
});
