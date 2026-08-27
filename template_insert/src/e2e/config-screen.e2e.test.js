'use strict';

// このプラグイン固有のPuppeteerテスト。共通処理(ログイン・画面遷移・スクリーンショット保存)は
// リポジトリルートの scripts/e2e/common.js を使う。
//
// 事前準備:
//   1. pnpm run build && pnpm run upload  でこのプラグインを検証環境アプリに反映しておく
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { ensureTargetAppFields } = require('./fixtures');

const PLUGIN_NAME = 'template_insert';
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
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
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

  test('設定画面が開き、テンプレート追加とプレースホルダー挿入ボタンが機能する', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);

    const heading = await page.$eval(
      '.settings-heading',
      (el) => el.textContent,
    );
    expect(heading).toContain('テンプレート挿入プラグイン');

    // 文字列複数行・リッチエディターフィールドが存在するため警告は出ない。
    const warningsText = await page.$eval(
      '#js-warnings',
      (el) => el.textContent,
    );
    expect(warningsText).toBe('');

    // config.js が最後まで実行されないと描画されない部分
    // (静的HTMLだけでは検知できないバグをここで検知する)。
    // TEST_APP_ID_1は他プラグインのe2eテストとも共有しているため、既存のテンプレート行が
    // 0件とは限らない(このプラグイン自身の他のe2eテストファイルが先に実行された場合も含む)。
    // そのため「1件になる」という絶対数ではなく「1件増える」という相対的な変化で検証し、
    // 以降の操作はすべて末尾(今回追加した行)に対して行う。
    const rowCountBefore = await page.$$eval(
      '.js-template-row',
      (rows) => rows.length,
    );
    await page.click('#js-template-add');
    const rowCountAfter = await page.$$eval(
      '.js-template-row',
      (rows) => rows.length,
    );
    expect(rowCountAfter).toBe(rowCountBefore + 1);

    const NEW_ROW_SELECTOR = '#js-template-list > .js-template-row:last-child';
    await page.type(
      `${NEW_ROW_SELECTOR} .js-template-name`,
      'あいさつテンプレート',
    );
    await page.select(
      `${NEW_ROW_SELECTOR} .js-template-target`,
      '文字列__複数行_',
    );

    // プレースホルダー挿入ツールバー: フィールドを選んで本文へ挿入する。
    await page.select(
      `${NEW_ROW_SELECTOR} .js-template-placeholder-field`,
      '文字列__1行_',
    );
    await page.click(`${NEW_ROW_SELECTOR} .js-template-placeholder-insert`);
    const bodyValue = await page.$eval(
      `${NEW_ROW_SELECTOR} .js-template-body`,
      (el) => el.value,
    );
    expect(bodyValue).toBe('{文字列__1行_}');

    // プレースホルダー候補には、種別選択なしでも常にサブテーブルの列がoptgroupとして含まれる
    // (idea.md「繰り返しブロック([[ ]]構文)」参照)。
    const placeholderOptionValues = await page.$$eval(
      `${NEW_ROW_SELECTOR} .js-template-placeholder-field option`,
      (options) => options.map((o) => o.value),
    );
    expect(placeholderOptionValues).toContain('文字列__複数行__2');

    // 「選択範囲を[[ ]]で囲む」ボタン: 本文全体を選択してから押すと[[ ]]で囲まれる。
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      el.focus();
      el.setSelectionRange(0, el.value.length);
    }, `${NEW_ROW_SELECTOR} .js-template-body`);
    await page.click(`${NEW_ROW_SELECTOR} .js-template-wrap-repeat`);
    const wrappedBodyValue = await page.$eval(
      `${NEW_ROW_SELECTOR} .js-template-body`,
      (el) => el.value,
    );
    expect(wrappedBodyValue).toBe('[[{文字列__1行_}]]');

    expect(pageErrors).toEqual([]);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'config-screen');
  });
});
