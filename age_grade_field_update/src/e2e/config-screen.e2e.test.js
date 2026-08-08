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
// このテストの主眼は「対象フィールド」プルダウンがDATE/DATETIME型のみに絞り込まれること
// (静的HTML・単体テストでは検知できない。CLAUDE.mdの開発方針1参照)と、保存後に
// kintone.plugin.app.getConfig()で実際に永続化された値を読み直せることの確認。
//
// NOTE: 一覧画面ボタンの表示(実行可能グループによるゲート)は、ログインユーザーの
// 所属グループに依存するため実環境テストの対象外としている(related_record_summaryの
// 一括集計トリガーと同様、security-checklist.md「個別確認事項」参照)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'age_grade_field_update';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TARGET_DATE_FIELD_CODE = '日付';

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

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 800 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('対象フィールドがDATE/DATETIME型のみに絞り込まれ、保存した設定が読み直せる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain(
      '年齢・学年フィールド計算用フィールド更新プラグイン',
    );

    // 対象フィールドの候補: DATE/DATETIME型のフィールドコードのみが出る
    // (SINGLE_LINE_TEXT等の他の型は含まれない)。
    const optionValues = await page.$$eval(
      '.js-target-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(optionValues).toContain(TARGET_DATE_FIELD_CODE);
    expect(optionValues).not.toContain('文字列__1行_');

    await page.select('.js-target-field', TARGET_DATE_FIELD_CODE);
    await page.type('.js-query', 'ステータス = "未処理"');
    await page.type('.js-group-codes', 'Administrators');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');

    // 保存後はアプリのプロセス管理設定画面へ遷移する(config.jsの仕様、related_record_summaryと
    // 同じ)。setConfig()直後の値はデプロイ(kintoneAdmin.deployApp)を経なくても
    // getConfig()でプレビューとして読み直せるため、設定画面を再度開いてフォームへの
    // 反映で保存内容を検証する(project_plugin_config_needs_deploy.mdの「デプロイが必要なのは
    // 非設定画面での反映」の裏返し)。
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const reloadedTargetField = await page.$eval(
      '.js-target-field',
      (el) => el.value,
    );
    const reloadedQuery = await page.$eval('.js-query', (el) => el.value);
    const reloadedGroupCodes = await page.$eval(
      '.js-group-codes',
      (el) => el.value,
    );
    expect(reloadedTargetField).toBe(TARGET_DATE_FIELD_CODE);
    expect(reloadedQuery).toBe('ステータス = "未処理"');
    expect(reloadedGroupCodes).toBe('Administrators');
  });
});
