'use strict';

// natural_text_dashboard 固有のPuppeteerスモークテスト。共通処理は scripts/e2e/common.js、
// アプリへのプラグイン追加・デプロイは scripts/kintone-admin.js の ensurePluginAdded()/deployApp() を使う。
//
// 実際のAI API呼び出し(Gemini/OpenAI/Claude)は本物のAPIキーが要るためここではテストしない。
// 確認するのはkintone側の配線(ボタン設置・現在のクエリの取得・接続設定モーダル・
// チャット+ダッシュボードのワークスペースが正しく開くこと)のみ。
//
// 事前準備:
//   1. pnpm run build でこのプラグインの dist/plugin.zip を作る
//      (中身のJSは先に ../engine で `pnpm run build` してsrc/js/dashboard.bundle.jsを更新しておくこと)
//   2. .env に KINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORD / TEST_APP_ID_1 が設定済みであること
//
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('natural_text_dashboard ワークフロー(実環境スモークテスト)', () => {
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
    await page.setViewport({ width: 1440, height: 960 });
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('一覧画面にボタンが出て、接続設定モーダル→チャット+ダッシュボードのワークスペースまで開ける', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });

    await page.waitForSelector('.ntd-toolbar-btn', { timeout: 15000 });
    const buttonText = await page.$eval('.ntd-toolbar-btn', (el) => el.textContent);
    expect(buttonText).toContain('現在のクエリでダッシュボードを作成');

    await page.click('.ntd-toolbar-btn');
    await page.waitForSelector('.ntd-setup-form', { timeout: 10000 });

    // プロバイダ選択のoptionが3つ(Gemini/OpenAI/Claude)そろっていることを確認
    const providerOptions = await page.$$eval('.ntd-setup-form select', (selects) =>
      Array.from(selects[0].options).map((o) => o.value),
    );
    expect(providerOptions).toEqual(['gemini', 'openai', 'claude']);

    // 送信内容の開示(送信される項目一覧)が表示されていることを確認
    const disclosureText = await page.$eval('.ntd-setup-disclosure', (el) => el.textContent);
    expect(disclosureText).toContain('絞り込み条件');

    // site/plugins/natural_text_dashboard/screenshots/config-screen.png として公開サイトから参照する
    await common.screenshot(page, repoRoot, 'natural_text_dashboard', 'config-screen');

    await page.type('.ntd-setup-form input[type="password"]', 'dummy-api-key-for-smoke-test');

    // 同意チェックボックス未チェックだとネイティブのrequired検証で送信がブロックされることを確認
    await page.click('.ntd-setup-form button[type="submit"]');
    const workspaceBeforeConsent = await page.$('.ntd-workspace');
    expect(workspaceBeforeConsent).toBeNull();

    await page.click('.ntd-setup-consent input[type="checkbox"]');
    await Promise.all([
      page.waitForSelector('.ntd-workspace', { timeout: 10000 }),
      page.click('.ntd-setup-form button[type="submit"]'),
    ]);

    const hasChatCol = (await page.$('.ntd-chat-col')) !== null;
    const hasDashCol = (await page.$('.ntd-dash-col')) !== null;
    expect(hasChatCol).toBe(true);
    expect(hasDashCol).toBe(true);

    const systemMessage = await page.$eval('.ntd-chat-msg.system', (el) => el.textContent);
    expect(systemMessage).toContain('ダッシュボード');

    const downloadBtnText = await page.$eval('.ntd-download-btn', (el) => el.textContent);
    expect(downloadBtnText).toContain('ダウンロード');

    expect(pageErrors).toEqual([]);

    await common.screenshotToDirectory(
      page,
      path.join(repoRoot, 'natural_text_dashboard', 'screenshots'),
      'workspace-smoke',
    );
  });
});
