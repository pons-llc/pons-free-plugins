'use strict';

// articles/conditional-display/setup.js
// 記事「kintoneで条件によってフィールドを非表示にする方法」用に ARTICLE_APP_ID を白紙に戻し、
// setFieldShown プラグインで「申請種別が『物品購入申請』のとき出張関連フィールドを隠す」デモを
// 実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/conditional-display/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../setFieldShown/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'conditional-display';
const TYPE_FIELD_CODE = '申請種別';
const DESTINATION_FIELD_CODE = '出張先';
const DAYS_FIELD_CODE = '出張日数';
const ITEM_FIELD_CODE = '購入品目';
const TRIP_OPTION = '出張申請';
const PURCHASE_OPTION = '物品購入申請';

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
      [TYPE_FIELD_CODE]: {
        type: 'DROP_DOWN',
        code: TYPE_FIELD_CODE,
        label: TYPE_FIELD_CODE,
        options: {
          [TRIP_OPTION]: { label: TRIP_OPTION, index: '0' },
          [PURCHASE_OPTION]: { label: PURCHASE_OPTION, index: '1' },
        },
      },
      [DESTINATION_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: DESTINATION_FIELD_CODE,
        label: DESTINATION_FIELD_CODE,
      },
      [DAYS_FIELD_CODE]: {
        type: 'NUMBER',
        code: DAYS_FIELD_CODE,
        label: DAYS_FIELD_CODE,
      },
      [ITEM_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: ITEM_FIELD_CODE,
        label: ITEM_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 条件フィールド=申請種別、条件値=物品購入申請のとき、出張先・出張日数を非表示。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#addCondition');
    await page.waitForFunction(
      () => document.querySelector('.condition-group .condition-field').options.length > 1,
    );
    await page.select('.condition-group .condition-field', TYPE_FIELD_CODE);

    await page.click('.condition-group button[name="addConditionValue"]');
    await page.waitForSelector('.value-row .condition-value');
    await page.select('.value-row .condition-value', PURCHASE_OPTION);
    await page.$eval(
      '.value-row .target-fields',
      (el, codes) => {
        Array.from(el.options).forEach((opt) => {
          opt.selected = codes.includes(opt.value);
        });
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      [DESTINATION_FIELD_CODE, DAYS_FIELD_CODE],
    );

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
      page.click('#generateJSON'),
    ]);
    await kintoneAdmin.deployApp(env, appId);

    // レコード追加画面へ実際のユーザー導線で遷移し、初期状態(出張申請、全項目表示)のスクリーン
    // ショットを撮ってから、申請種別を「物品購入申請」に変えて出張先・出張日数が隠れることを確認する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});

    await common.screenshotToDirectory(page, screenshotDir, 'record-edit-before');

    await page.evaluate(
      (fieldCode, value) => {
        const current = kintone.app.record.get().record;
        current[fieldCode].value = value;
        kintone.app.record.set({ record: current });
      },
      TYPE_FIELD_CODE,
      PURCHASE_OPTION,
    );

    // 値変更イベント後の非表示再評価を待つ。
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await common.screenshotToDirectory(page, screenshotDir, 'record-edit-after');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
