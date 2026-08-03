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
// 主眼は「HTML/CSS/JSフィールドの候補が文字列複数行(MULTI_LINE_TEXT)フィールドのみに
// 絞り込まれること」の回帰確認(静的HTML・単体テストでは検知できない、CLAUDE.md開発方針1参照)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  HTML_FIELD_CODE,
  CSS_FIELD_CODE,
  JS_FIELD_CODE,
} = require('./fixtures');

const PLUGIN_NAME = 'genai_app_share';
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
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('設定画面が開き、HTML/CSS/JSフィールドの候補が文字列複数行フィールドに絞り込まれる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('生成AIアプリ共有');

    const htmlOptionValues = await page.$$eval(
      '.js-html-field option',
      (options) => options.map((o) => o.value).filter((v) => v !== ''),
    );
    expect(htmlOptionValues).toContain(HTML_FIELD_CODE);
    expect(htmlOptionValues).toContain(CSS_FIELD_CODE);
    expect(htmlOptionValues).toContain(JS_FIELD_CODE);
    // REFERENCE_TABLE等、MULTI_LINE_TEXT以外のフィールドは候補に出ない。
    expect(htmlOptionValues).not.toContain('関連レコード一覧');

    await page.select('.js-html-field', HTML_FIELD_CODE);
    await page.select('.js-css-field', CSS_FIELD_CODE);
    await page.select('.js-js-field', JS_FIELD_CODE);

    // 実行方式は2択(blob/data)。永続化された前回の状態に依存しないよう、ここで明示的に
    // blobを選び直してから検証する(他のE2Eテストファイルがdataを保存している場合があるため、
    // html/css/jsフィールドの選択と同じく能動的に操作して確認する)。
    const executionModeValues = await page.$$eval('.js-execution-mode', (els) =>
      els.map((el) => el.value),
    );
    expect(executionModeValues.sort()).toEqual(['blob', 'data']);
    await page.click('.js-execution-mode[value="blob"]');
    const checkedExecutionMode = await page.$eval(
      '.js-execution-mode:checked',
      (el) => el.value,
    );
    expect(checkedExecutionMode).toBe('blob');

    await page.evaluate(() => {
      const el = document.querySelector('.js-enable-react');
      if (el.checked) {
        el.click();
      }
    });
    const enableReactChecked = await page.$eval(
      '.js-enable-react',
      (el) => el.checked,
    );
    expect(enableReactChecked).toBe(false);

    // 保存(setConfig+デプロイ)はdetail-link.e2e.test.jsのensureConfigured()が別途担うため、
    // このテストではUIの絞り込み確認だけを行い、保存はしない(保存すると設定画面から離脱してしまい、
    // 公開サイト用のスクリーンショットが撮れなくなるため)。
    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  }, 60000);
});
