'use strict';

// 記事「kintoneで条件によって入力項目を必須にする方法」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// 実行: node articles/required-condition/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'required-condition';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../requiredCondition/src');

const TYPE_FIELD_CODE = '種別';
const REASON_FIELD_CODE = '特別理由';
const SPECIAL_OPTION = '特別';

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
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.setViewport({ width: 1200, height: 1000 });

  try {
    await common.login(page, env);

    // 1. 白紙に戻す
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.deployApp(env, appId);

    // 2. フィールド作成: 種別(ドロップダウン: 通常/特別)、特別理由(文字列1行)
    await kintoneAdmin.addFormFields(env, appId, {
      [TYPE_FIELD_CODE]: {
        type: 'DROP_DOWN',
        code: TYPE_FIELD_CODE,
        label: TYPE_FIELD_CODE,
        options: {
          通常: { label: '通常', index: '0' },
          [SPECIAL_OPTION]: { label: SPECIAL_OPTION, index: '1' },
        },
      },
      [REASON_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: REASON_FIELD_CODE,
        label: REASON_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 3. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 4. 設定: 種別=特別のとき、特別理由を必須にする。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.waitForSelector('#addCondition');
    await page.click('#addCondition');
    await page.waitForFunction(
      () => document.querySelector('.condition-group .condition-field').options.length > 1,
    );
    await page.select('.condition-group .condition-field', TYPE_FIELD_CODE);
    await page.click('.condition-group button[name="addConditionValue"]');
    await page.waitForSelector('.value-row .condition-value');
    await page.select('.value-row .condition-value', SPECIAL_OPTION);
    await page.select('.value-row .target-fields', REASON_FIELD_CODE);
    await page.click('#generateJSON');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await kintoneAdmin.deployApp(env, appId);

    // 5. 設定画面のスクリーンショット(保存後、再度開いて値が保持されているか含めて撮る)。
    await common.openPluginConfig(page, env, appId, pluginId);
    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    // 6. レコード追加画面: 種別=特別を選び、特別理由を空欄のまま保存しようとして
    //    バリデーションエラーが出ることを確認する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    await page.evaluate(
      (typeFieldCode, value) => {
        const current = kintone.app.record.get().record;
        current[typeFieldCode].value = value;
        kintone.app.record.set({ record: current });
      },
      TYPE_FIELD_CODE,
      SPECIAL_OPTION,
    );

    await page.click('.gaia-ui-actionmenu-save');
    // バリデーションでブロックされ、対象フィールドにエラーメッセージが表示されるのを待つ。
    await page.waitForFunction(
      () => location.href.includes('/edit'),
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 7. エラー表示のスクリーンショット。
    await common.screenshotToDirectory(page, screenshotDir, 'validation-error');

    console.log('done.');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
