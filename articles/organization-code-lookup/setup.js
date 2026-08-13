'use strict';

// articles/organization-code-lookup/setup.js
// 記事「kintoneの組織コードから組織名を取得する方法」用に ARTICLE_APP_ID を白紙に戻し、
// org_lookup プラグインで「組織コードを入力してボタンを押すと組織名・説明が自動入力される」
// デモを実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/organization-code-lookup/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../org_lookup/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'organization-code-lookup';
const SOURCE_FIELD_CODE = '組織コード';
const NAME_FIELD_CODE = '組織名';
const DESC_FIELD_CODE = '組織の説明';
const PARENT_NAME_FIELD_CODE = '親組織名';
const BUTTON_SPACE_ELEMENT_ID = 'orgl_article_button_space';

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);

  // 検証環境に実在する組織を1件取得する(記事のデモ結果として実際の組織名を使う)。
  const orgsRes = await kintoneAdmin.request(env, '/v1/organizations.json', 'GET', {});
  if (!orgsRes.organizations || orgsRes.organizations.length === 0) {
    throw new Error('検証環境に組織が1件も存在しません。');
  }
  const targetOrg = orgsRes.organizations[0];

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1280, height: 950 });

  try {
    await common.login(page, env);

    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [SOURCE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: SOURCE_FIELD_CODE,
        label: SOURCE_FIELD_CODE,
      },
      [NAME_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NAME_FIELD_CODE,
        label: NAME_FIELD_CODE,
      },
      [DESC_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: DESC_FIELD_CODE,
        label: DESC_FIELD_CODE,
      },
      [PARENT_NAME_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: PARENT_NAME_FIELD_CODE,
        label: PARENT_NAME_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);
    await kintoneAdmin.ensureSpacerInLayout(env, appId, BUTTON_SPACE_ELEMENT_ID);
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 元フィールド=組織コード、発動条件=ボタン押下時、
    // ボタン設置スペース=orgl_article_button_space、転記項目: 組織名/組織の説明/親組織名。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-row-add');
    await page.waitForSelector('.js-row');

    await page.select('.js-row .js-source-field', SOURCE_FIELD_CODE);
    await page.select('.js-row .js-button-space', BUTTON_SPACE_ELEMENT_ID);

    await page.click('.js-row .js-mapping-add');
    await page.waitForSelector('.js-row .js-mapping-row');
    await page.select('.js-row .js-mapping-row .js-mapping-attribute', 'name');
    await page.select(
      '.js-row .js-mapping-row .js-mapping-destination',
      NAME_FIELD_CODE,
    );

    await page.click('.js-row .js-mapping-add');
    let mappingRows = await page.$$('.js-row .js-mapping-row');
    await mappingRows[1]
      .$('.js-mapping-attribute')
      .then((el) => el.select('description'));
    await mappingRows[1]
      .$('.js-mapping-destination')
      .then((el) => el.select(DESC_FIELD_CODE));

    await page.click('.js-row .js-mapping-add');
    mappingRows = await page.$$('.js-row .js-mapping-row');
    await mappingRows[2]
      .$('.js-mapping-attribute')
      .then((el) => el.select('parentName'));
    await mappingRows[2]
      .$('.js-mapping-destination')
      .then((el) => el.select(PARENT_NAME_FIELD_CODE));

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

    // レコード追加画面へ実際のユーザー導線(一覧画面→「レコードを追加する」)で遷移する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    await page.evaluate(
      (fieldCode, value) => {
        const current = kintone.app.record.get().record;
        current[fieldCode].value = value;
        kintone.app.record.set({ record: current });
      },
      SOURCE_FIELD_CODE,
      targetOrg.code,
    );

    await page.waitForFunction(
      (spaceId) => {
        const spaceEl = kintone.app.record.getSpaceElement(spaceId);
        return !!(spaceEl && spaceEl.querySelector('button'));
      },
      {},
      BUTTON_SPACE_ELEMENT_ID,
    );
    await page.evaluate((spaceId) => {
      kintone.app.record
        .getSpaceElement(spaceId)
        .querySelector('button')
        .click();
    }, BUTTON_SPACE_ELEMENT_ID);

    await page.waitForFunction(
      (fieldCode, expected) =>
        kintone.app.record.get().record[fieldCode].value === expected,
      { timeout: 15000 },
      NAME_FIELD_CODE,
      targetOrg.name,
    );

    await common.screenshotToDirectory(page, screenshotDir, 'record-edit');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
