'use strict';

// articles/google-drive-embed/setup.js
// 記事「kintoneにGoogle Driveのファイルを表示・埋め込む方法」用に ARTICLE_APP_ID を白紙に戻し、
// box_gdrive_iframe プラグインで「フォルダURLを入力すると埋め込み表示される/許可外ドメインは
// ブロックされる」デモを実行してスクリーンショットを撮る
// (scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/google-drive-embed/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../box_gdrive_iframe/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'google-drive-embed';
const NAME_FIELD_CODE = 'フォルダ名';
const URL_FIELD_CODE = 'フォルダURL';
const SPACE_ELEMENT_ID = 'bgi_article_embed_space';

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
  await page.setViewport({ width: 1200, height: 950 });

  try {
    await common.login(page, env);

    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [NAME_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NAME_FIELD_CODE,
        label: NAME_FIELD_CODE,
      },
      [URL_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: URL_FIELD_CODE,
        label: URL_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);
    await kintoneAdmin.ensureSpacerInLayout(env, appId, SPACE_ELEMENT_ID);
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 埋め込みタブを1つ追加(タイトル=契約書フォルダ、スペース=作成済みスペース、
    // リンク先フィールド=フォルダURL、サービス=Google、幅600・高さ400)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-add-tab');
    await page.waitForSelector('.embed-panel');
    await page.type('.js-embed-title', '契約書フォルダ');
    await page.select('.js-embed-space', SPACE_ELEMENT_ID);
    await page.select('.js-embed-field', URL_FIELD_CODE);
    await page.click('.js-embed-service[value="google"]');
    await page.evaluate(() => {
      document.querySelector('.js-embed-width').value = '600';
      document.querySelector('.js-embed-height').value = '400';
    });

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

    // デモ用レコードを2件作成する: 1件は許可されたGoogleドライブのフォルダURL、
    // もう1件は許可リストに無いドメインのURL(セキュリティ上ブロックされることを見せる)。
    const { ids } = await kintoneAdmin.addRecords(env, appId, [
      {
        [NAME_FIELD_CODE]: { value: '契約書フォルダ(正しいURL)' },
        [URL_FIELD_CODE]: {
          value:
            'https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9iJ0kLmNoPqRsTuV',
        },
      },
      {
        [NAME_FIELD_CODE]: { value: '契約書フォルダ(許可外ドメイン)' },
        [URL_FIELD_CODE]: { value: 'https://example.com/not-allowed-folder' },
      },
    ]);

    // 1件目: 許可されたドメインのため、Googleドライブの埋め込みビューURLへ変換されたiframeが
    // 描画される(実際のフォルダが存在しないためコンテンツ自体はGoogle側のエラー画面になるが、
    // 埋め込み処理自体は許可ドメインとして正しく実行される)。iframeのsrc属性を検証する。
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${appId}/show#record=${ids[0]}`,
      { waitUntil: 'networkidle0' },
    );
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    await page.waitForSelector('iframe', { timeout: 15000 });
    const iframeSrc = await page.$eval('iframe', (el) => el.src);
    if (!iframeSrc.startsWith('https://drive.google.com/embeddedfolderview')) {
      throw new Error(`想定外のiframe src: ${iframeSrc}`);
    }
    console.log('iframe embedded ok:', iframeSrc);

    // 2件目: 許可外ドメインのため、iframeではなく警告メッセージが表示される。
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${appId}/show#record=${ids[1]}`,
      { waitUntil: 'networkidle0' },
    );
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    await page.waitForSelector('.box-gdrive-embed-message', { timeout: 15000 });
    await common.screenshotToDirectory(page, screenshotDir, 'blocked-domain');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
