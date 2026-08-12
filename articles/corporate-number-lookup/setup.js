'use strict';

// 記事「kintoneで法人番号から会社情報を自動入力する方法(gBizINFO連携)」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// 実行には .env に GBIZ_API_KEY(gBizINFOのAPIトークン、利用者が自分で申請・取得したもの)が
// 必要。未設定の場合は実行時にエラーで停止する(record-lookup.e2e.test.jsと同じ制約)。
//
// 実行: node articles/corporate-number-lookup/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'corporate-number-lookup';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../biz_code_search/src');

const NUMBER_FIELD_CODE = '法人番号';
const NAME_FIELD_CODE = '会社名';
const NAME_OUTPUT_FIELD_CODE = '正式名称';
const REP_OUTPUT_FIELD_CODE = '代表者名';
const NUMBER_BUTTON_SPACE_ELEMENT_ID = 'biz_number_btn_space';
const NAME_BUTTON_SPACE_ELEMENT_ID = 'biz_name_btn_space';

// 実在する法人(サイボウズ株式会社)の法人番号。プラグイン本体のe2eテスト
// (biz_code_search/src/e2e/fixtures.js)で実際にgBizINFOへリクエストして確認済みのもの。
const KNOWN_CORPORATE_NUMBER = '5010001072207';
const KNOWN_CORPORATE_NAME = 'サイボウズ株式会社';

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  if (!env.GBIZ_API_KEY) {
    throw new Error(
      '.env に GBIZ_API_KEY が設定されていません(gBizINFOのAPIトークン、利用者が自分で申請・取得したもの)。',
    );
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1200, height: 1000 });

  try {
    await common.login(page, env);

    // 1. 白紙に戻す
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.deployApp(env, appId);

    // 2. フィールド作成 + ボタン設置用スペースの追加
    await kintoneAdmin.addFormFields(env, appId, {
      [NUMBER_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NUMBER_FIELD_CODE,
        label: NUMBER_FIELD_CODE,
      },
      [NAME_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NAME_FIELD_CODE,
        label: NAME_FIELD_CODE,
      },
      [NAME_OUTPUT_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NAME_OUTPUT_FIELD_CODE,
        label: NAME_OUTPUT_FIELD_CODE,
      },
      [REP_OUTPUT_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: REP_OUTPUT_FIELD_CODE,
        label: REP_OUTPUT_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);
    await kintoneAdmin.ensureSpacerInLayout(
      env,
      appId,
      NUMBER_BUTTON_SPACE_ELEMENT_ID,
    );
    await kintoneAdmin.ensureSpacerInLayout(
      env,
      appId,
      NAME_BUTTON_SPACE_ELEMENT_ID,
    );

    // 3. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 4. 設定: 法人番号フィールド・法人名フィールド・ボタン設置スペース・転記項目(法人名→正式名称、
    //    代表者名→代表者名)・APIトークンを入力して保存する。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-lookup-add');
    const rowHandle = await page.$('.js-lookup-row:last-of-type');
    await (await rowHandle.$('.js-lookup-corporate-number')).select(
      NUMBER_FIELD_CODE,
    );
    await (await rowHandle.$('.js-lookup-company-name')).select(
      NAME_FIELD_CODE,
    );
    await (await rowHandle.$('.js-lookup-number-button-space')).select(
      NUMBER_BUTTON_SPACE_ELEMENT_ID,
    );
    await (await rowHandle.$('.js-lookup-name-button-space')).select(
      NAME_BUTTON_SPACE_ELEMENT_ID,
    );
    await (await rowHandle.$('.js-mapping-add')).click();
    await (await rowHandle.$('.js-mapping-add')).click();
    const mappingRows = await rowHandle.$$('.js-mapping-row');
    await (await mappingRows[0].$('.js-mapping-attribute')).select('name');
    await (await mappingRows[0].$('.js-mapping-target')).select(
      NAME_OUTPUT_FIELD_CODE,
    );
    await (await mappingRows[1].$('.js-mapping-attribute')).select(
      'representative_name',
    );
    await (await mappingRows[1].$('.js-mapping-target')).select(
      REP_OUTPUT_FIELD_CODE,
    );
    await page.type('#js-api-token', env.GBIZ_API_KEY);
    await common.savePluginConfig(page);
    await kintoneAdmin.deployApp(env, appId);

    // 5. 設定画面のスクリーンショット。
    await common.openPluginConfig(page, env, appId, pluginId);
    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    // 6. レコード追加画面へ実際のユーザー導線(一覧画面→「レコードを追加する」)で遷移する
    //    (page.goto()での直接遷移だとkintone.app.record.*がSPA内部状態不整合で失敗するため)。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    // 7. 法人番号を入力し、「法人番号から取得」ボタンを押して実際にgBizINFOへリクエストする。
    await page.evaluate((value) => {
      const current = kintone.app.record.get().record;
      current['法人番号'].value = value;
      kintone.app.record.set({ record: current });
    }, KNOWN_CORPORATE_NUMBER);

    await page.waitForFunction(
      (spaceId) => {
        const spaceEl = kintone.app.record.getSpaceElement(spaceId);
        return !!(spaceEl && spaceEl.querySelector('button'));
      },
      {},
      NUMBER_BUTTON_SPACE_ELEMENT_ID,
    );
    const buttonHandle = await page.evaluateHandle(
      (id, text) => {
        const spaceEl = kintone.app.record.getSpaceElement(id);
        return Array.from(spaceEl.querySelectorAll('button')).find(
          (b) => b.textContent === text,
        );
      },
      NUMBER_BUTTON_SPACE_ELEMENT_ID,
      '法人番号から取得',
    );
    await buttonHandle.asElement().click();

    await page.waitForFunction(
      (expected) =>
        kintone.app.record.get().record['正式名称'].value === expected,
      { timeout: 20000 },
      KNOWN_CORPORATE_NAME,
    );

    // 8. 反映結果のスクリーンショット。
    await common.screenshotToDirectory(page, screenshotDir, 'record-result');

    console.log('done.');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
