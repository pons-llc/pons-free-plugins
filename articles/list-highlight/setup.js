'use strict';

// articles/list-highlight/setup.js
// 記事「kintoneの一覧を条件によって色分けする方法」用に ARTICLE_APP_ID を白紙に戻し、
// list_highlight プラグインで「対応状況が『未対応』の行を赤色で強調表示する」デモを
// 実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/list-highlight/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../list_highlight/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'list-highlight';
const TITLE_FIELD_CODE = '案件名';
const STATUS_FIELD_CODE = '対応状況';

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
  await page.setViewport({ width: 1280, height: 900 });

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
      [STATUS_FIELD_CODE]: {
        type: 'DROP_DOWN',
        code: STATUS_FIELD_CODE,
        label: STATUS_FIELD_CODE,
        options: {
          未対応: { label: '未対応', index: '0' },
          対応中: { label: '対応中', index: '1' },
          対応済み: { label: '対応済み', index: '2' },
        },
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 既定の一覧に案件名・対応状況の列を表示させる(スクリーンショットで強調表示が
    // 分かりやすいように。既定ではレコード番号列しか表示されないため)。
    const currentViews = await kintoneAdmin.request(
      env,
      '/k/v1/preview/app/views.json',
      'GET',
      { app: appId },
    );
    const defaultViewName = Object.keys(currentViews.views)[0];
    const defaultView = currentViews.views[defaultViewName];
    await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'PUT', {
      app: appId,
      views: {
        [defaultViewName]: {
          index: defaultView.index,
          type: defaultView.type,
          name: defaultView.name,
          fields: ['レコード番号', TITLE_FIELD_CODE, STATUS_FIELD_CODE],
          sort: defaultView.sort,
        },
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: ルールを1つ追加(条件: 対応状況 = 未対応、背景色: 赤系)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-rule-add');
    await page.waitForSelector('.js-rule-row');
    await page.evaluate(() => {
      document.querySelector('.js-rule-color').value = '#ffcdd2';
      document
        .querySelector('.js-rule-color')
        .dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.click('.js-clause-add');
    await page.waitForSelector('.js-clause-field');
    await page.select('.js-clause-field', STATUS_FIELD_CODE);
    await page.select('.js-clause-operator', 'EQ');
    await page.type('.js-clause-value', '未対応');

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

    // デモ用レコードを3件作成する(対応状況が異なる)。
    await kintoneAdmin.addRecords(env, appId, [
      {
        [TITLE_FIELD_CODE]: { value: 'サーバー証明書の更新' },
        [STATUS_FIELD_CODE]: { value: '未対応' },
      },
      {
        [TITLE_FIELD_CODE]: { value: 'ネットワーク機器の点検' },
        [STATUS_FIELD_CODE]: { value: '対応中' },
      },
      {
        [TITLE_FIELD_CODE]: { value: '備品の発注' },
        [STATUS_FIELD_CODE]: { value: '対応済み' },
      },
    ]);

    // 一覧画面で、対応状況=未対応の行だけが赤系で強調表示されることを確認する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await common.screenshotToDirectory(page, screenshotDir, 'record-list');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
