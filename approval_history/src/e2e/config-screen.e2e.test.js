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
// このテストはSaveを押さず、config.js冒頭の非同期処理(kintone.app.getFormFields()・
// GET /k/v1/preview/app/status.json・作成済み判定の描画)が実際に最後まで動くことだけを確認する
// (静的HTMLだけでは検知できない。CLAUDE.mdの開発方針1参照)。公開サイト用のスクリーンショットは
// このテストで撮影する(CLAUDE.md開発方針8「1枚あれば良い」)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'approval_history';
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
    // 新規プラグインのため、初回実行時はTEST_APP_ID_1にまだ追加されていない(冪等)。
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

  test('設定画面が開き、プロセス管理・決裁履歴テーブルの状態がconfig.jsにより描画される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('決裁者稟議者記録プラグイン');

    // config.js冒頭の非同期処理(getFormFields()・status.json取得)が終わるまで描画されない部分。
    const processStatusText = await page.$eval(
      '#js-process-status',
      (el) => el.textContent,
    );
    expect(processStatusText).toContain('プロセス管理');

    const tableStatusText = await page.$eval(
      '#js-table-status',
      (el) => el.textContent,
    );
    expect(tableStatusText.length).toBeGreaterThan(0);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
