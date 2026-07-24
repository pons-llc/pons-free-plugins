'use strict';

// 削除フロー(zip方式)の実環境テスト。設定画面でzip方式を明示的に保存したうえで
// (実行順序に依存しないよう、他のflowテストの設定を上書きしても問題ない設計にしている)、
// 添付ファイル付きのテストレコードを作成し、レコード詳細画面から削除操作を行う。
//
// 確認する内容:
//   1. zipファイルが実際にブラウザからダウンロードされること(CDPのPage.setDownloadBehaviorで
//      ダウンロード先を一時ディレクトリに固定して検証する)。
//   2. ダウンロードされたファイルの先頭4バイトがZIPのローカルファイルヘッダーシグネチャ
//      (0x04034b50)であること(詳細なZIP構造のパースはunit test(build-zip.test.js)で検証済み)。
//   3. バックアップ後、レコードが実際に削除されること(REST APIで404になることを確認)。

const path = require('path');
const fs = require('fs');
const os = require('os');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  ensureSourceAppFields,
  createSourceRecordWithFile,
} = require('./fixtures');
const { openDeleteConfirmation, confirmDelete } = require('./delete-ui');

const PLUGIN_NAME = 'delete_backup';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

const waitUntil = async (
  predicate,
  { timeoutMs = 20000, intervalMs = 500 } = {},
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

const recordExists = async (env, appId, recordId) => {
  try {
    await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
      app: appId,
      id: recordId,
    });
    return true;
  } catch {
    return false;
  }
};

describe('削除フロー(zip方式・実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;
  let downloadDir;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureSourceAppFields(env, env.TEST_APP_ID_1);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // このflowテストが必要とする設定(zip方式)を明示的に保存する。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.click('.js-mode-zip');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    // プラグイン設定の保存だけではプレビュー状態のままでレコード画面には反映されないため、
    // フィールド追加時と同じ`preview/app/deploy.json`でデプロイを完了させる
    // (delete-archive-flow.e2e.test.jsで実際に踏んだ不具合と同じ原因、詳細はそちらのコメント参照)。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);

    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dback-zip-'));
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

  test('削除操作でzipがダウンロードされ、レコードが削除される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const recordId = await createSourceRecordWithFile(
      env,
      env.TEST_APP_ID_1,
      'これはzipバックアップのテストファイルです。',
      'zip-test.txt',
    );

    await openDeleteConfirmation(
      page,
      env.KINTONE_DOMAIN,
      env.TEST_APP_ID_1,
      recordId,
    );
    await confirmDelete(page);

    await waitUntil(
      async () => !(await recordExists(env, env.TEST_APP_ID_1, recordId)),
    );

    const zipFileName = `backup_app${env.TEST_APP_ID_1}_record${recordId}.zip`;
    await waitUntil(() => fs.existsSync(path.join(downloadDir, zipFileName)));

    const zipBytes = fs.readFileSync(path.join(downloadDir, zipFileName));
    expect(zipBytes.length).toBeGreaterThan(0);
    // ZIPのローカルファイルヘッダーシグネチャ(先頭4バイト、リトルエンディアン)。
    expect(zipBytes.readUInt32LE(0)).toBe(0x04034b50);

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'delete-zip-flow');
    expect(pageErrors).toEqual([]);
  }, 60000);
});
