'use strict';

// このプラグイン固有のPuppeteerテスト。実環境での動作検証自体はユーザーが別途実施済みのため、
// ここでは公開サイト用のスクリーンショットを撮る最小限のテストのみを置く
// (設定画面が開けること・config.jsの描画が壊れていないことの疎通確認を兼ねる)。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリにアップロードしておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');

const PLUGIN_NAME = 'wareki_date_format';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('設定画面(実環境, スクリーンショット取得用)', () => {
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
    // 設定画面の変換ペア表(フィールド選択×2+書式+全角+プレビュー+削除)は既定の800pxビューポートだと
    // 横に収まらずスクリーンショットが右側で切れるため、幅を広げておく。
    await page.setViewport({ width: 1280, height: 800 });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、変換ペアと元号テーブルの入力例を表示できる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('西暦和暦変換プラグイン');

    // 変換ペアを1件追加し、フィールド・書式・全角オプションを設定してプレビューが描画されることを確認する。
    await page.click('#js-pair-add');
    await page.select('.js-pair-source', '日付');
    await page.select('.js-pair-target', '文字列__1行_');
    await page.select('.js-pair-preset', 'WAREKI_WITH_SEIREKI');
    await page.click('.js-pair-zenkaku');

    const previewText = await page.$eval(
      '.js-pair-preview',
      (el) => el.textContent,
    );
    expect(previewText.length).toBeGreaterThan(0);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
