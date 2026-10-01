'use strict';

// 設定画面の疎通確認(Saveは押さない)。config.js冒頭の非同期処理(getFormFields()/getFormLayout()・
// 指摘できるフィールド一覧の描画)が最後まで動くことを確認し、公開サイト用のスクリーンショットを撮る
// (CLAUDE.md開発方針8)。
//
// 事前準備: pnpm run build && cli-kintone plugin upload(.env設定済み)
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_NAME = 'record_review';
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
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_2, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await common.login(page, env);
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、指摘履歴テーブルの状態と指摘できるフィールド一覧が描画される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_2, pluginId);
    await page.waitForSelector('.js-target-checkbox', { timeout: 15000 });

    const heading = await page.$eval('.settings-heading', (el) => el.textContent);
    expect(heading).toContain('レコード指摘改善プラグイン');

    const tableStatus = await page.$eval('#js-table-status', (el) => el.textContent);
    expect(tableStatus.length).toBeGreaterThan(0);

    const targetCodes = await page.$$eval('.js-target-checkbox', (els) =>
      els.map((el) => el.value),
    );
    // 通常フィールドは候補に入り、システムフィールド・指摘履歴テーブル自身は入らない。
    expect(targetCodes).toContain('文字列__1行_');
    expect(targetCodes).toContain('数値');
    expect(targetCodes).not.toContain('ステータス');
    expect(targetCodes).not.toContain('作成者');
    expect(targetCodes).not.toContain('review_comment_table');

    // すべて解除 → 保存で、1つ以上選択のバリデーションエラーになる(保存はされない)。
    await page.$eval('.js-select-none', (el) => el.click());
    await page.$eval('.js-save-button', (el) => el.click());
    const error = await page.$eval('#js-errors', (el) => ({
      hidden: el.hidden,
      text: el.textContent,
    }));
    expect(error.hidden).toBe(false);
    expect(error.text).toContain('1つ以上選択');
    await page.$eval('.js-select-all', (el) => el.click());
    await page.$eval('#js-errors', (el) => {
      el.hidden = true;
    });

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
