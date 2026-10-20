'use strict';

// ジェノグラム作成プラグインの紹介動画「架空の相談ケース(離婚・内縁・養子・関係性の例)」用の
// ARTICLE_APP_IDセットアップスクリプト。アプリを白紙に戻し、ケース名・データ(JSON)のフィールドと
// 図を表示するスペースを作り、プラグインを追加・設定する。撮影は record-video.js で行う。
//
// 実行(puppeteerは genogram/src の node_modules から読み込む):
//   NODE_PATH=genogram/src/node_modules node articles/genogram-case-example/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const PLUGIN_SRC_DIR = path.join(__dirname, '../../genogram/src');
const TITLE_FIELD = 'ケース名';
const JSON_FIELD = 'genogram_json';
const SPACE_ID = 'genogram_space';

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
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await common.login(page, env);

    // アプリを白紙に戻す(レコード → フィールド → プラグイン → プロセス管理の順。article-app-setup参照)
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [TITLE_FIELD]: {
        type: 'SINGLE_LINE_TEXT',
        code: TITLE_FIELD,
        label: 'ケース名',
      },
      [JSON_FIELD]: {
        type: 'MULTI_LINE_TEXT',
        code: JSON_FIELD,
        label: 'ジェノグラムデータ',
      },
    });

    // ケース名 → 図(スペース、1行に単独・幅広) → データ(JSON。プラグインの設定で非表示にする)の順に並べる
    const { revision } = await kintoneAdmin.getFormLayout(env, appId);
    await kintoneAdmin.updateFormLayout(
      env,
      appId,
      [
        {
          type: 'ROW',
          fields: [
            { type: 'SINGLE_LINE_TEXT', code: TITLE_FIELD, size: { width: '400' } },
          ],
        },
        {
          type: 'ROW',
          fields: [
            {
              type: 'SPACER',
              elementId: SPACE_ID,
              size: { width: '1180', height: '100' },
            },
          ],
        },
        {
          type: 'ROW',
          fields: [{ type: 'MULTI_LINE_TEXT', code: JSON_FIELD }],
        },
      ],
      revision,
    );
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    await common.openPluginConfig(page, env, appId, pluginId);
    await page.waitForSelector(`#js-json-field option[value="${JSON_FIELD}"]`, {
      timeout: 15000,
    });
    await page.select('#js-json-field', JSON_FIELD);
    await page.select('#js-space', SPACE_ID);
    await page.$eval('#js-hide-json', (el) => {
      el.checked = true;
    });
    await common.savePluginConfig(page);
    await kintoneAdmin.deployApp(env, appId);
    console.log(`ARTICLE_APP_ID(${appId}) のセットアップが完了しました。`);
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
