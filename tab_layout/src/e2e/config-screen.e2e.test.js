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
// このテストの主眼は「アンカーとなるスペースフィールド」のプルダウンに実際の選択肢が
// 出ることの回帰確認。過去に kintone.app.getFormLayout() の戻り値を
// `formLayoutResponse.layout` として参照する誤り(戻り値自体がREST APIの`layout`プロパティと
// 同様の値であり、`{ layout: [...] }`でラップされていない)があり、スペースフィールドが
// アプリに存在していてもプルダウンの選択肢が常にゼロになるバグが実環境でのみ顕在化した
// (静的HTML・単体テストでは検知できない。CLAUDE.mdの開発方針1参照)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const { ensureAnchorSpacer } = require('./fixtures');

const PLUGIN_NAME = 'tab_layout';
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
    await ensureAnchorSpacer(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、アンカーとなるスペースフィールドの選択肢が実際に表示される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('タブ表示プラグイン');

    // スペースフィールドが1件もない場合の警告は非表示のはず(fixtures.jsで確保済み)
    const warningHidden = await page.$eval(
      '#js-no-space-warning',
      (el) => el.hidden,
    );
    expect(warningHidden).toBe(true);

    // タブグループを1つ追加すると、アンカー用のスペース選択プルダウンが描画される
    await page.click('#js-layout-add');
    await page.waitForSelector('.js-layout-space');

    // config.js冒頭のkintone.app.getFormLayout()呼び出しの戻り値の扱いが壊れていると、
    // ここが「(選択してください)」のプレースホルダーだけになり、実オプションが0件になる
    // (実際にこの誤りで発生した不具合の回帰テスト)。
    const spaceOptionValues = await page.$$eval(
      '.js-layout-space option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(spaceOptionValues.length).toBeGreaterThan(0);

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
