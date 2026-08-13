'use strict';

// articles/delete-backup/setup.js
// 記事「kintoneでレコードを削除する前にバックアップする方法」用に ARTICLE_APP_ID を白紙に戻し、
// delete_backup プラグイン(zip方式)で「添付ファイル付きレコードを削除すると、削除前にzipが
// 自動ダウンロードされる」デモを実行してスクリーンショットを撮る
// (scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/delete-backup/setup.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../delete_backup/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'delete-backup';
const TITLE_FIELD_CODE = '件名';
const FILE_FIELD_CODE = '添付ファイル';

// ファイルアップロードAPIはmultipart/form-data専用のため、Node標準fetch/FormData/Blobで
// 直接呼び出す(delete_backup/src/e2e/fixtures.jsのuploadTestFileと同じ方針)。
const uploadTestFile = async (env, content, filename, contentType) => {
  const domain = env.KINTONE_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const auth = Buffer.from(`${env.KINTONE_USERNAME}:${env.KINTONE_PASSWORD}`).toString(
    'base64',
  );
  const formData = new FormData();
  formData.append('file', new Blob([content], { type: contentType }), filename);
  const resp = await fetch(`https://${domain}/k/v1/file.json`, {
    method: 'POST',
    headers: { 'X-Cybozu-Authorization': auth },
    body: formData,
  });
  if (!resp.ok) {
    throw new Error(`file upload failed: ${resp.status} ${await resp.text()}`);
  }
  const body = await resp.json();
  return body.fileKey;
};

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1200, height: 900 });

  try {
    await common.login(page, env);

    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [TITLE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: TITLE_FIELD_CODE,
        label: TITLE_FIELD_CODE,
      },
      [FILE_FIELD_CODE]: {
        type: 'FILE',
        code: FILE_FIELD_CODE,
        label: FILE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: バックアップ方式=zipでダウンロード。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('.js-mode-zip');

    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, appId);

    // デモ用レコード(添付ファイル付き)を作成する。
    const fileKey = await uploadTestFile(
      env,
      'これは削除バックアッププラグインのデモ用ファイルです。',
      'demo.txt',
      'text/plain',
    );
    const { id: recordId } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'POST',
      {
        app: appId,
        record: {
          [TITLE_FIELD_CODE]: { value: '見積書(廃棄予定)' },
          [FILE_FIELD_CODE]: { value: [{ fileKey }] },
        },
      },
    );

    // 詳細画面へ遷移し、削除前の状態(添付ファイルつき)をスクリーンショット。
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${appId}/show#record=${recordId}`,
      { waitUntil: 'networkidle0' },
    );
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    await common.screenshotToDirectory(page, screenshotDir, 'record-before-delete');

    // ダウンロード先を一時ディレクトリに固定する(delete-zip-flow.e2e.test.jsと同じ方針)。
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dback-article-'));
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });

    // オプションメニュー→「レコードを削除」→確認ポップアップ。
    await page.waitForSelector('.gaia-argoui-optionmenubutton');
    await page.click('.gaia-argoui-optionmenubutton');
    await page.waitForSelector('a[title="レコードを削除"]');
    await page.click('a[title="レコードを削除"]');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.removelink-confirm-btn-cybozu')].some(
        (el) => el.textContent.trim() === '削除する',
      ),
    );
    await common.screenshotToDirectory(page, screenshotDir, 'delete-confirm');

    await page.evaluate(() => {
      const btn = [
        ...document.querySelectorAll('.removelink-confirm-btn-cybozu'),
      ].find((el) => el.textContent.trim() === '削除する');
      btn.click();
    });

    // レコードが実際に削除されるまで待つ。
    let deleted = false;
    for (let attempt = 0; attempt < 20 && !deleted; attempt += 1) {
      try {
        await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
          app: appId,
          id: recordId,
        });
      } catch {
        deleted = true;
      }
      if (!deleted) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (!deleted) {
      throw new Error('レコードが削除されませんでした。');
    }

    // zipが実際にダウンロードされたことを確認する(ZIPのローカルファイルヘッダーシグネチャ)。
    const zipFileName = `backup_app${appId}_record${recordId}.zip`;
    let zipFound = false;
    for (let attempt = 0; attempt < 20 && !zipFound; attempt += 1) {
      zipFound = fs.existsSync(path.join(downloadDir, zipFileName));
      if (!zipFound) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!zipFound) {
      throw new Error('zipファイルがダウンロードされませんでした。');
    }
    const zipBytes = fs.readFileSync(path.join(downloadDir, zipFileName));
    if (zipBytes.readUInt32LE(0) !== 0x04034b50) {
      throw new Error('ダウンロードされたファイルがZIP形式ではありません。');
    }
    console.log(`zip downloaded: ${zipFileName} (${zipBytes.length} bytes)`);

    // 一覧画面でレコードが無くなったことをスクリーンショットで確認する
    // (削除直後はダウンロード処理と競合してnavigationがERR_ABORTEDになることがあるためリトライする)。
    await new Promise((resolve) => setTimeout(resolve, 1000));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
          waitUntil: 'networkidle0',
        });
        break;
      } catch (err) {
        if (attempt === 2) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    await common.screenshotToDirectory(page, screenshotDir, 'record-list-after');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
