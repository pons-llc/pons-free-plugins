'use strict';

// 設計書ダウンロードの実環境テスト。TEST_APP_ID_1にTEST_APP_ID_2を参照するLOOKUPフィールドを
// 用意したうえで(fixtures.js)、実際に「設計書をダウンロード」ボタンを押し、
//   1. zipファイルが実際にダウンロードされること(CDPのPage.setDownloadBehaviorで検証)
//   2. zipの中に起点アプリ(TEST_APP_ID_1)・関連アプリ(TEST_APP_ID_2)それぞれの.txtファイルと
//      metadata.txtが含まれること(`unzip`コマンドで列挙・内容確認。ZIP自体の構造検証は
//      unit test(build-zip.test.js)で済んでいるため、ここでは中身の妥当性のみ確認する)
//   3. metadata.txtにルックアップフィールドによるアプリ間の関係が記録されていること
// を確認する(12種類のREST呼び出し・カスタマイズファイルのダウンロード・zip生成という
// 一連の実処理が、実際のkintoneレスポンス形式に対して壊れていないことを検証する)。

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { ensureLookupSetup, LOOKUP_FIELD_CODE } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

const waitUntil = async (
  predicate,
  { timeoutMs = 30000, intervalMs = 500 } = {},
) => {
  const startedAt = Date.now();
  for (;;) {
    const result = await predicate();
    if (result) {
      return result;
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('タイムアウトしました。');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};

describe('設計書ダウンロード(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let downloadDir;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    await ensureLookupSetup(env, env.TEST_APP_ID_1, env.TEST_APP_ID_2);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await common.login(page, env);

    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notebooklm-export-'));
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('ダウンロードボタン押下で、起点・関連アプリ両方の設計書を含むzipが得られる', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.click('.js-download-button');

    const zipFileName = await waitUntil(() => {
      const found = fs
        .readdirSync(downloadDir)
        .find((name) => name.endsWith('.zip') && !name.endsWith('.crdownload'));
      return found || null;
    });
    const zipPath = path.join(downloadDir, zipFileName);

    expect(zipFileName).toMatch(
      new RegExp(`^design_export_app${env.TEST_APP_ID_1}_\\d+\\.zip$`),
    );

    const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
    expect(listing).toContain('metadata.txt');
    expect(listing).toContain(`app_${env.TEST_APP_ID_1}.txt`);
    expect(listing).toContain(`app_${env.TEST_APP_ID_2}.txt`);

    const metadata = execFileSync('unzip', ['-p', zipPath, 'metadata.txt'], {
      encoding: 'utf8',
    });
    expect(metadata).toContain(LOOKUP_FIELD_CODE);
    expect(metadata).toContain(env.TEST_APP_ID_1);
    expect(metadata).toContain(env.TEST_APP_ID_2);

    const progressText = await page.$eval('#js-progress', (el) => el.textContent);
    expect(progressText).toContain('完了しました');

    expect(pageErrors).toEqual([]);
  }, 60000);
});
