'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build を実行し、cli-kintone plugin upload で検証環境アプリ(TEST_APP_ID_1)に
//      アップロード済みであること(pnpm run uploadは--watchで常駐するため単発実行を推奨)
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済み
//
// 実行: pnpm run test:e2e
//
// このテストの主眼:
//   - 設定画面が開けてコンソールエラーが出ないこと
//   - 役割の切り替えで依頼/回答のセクション表示が切り替わること(config.jsのDOM配線の回帰確認)
//   - 未入力保存でバリデーションエラーがtextContentで表示されること
//   - 公開サイト用スクリーンショットを1枚保存すること
//
// NOTE: 「必要な項目・一覧の自動作成」はTEST_APP_ID_1(汎用テストアプリ)に大量の予備フィールドを
// 追加してしまい他プラグインのE2Eと環境を共有できなくなるため、このテストでは実行しない。
// 自動作成〜フォーム描画〜分析までの通し確認は専用アプリでの手動確認とする(idea.md 4.4)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');

const PLUGIN_NAME = 'research_and_answer';
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
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、役割の切り替え・バリデーションが動作する', async () => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('照会回答パッケージプラグイン');

    // 役割を未選択に戻すと自動作成ボタンが無効になる(保存済み設定の有無に依存しないよう、
    // 明示的に未選択へ切り替えてから確認する)
    await page.select('#js-role', '');
    expect(await page.$eval('#js-generate', (el) => el.disabled)).toBe(true);

    // 役割切り替えでセクションの表示が切り替わる
    await page.select('#js-role', 'request');
    expect(
      await page.$eval('#js-request-settings', (el) => el.style.display),
    ).not.toBe('none');
    expect(
      await page.$eval('#js-answer-settings', (el) => el.style.display),
    ).toBe('none');
    expect(await page.$eval('#js-generate', (el) => el.disabled)).toBe(false);

    await page.select('#js-role', 'answer');
    expect(
      await page.$eval('#js-request-settings', (el) => el.style.display),
    ).toBe('none');
    expect(
      await page.$eval('#js-answer-settings', (el) => el.style.display),
    ).not.toBe('none');

    // デフォルト値が入っていること
    expect(await page.$eval('#js-form-space', (el) => el.value)).toBe(
      'form_space',
    );
    expect(await page.$eval('#js-list-view', (el) => el.value)).toBe(
      '集計リスト',
    );
    expect(await page.$eval('#js-analysis-view', (el) => el.value)).toBe(
      '分析',
    );

    // 公開サイト用スクリーンショット(代表1枚。エラー表示前のきれいな状態で撮る)
    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');

    // 依頼アプリID未入力のままSaveするとバリデーションエラーが表示される(保存されない)
    await page.$eval('#js-request-app-id', (el) => (el.value = ''));
    await page.click('.kintoneplugin-button-dialog-ok');
    const errorText = await page.$eval('#js-errors', (el) => el.textContent);
    expect(errorText).toContain('依頼アプリのアプリID');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
