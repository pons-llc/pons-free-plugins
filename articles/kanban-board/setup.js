'use strict';

// 記事「kintoneでカンバンボードを作る方法」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// 「案件管理」アプリを想定し、進捗(ドロップダウン)でグループ分けし、優先度(ラジオボタン)を
// バッジ、期限(日付)超過の🔥マーク、担当者(ユーザー選択)チップを一通り見せるデモを作る。
// 対象一覧は「すべて(デフォルト)」(viewIdを空欄のまま追加)で十分なため、calendar_view等の
// e2eテストのような専用ビュー作成は行わない(ARTICLE_APP_IDはこの記事専用に白紙化されるため、
// 他の表示専用プラグインとの競合が発生しない)。
//
// 実行: node articles/kanban-board/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'kanban-board';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../kanban_view/src');

const TITLE_FIELD_CODE = '案件名';
const PROGRESS_FIELD_CODE = '進捗';
const PRIORITY_FIELD_CODE = '優先度';
const DUE_FIELD_CODE = '期限';
const ASSIGNEE_FIELD_CODE = '担当者';

const SEED_RECORDS = [
  {
    title: 'Webサイトリニューアル',
    progress: '対応中',
    priority: '高',
    due: '2026-07-01', // 過去日付 -> 期限超過(🔥)の例
  },
  {
    title: '請求書発行フローの改善',
    progress: '未着手',
    priority: '中',
    due: '2026-09-01',
  },
  {
    title: '社内ポータルの文言修正',
    progress: '完了',
    priority: '低',
    due: '2026-08-01', // 過去日付だが完了列でも超過マークが出ることを見せる
  },
  {
    title: '新人研修資料の作成',
    progress: '対応中',
    priority: '中',
    due: '2026-08-20',
  },
  {
    title: '経費精算ルールの周知',
    progress: '未着手',
    priority: '高',
    due: '2026-08-25',
  },
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
  await page.setViewport({ width: 1280, height: 960 });

  try {
    await common.login(page, env);

    // 1. 白紙に戻す(レコード → フィールド → プラグイン → プロセス管理の順)。
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    // 2. デモ用フィールドを作成(kintone_doc MCPのフィールド形式ドキュメントで確認済みの形)。
    await kintoneAdmin.addFormFields(env, appId, {
      [TITLE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: TITLE_FIELD_CODE,
        label: TITLE_FIELD_CODE,
      },
      [PROGRESS_FIELD_CODE]: {
        type: 'DROP_DOWN',
        code: PROGRESS_FIELD_CODE,
        label: PROGRESS_FIELD_CODE,
        options: {
          未着手: { label: '未着手', index: '0' },
          対応中: { label: '対応中', index: '1' },
          完了: { label: '完了', index: '2' },
        },
      },
      [PRIORITY_FIELD_CODE]: {
        type: 'RADIO_BUTTON',
        code: PRIORITY_FIELD_CODE,
        label: PRIORITY_FIELD_CODE,
        options: {
          高: { label: '高', index: '0' },
          中: { label: '中', index: '1' },
          低: { label: '低', index: '2' },
        },
        align: 'HORIZONTAL',
      },
      [DUE_FIELD_CODE]: {
        type: 'DATE',
        code: DUE_FIELD_CODE,
        label: DUE_FIELD_CODE,
      },
      [ASSIGNEE_FIELD_CODE]: {
        type: 'USER_SELECT',
        code: ASSIGNEE_FIELD_CODE,
        label: ASSIGNEE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 3. プラグインを追加。
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 4. 設定画面: 「すべて(デフォルト)」を追加し、各項目を設定する。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.click('#js-view-add');
    const block = await page.$('.js-view-config-block');

    await block.$eval(
      '.js-title-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      TITLE_FIELD_CODE,
    );
    await (await block.$('.js-group-mode[value="FIELD"]')).click();
    await block.$eval(
      '.js-group-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      PROGRESS_FIELD_CODE,
    );
    await (await block.$('.js-assignee-mode[value="USER_FIELD"]')).click();
    await block.$eval(
      '.js-assignee-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      ASSIGNEE_FIELD_CODE,
    );
    await block.$eval(
      '.js-due-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      DUE_FIELD_CODE,
    );
    await block.$eval(
      '.js-badge-field',
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      },
      PRIORITY_FIELD_CODE,
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

    // 6. デモ用レコードを作成(担当者はログイン中の検証環境アカウント)。
    await kintoneAdmin.addRecords(
      env,
      appId,
      SEED_RECORDS.map((seed) => ({
        [TITLE_FIELD_CODE]: { value: seed.title },
        [PROGRESS_FIELD_CODE]: { value: seed.progress },
        [PRIORITY_FIELD_CODE]: { value: seed.priority },
        [DUE_FIELD_CODE]: { value: seed.due },
        [ASSIGNEE_FIELD_CODE]: { value: [{ code: env.KINTONE_USERNAME }] },
      })),
    );

    // 7. レコード一覧画面(カンバンボード)を撮影する。担当者チップには検証環境の実アカウント名が
    //    表示されるため、撮影前にサンプル名へ画面表示だけを置き換える(保存データは変更しない。
    //    実在する個人名を公開サイトに載せないため)。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.kb-root', { timeout: 15000 });
    await page.evaluate(() => {
      document.querySelectorAll('.kb-assignee').forEach((el) => {
        el.textContent = 'サンプル 太郎';
      });
    });
    await common.screenshotToDirectory(page, screenshotDir, 'kanban-board');

    console.log('done.');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
