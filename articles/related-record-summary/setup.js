'use strict';

// articles/related-record-summary/setup.js
// 記事「kintoneの関連レコードを件数・合計・平均で集計する方法」用に ARTICLE_APP_ID を白紙に戻し、
// related_record_summary プラグインで「案件に紐づく契約明細の金額合計を、詳細画面ボタンで
// 自アプリのフィールドへ書き込む」デモを実行してスクリーンショットを撮る
// (scripts/templates/article-setup.template.js のコピー)。
//
// このプラグインの実演には「参照先アプリ(契約明細)」が必要。既存の共有テストアプリは
// 他プラグインのfixtureが乗っているため使わず、この記事専用の参照先アプリを新規作成する
// (articles/auto-lookup/setup.jsと同じ考え方)。作成したアプリIDは
// articles/related-record-summary/reference-app-id.txt に保存し、次回実行時は再作成せず使い回す。
//
// 実行: node articles/related-record-summary/setup.js

const fs = require('fs');
const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../related_record_summary/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'related-record-summary';
const REFERENCE_APP_ID_FILE = path.join(__dirname, 'reference-app-id.txt');

const PROJECT_CODE_FIELD = '案件コード';
const PROJECT_NAME_FIELD = '案件名';
const TOTAL_FIELD_CODE = '契約金額合計';
const REFERENCE_FIELD_CODE = '関連する契約明細';

const REF_PROJECT_CODE_FIELD = '案件コード';
const REF_AMOUNT_FIELD = '金額';
const KEY_VALUE = 'P001';

const ensureReferenceApp = async (env) => {
  if (fs.existsSync(REFERENCE_APP_ID_FILE)) {
    return fs.readFileSync(REFERENCE_APP_ID_FILE, 'utf8').trim();
  }
  const created = await kintoneAdmin.createApp(
    env,
    '契約明細(記事用, related_record_summary)',
  );
  const appId = created.app;
  await kintoneAdmin.addFormFields(env, appId, {
    [REF_PROJECT_CODE_FIELD]: {
      type: 'SINGLE_LINE_TEXT',
      code: REF_PROJECT_CODE_FIELD,
      label: REF_PROJECT_CODE_FIELD,
    },
    [REF_AMOUNT_FIELD]: {
      type: 'NUMBER',
      code: REF_AMOUNT_FIELD,
      label: REF_AMOUNT_FIELD,
    },
  });
  await kintoneAdmin.deployApp(env, appId);
  fs.writeFileSync(REFERENCE_APP_ID_FILE, String(appId));
  return String(appId);
};

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
  const referenceAppId = await ensureReferenceApp(env);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await common.login(page, env);

    // 参照先アプリ(契約明細)のデモ用レコードをデモ用の内容に揃える(冪等)。
    await kintoneAdmin.deleteAllRecords(env, referenceAppId);
    await kintoneAdmin.addRecords(env, referenceAppId, [
      {
        [REF_PROJECT_CODE_FIELD]: { value: KEY_VALUE },
        [REF_AMOUNT_FIELD]: { value: '1200000' },
      },
      {
        [REF_PROJECT_CODE_FIELD]: { value: KEY_VALUE },
        [REF_AMOUNT_FIELD]: { value: '800000' },
      },
      {
        [REF_PROJECT_CODE_FIELD]: { value: KEY_VALUE },
        [REF_AMOUNT_FIELD]: { value: '300000' },
      },
    ]);

    // 自アプリを白紙に戻す。
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addFormFields(env, appId, {
      [PROJECT_CODE_FIELD]: {
        type: 'SINGLE_LINE_TEXT',
        code: PROJECT_CODE_FIELD,
        label: PROJECT_CODE_FIELD,
      },
      [PROJECT_NAME_FIELD]: {
        type: 'SINGLE_LINE_TEXT',
        code: PROJECT_NAME_FIELD,
        label: PROJECT_NAME_FIELD,
      },
      [TOTAL_FIELD_CODE]: {
        type: 'NUMBER',
        code: TOTAL_FIELD_CODE,
        label: TOTAL_FIELD_CODE,
      },
      [REFERENCE_FIELD_CODE]: {
        type: 'REFERENCE_TABLE',
        code: REFERENCE_FIELD_CODE,
        label: REFERENCE_FIELD_CODE,
        referenceTable: {
          relatedApp: { app: String(referenceAppId), code: '' },
          condition: {
            field: PROJECT_CODE_FIELD,
            relatedField: REF_PROJECT_CODE_FIELD,
          },
          filterCond: '',
          displayFields: [REF_AMOUNT_FIELD],
          sort: '',
          size: '5',
        },
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 集計設定行を1つ追加(関連レコード一覧フィールド=関連する契約明細、
    // 集計種別=合計、集計対象フィールド=金額、書き込み先フィールド=契約金額合計)、
    // 発動条件は「詳細画面ボタン」をON。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-row-add');
    await page.waitForSelector('.js-row');

    await page.$eval(
      '.js-row .js-row-reference-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      REFERENCE_FIELD_CODE,
    );
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.js-row .js-row-target-field option')
          .length > 1,
      { timeout: 10000 },
    );
    await page.$eval(
      '.js-row .js-row-summary-type',
      (el) => {
        el.value = 'SUM';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
    );
    await page.$eval(
      '.js-row .js-row-target-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      REF_AMOUNT_FIELD,
    );
    await page.$eval(
      '.js-row .js-row-write-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      TOTAL_FIELD_CODE,
    );
    await page.click('.js-trigger-detail');

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

    // デモ用レコードを1件作成する(案件コード=P001、契約金額合計は未入力)。
    const { id: recordId } = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'POST',
      {
        app: appId,
        record: {
          [PROJECT_CODE_FIELD]: { value: KEY_VALUE },
          [PROJECT_NAME_FIELD]: { value: '本庁舎改修工事' },
        },
      },
    );

    // 一覧画面からレコードの行をクリックして詳細画面へ遷移する(page.goto()でのハード
    // ナビゲーションはkintone管理画面のSPA内部状態が壊れるため使わない。実機で確認済み)。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
    const rows = await page.$$('.recordlist-row-gaia');
    let opened = false;
    for (const row of rows) {
      const text = await page.evaluate((el) => el.textContent, row);
      if (new RegExp(`^${recordId}(\\D|$)`).test(text)) {
        const firstCell = await row.$('div,td,span');
        await firstCell.click();
        await page.waitForFunction(() => location.href.includes('/show'));
        await page
          .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
          .catch(() => {});
        opened = true;
        break;
      }
    }
    if (!opened) {
      throw new Error('一覧画面にデモレコードの行が見つかりませんでした。');
    }

    // 詳細画面の「関連レコードを集計」ボタンを押し、契約金額合計へ書き込まれるのを待つ。
    await page.waitForFunction(
      () => {
        const el = kintone.app.record.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.rrs-detail-button'));
      },
      { timeout: 15000 },
    );
    const buttonHandle = await page.$('.rrs-detail-button');
    await page.evaluate((el) => el.click(), buttonHandle);

    let total = null;
    for (let attempt = 0; attempt < 20 && total !== 2300000; attempt += 1) {
      const rec = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
        app: appId,
        id: recordId,
      });
      total = Number(rec.record[TOTAL_FIELD_CODE].value);
      if (total !== 2300000) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (total !== 2300000) {
      throw new Error(`想定外の集計結果: ${total}`);
    }

    await page.reload({ waitUntil: 'networkidle0' });
    await common.screenshotToDirectory(page, screenshotDir, 'record-detail');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
