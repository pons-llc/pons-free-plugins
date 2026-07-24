'use strict';

// 削除フロー(アーカイブ方式)の実環境テスト。設定画面でアーカイブ方式(アーカイブ先=
// DBACK_ARCHIVE_APP_ID、JSON保存先=dback_archive_json、添付ファイル保存先=dback_archive_files)を
// 明示的に保存したうえで、添付ファイル付きのテストレコードを削除し、次を確認する。
//
// アーカイブ先にTEST_APP_ID_2ではなく専用アプリ(DBACK_ARCHIVE_APP_ID)を使う理由は
// fixtures.jsのコメント参照(TEST_APP_ID_2の既存の必須フィールドにより登録が失敗するため)。
//
//   1. 削除元(TEST_APP_ID_1)のレコードが実際に削除されること。
//   2. アーカイブ先に新しいレコードが1件登録され、JSON保存先フィールドに削除された
//      レコードのappId/recordIdを含む内容が保存されていること。
//   3. 添付ファイル保存先フィールドに、再アップロードされたファイルが1件保存されており、
//      ファイル名が元のファイル名と一致すること(fileKeyそのものは仕様上コピーできないため、
//      idea.mdの通り「ダウンロード→再アップロード」を経由した結果を確認する)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  DBACK_ARCHIVE_APP_ID,
  ensureSourceAppFields,
  ensureArchiveAppFields,
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

const findLatestArchiveRecord = async (env, archiveAppId) => {
  const resp = await kintoneAdmin.request(env, '/k/v1/records.json', 'GET', {
    app: archiveAppId,
    query: 'order by $id desc limit 1',
  });
  return resp.records[0] || null;
};

describe('削除フロー(アーカイブ方式・実環境)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await ensureSourceAppFields(env, env.TEST_APP_ID_1);
    await ensureArchiveAppFields(env, DBACK_ARCHIVE_APP_ID);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // このflowテストが必要とする設定(アーカイブ方式)を明示的に保存する。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.click('.js-mode-archive');
    await page.evaluate((appId) => {
      const el = document.querySelector('.js-archive-app-id');
      el.value = appId;
      // .valueへの直接代入だけではconfig.js側のchangeイベントリスナーが発火せず、
      // config.archiveAppIdが更新されないまま(実際にこれで保存時のバリデーションエラーに
      // なり、保存されず画面遷移もされないためテストがタイムアウトすることを確認した)。
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, DBACK_ARCHIVE_APP_ID);
    await page.click('.js-fetch-fields');
    await page.waitForFunction(
      () => document.querySelector('.js-json-field').options.length > 1,
    );
    await page.select('.js-json-field', 'dback_archive_json');
    await page.select('.js-attachment-field', 'dback_archive_files');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    // プラグイン設定の保存だけではプレビュー状態のままで、レコード画面(desktop.js)側の
    // kintone.plugin.app.getConfig()には反映されない(フィールド追加等と同じくアプリの
    // デプロイが必要。実機で保存直後に削除フローを実行したところ、config.jsonFieldCode等が
    // 空のまま登録され、アーカイブ先レコードの各フィールドが空で作成される不具合を確認した)。
    // フィールド追加時と同じ`preview/app/deploy.json`でデプロイを完了させる。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('削除操作でアーカイブ先アプリにJSON・添付ファイルが保存され、元レコードが削除される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const recordId = await createSourceRecordWithFile(
      env,
      env.TEST_APP_ID_1,
      'これはアーカイブバックアップのテストファイルです。',
      'archive-test.txt',
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

    const archiveRecord = await waitUntil(async () => {
      const record = await findLatestArchiveRecord(env, DBACK_ARCHIVE_APP_ID);
      const json = record && record.dback_archive_json.value;
      return json && json.includes(`"recordId": ${recordId}`) && record;
    });

    const backup = JSON.parse(archiveRecord.dback_archive_json.value);
    expect(backup.appId).toBe(Number(env.TEST_APP_ID_1));
    expect(backup.recordId).toBe(Number(recordId));
    expect(backup.record.dback_test_file.value.length).toBe(1);

    const archivedFiles = archiveRecord.dback_archive_files.value;
    expect(archivedFiles.length).toBe(1);
    expect(archivedFiles[0].name).toBe('archive-test.txt');

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'delete-archive-flow');
    expect(pageErrors).toEqual([]);
  }, 60000);
});
