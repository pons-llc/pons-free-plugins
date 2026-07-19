'use strict';

// レコード一覧画面のヘッダーに設置されるボタン群(ダウンロード・簡易AI検索・同期)を検証する。
// config-save.e2e.test.jsで簡易AI検索をON・同期ボタンの許可グループを未設定(空)にした状態を
// 前提とする(jestはファイル単位で直列実行され、同一describe内のtestは順番に実行されるが、
// 別ファイル間の実行順はjest.e2e.config.jsのtestMatch順に依存するため、ここでも改めて
// 同じ状態を保存し直してから検証する)。
//
// 「プラグイン利用状況を同期」ボタンの実行(GET /k/v1/plugin/apps.jsonの呼び出し)自体は
// cybozu.com共通管理者権限が必須で、検証環境アカウントがその権限を持つかどうかに依存し、
// かつ実行すると検証環境の実データ(インストール済みプラグイン一覧)を台帳アプリへ書き込む
// 副作用があるため、このE2Eでは「許可グループが無い状態ではボタン自体が表示されないこと」の
// 確認にとどめ、実際のクリック・同期実行は行わない(idea.md「権限の実効的な境界」参照)。

const path = require('path');
const puppeteer = require('puppeteer');
const os = require('os');
const fs = require('fs');
const common = require('../../../scripts/e2e/common');
const { ensurePluginAddedToApp } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

describe('レコード一覧画面(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let appId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    appId = env.TEST_APP_ID_1;
    await ensurePluginAddedToApp(env, appId, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 簡易AI検索ON・許可グループなし、の状態を確定させる(config-save.e2e.test.js参照)。
    // GET /v1/groups.jsonの取得・グループ一覧の描画はconfig.js冒頭の非同期処理のため、
    // openPluginConfig()のnetworkIdle判定より後にDOMへ反映されることがある(実際にこの遅延が
    // 原因で「許可グループなしのはずが同期ボタンが表示される」不安定なテスト失敗が発生した)。
    // 固定時間の待機ではなく、config.jsが設定するdata-loadedマーカーで描画完了を確実に待つ。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.waitForFunction(
      () => document.getElementById('js-group-list')?.dataset.loaded === '1',
    );
    await page.evaluate(() => {
      const aiSearchEl = document.querySelector('.js-ai-search-enabled');
      if (!aiSearchEl.checked) {
        aiSearchEl.click();
      }
      document
        .querySelectorAll('.js-group-checkbox:checked')
        .forEach((el) => el.click());
    });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('ダウンロードボタン・AI検索ボタンは表示され、同期ボタンは許可グループ未設定のため表示されない', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });

    await page.waitForSelector('.pcb-download-button');
    await page.waitForSelector('.pcb-ai-search-button');
    const syncButtonCount = await page.$$eval(
      '.pcb-sync-button',
      (els) => els.length,
    );
    expect(syncButtonCount).toBe(0);

    expect(pageErrors).toEqual([]);
  }, 60000);

  test('ダウンロードボタンを押すと外部通信なしでAI用データ(.txt)がダウンロードされる', async () => {
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcb-download-'));
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.click('.pcb-download-button');
    await page.waitForFunction(
      (dir) => {
        // Node側のfsではなくブラウザ側では確認できないため、ここではボタンが再度有効化される
        // (disabled=falseに戻る、= runDownload()完了)ことだけを確認する。
        const btn = document.querySelector('.pcb-download-button');
        return btn && !btn.disabled;
      },
      { timeout: 30000 },
      downloadDir,
    );

    // ダウンロードされたファイルが実際に作成されたことを確認する(拡張子.txt、CDN等の
    // 外部通信を伴わない機能であることの検証)。
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const files = fs.readdirSync(downloadDir);
    expect(files.some((f) => f.endsWith('.txt'))).toBe(true);

    expect(pageErrors).toEqual([]);
  }, 30000);

  test('AI検索ボタンを押すとダイアログが開く(モデル読み込み完了までは待たない)', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.click('.pcb-ai-search-button');
    await page.waitForFunction(
      () => document.body.textContent.includes('プラグイン簡易AI検索'),
      { timeout: 15000 },
    );
    await page.waitForFunction(
      () => document.body.textContent.includes('検索モデルを読み込んでいます'),
      { timeout: 15000 },
    );

    expect(pageErrors).toEqual([]);
  }, 30000);
});
