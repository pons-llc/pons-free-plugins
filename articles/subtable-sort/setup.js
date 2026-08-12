'use strict';

// 記事「kintoneのサブテーブルを金額順に並び替える方法」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// 実行: node articles/subtable-sort/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'subtable-sort';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../subtable_sort/src');

const TABLE_FIELD_CODE = 'テーブル';
const NAME_FIELD_CODE = '項目名';
const AMOUNT_FIELD_CODE = '金額';

// 保存前(入力順)。金額の大小がバラバラな順で入力する。
const UNSORTED_ROWS = [
  { [NAME_FIELD_CODE]: '商品A', [AMOUNT_FIELD_CODE]: '300' },
  { [NAME_FIELD_CODE]: '商品B', [AMOUNT_FIELD_CODE]: '1000' },
  { [NAME_FIELD_CODE]: '商品C', [AMOUNT_FIELD_CODE]: '500' },
];

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

    // 2. サブテーブルフィールドを作成(項目名・金額の2列)。
    await kintoneAdmin.addFormFields(env, appId, {
      [TABLE_FIELD_CODE]: {
        type: 'SUBTABLE',
        code: TABLE_FIELD_CODE,
        label: TABLE_FIELD_CODE,
        fields: {
          [NAME_FIELD_CODE]: {
            type: 'SINGLE_LINE_TEXT',
            code: NAME_FIELD_CODE,
            label: NAME_FIELD_CODE,
          },
          [AMOUNT_FIELD_CODE]: {
            type: 'NUMBER',
            code: AMOUNT_FIELD_CODE,
            label: AMOUNT_FIELD_CODE,
          },
        },
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 3. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 4. 設定: ルールを1件追加し、対象テーブル=テーブル、発動タイミング=保存時(SUBMIT)、
    //    ソートキー=金額の降順(NUMBER型)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-rule-add');
    await page.select('.js-rule-subtable', TABLE_FIELD_CODE);
    await page.select('.js-rule-trigger', 'SUBMIT');
    await page.click('.js-sortkey-add');
    await page.select('.js-sortkey-column', AMOUNT_FIELD_CODE);
    await page.select('.js-sortkey-order', 'DESC');
    await page.select('.js-sortkey-type', 'NUMBER');
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

    // 6. レコード追加画面で、金額がバラバラな順にサブテーブルへ行を入力して保存する。
    //    行の追加は生のテーブルUI操作(+ボタン、セル入力)が複雑なため、
    //    kintone.app.record.set()で直接値を組み立てる(このプラグイン自体のe2eテストにも
    //    ある手法ではないが、record.set()自体はkintone標準のJavaScript APIであり、
    //    「保存時にソートする」というこのプラグインの実際の挙動の検証には影響しない)。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    await page.evaluate(
      (tableFieldCode, nameFieldCode, amountFieldCode, rows) => {
        const current = kintone.app.record.get().record;
        current[tableFieldCode].value = rows.map((row) => ({
          value: {
            [nameFieldCode]: { type: 'SINGLE_LINE_TEXT', value: row[nameFieldCode] },
            [amountFieldCode]: { type: 'NUMBER', value: row[amountFieldCode] },
          },
        }));
        kintone.app.record.set({ record: current });
      },
      TABLE_FIELD_CODE,
      NAME_FIELD_CODE,
      AMOUNT_FIELD_CODE,
      UNSORTED_ROWS,
    );

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('.gaia-ui-actionmenu-save'),
    ]);

    // 7. 保存後、実際に金額の降順にソートされているかを待って確認する。
    await page.waitForFunction(
      (tableFieldCode, amountFieldCode) => {
        const record = kintone.app.record.get();
        if (!record) return false;
        const rows = record.record[tableFieldCode].value;
        return rows[0].value[amountFieldCode].value === '1000';
      },
      { timeout: 20000 },
      TABLE_FIELD_CODE,
      AMOUNT_FIELD_CODE,
    );

    // 8. 結果のスクリーンショット。
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
