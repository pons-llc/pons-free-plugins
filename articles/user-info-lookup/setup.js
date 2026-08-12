'use strict';

// 記事「kintoneでユーザーコードから氏名・所属を自動取得する方法」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// 実行: node articles/user-info-lookup/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'user-info-lookup';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../user_info_lookup/src');

const SOURCE_FIELD_CODE = 'ユーザーコード';
const NAME_OUTPUT_FIELD_CODE = '氏名';
const EMAIL_OUTPUT_FIELD_CODE = 'メールアドレス';
const BUTTON_SPACE_ELEMENT_ID = 'uil_article_button_space';

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
      [SOURCE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: SOURCE_FIELD_CODE,
        label: SOURCE_FIELD_CODE,
      },
      [NAME_OUTPUT_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NAME_OUTPUT_FIELD_CODE,
        label: NAME_OUTPUT_FIELD_CODE,
      },
      [EMAIL_OUTPUT_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: EMAIL_OUTPUT_FIELD_CODE,
        label: EMAIL_OUTPUT_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);
    await kintoneAdmin.ensureSpacerInLayout(env, appId, BUTTON_SPACE_ELEMENT_ID);

    // 3. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 4. 設定: 元フィールド=ユーザーコード、ボタン設置スペース、転記項目(氏名・メールアドレス)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-row-add');
    const rowHandle = await page.$('.js-row:last-of-type');
    await (await rowHandle.$('.js-source-field')).select(SOURCE_FIELD_CODE);
    await (await rowHandle.$('.js-button-space')).select(BUTTON_SPACE_ELEMENT_ID);

    await (await rowHandle.$('.js-mapping-add')).click();
    let mappingRows = await rowHandle.$$('.js-mapping-row');
    await (await mappingRows[0].$('.js-mapping-attribute')).select('name');
    await (await mappingRows[0].$('.js-mapping-destination')).select(
      NAME_OUTPUT_FIELD_CODE,
    );

    await (await rowHandle.$('.js-mapping-add')).click();
    mappingRows = await rowHandle.$$('.js-mapping-row');
    await (await mappingRows[1].$('.js-mapping-attribute')).select('email');
    await (await mappingRows[1].$('.js-mapping-destination')).select(
      EMAIL_OUTPUT_FIELD_CODE,
    );

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

    // 6. レコード追加画面: ユーザーコードにログイン中の管理者自身のコードを入力し、
    //    ボタンを押して実際にUser APIから氏名・メールアドレスを取得する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    await page.evaluate(
      (fieldCode, value) => {
        const current = kintone.app.record.get().record;
        current[fieldCode].value = value;
        kintone.app.record.set({ record: current });
      },
      SOURCE_FIELD_CODE,
      env.KINTONE_USERNAME,
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
      kintone.app.record.getSpaceElement(spaceId).querySelector('button').click();
    }, BUTTON_SPACE_ELEMENT_ID);

    await page.waitForFunction(
      (fieldCode) => !!kintone.app.record.get().record[fieldCode].value,
      { timeout: 15000 },
      NAME_OUTPUT_FIELD_CODE,
    );

    // 7. 反映結果のスクリーンショット。取得される氏名・メールアドレスはログイン中の
    //    実アカウント(検証環境の管理者)の実データのため、メールアドレスは画面表示だけを
    //    サンプル値に置き換えてから撮影する(保存データ自体は変更しない。実在する個人の
    //    メールアドレスを公開サイトに載せないため)。
    await page.evaluate(() => {
      document.querySelectorAll('input, textarea').forEach((el) => {
        if (el.value && el.value.includes('@')) {
          el.value = 'sample@example.com';
        }
      });
      document.querySelectorAll('div, span').forEach((el) => {
        if (
          el.children.length === 0 &&
          el.textContent.includes('@') &&
          el.textContent.includes('.')
        ) {
          el.textContent = 'sample@example.com';
        }
      });
    });
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
