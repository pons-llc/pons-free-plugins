'use strict';

// 記事「kintoneで決裁履歴を自動で記録する方法」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// このプラグインはプロセス管理のアクション実行(ステータス変化)をフックするため、
// ARTICLE_APP_IDにプロセス管理(未処理→承認済み、「承認する」アクション)を設定してから使う。
//
// 実行: node articles/approval-history/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'approval-history';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../approval_history/src');
const TABLE_CODE = 'approval_history_table';
const TITLE_FIELD_CODE = '件名';

const PROCESS_SETTINGS = {
  enable: true,
  states: {
    未処理: { name: '未処理', index: '0', assignee: { type: 'ONE', entities: [] } },
    承認済み: { name: '承認済み', index: '1', assignee: { type: 'ONE', entities: [] } },
  },
  actions: [
    { name: '承認する', from: '未処理', to: '承認済み', type: 'PRIMARY' },
  ],
};

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

    // 1. 白紙に戻す(プロセス管理も一旦無効化してからやり直す)。
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    // 2. フィールド作成(件名)。
    await kintoneAdmin.addFormFields(env, appId, {
      [TITLE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: TITLE_FIELD_CODE,
        label: TITLE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 3. プロセス管理を設定(未処理→承認済み、「承認する」アクション)。
    await kintoneAdmin.updateProcessManagement(env, appId, PROCESS_SETTINGS);
    await kintoneAdmin.deployApp(env, appId);

    // 4. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 5. 設定画面を開いて保存する(決裁履歴テーブルを自動作成させる)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
      page.click('.js-save-button'),
    ]);
    await kintoneAdmin.deployApp(env, appId);

    // 6. 設定画面のスクリーンショット。
    await common.openPluginConfig(page, env, appId, pluginId);
    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    // 7. レコードを1件作成する(初期ステータス=未処理)。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
    await page.evaluate(
      (fieldCode) => {
        const current = kintone.app.record.get().record;
        current[fieldCode].value = '出張申請(サンプル)';
        kintone.app.record.set({ record: current });
      },
      TITLE_FIELD_CODE,
    );
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('.gaia-ui-actionmenu-save'),
    ]);
    const listRecordId = new URL(page.url()).hash.match(/record=(\d+)/)[1];

    // 8. 詳細画面でプロセスアクション「承認する」ボタンを押し、ステータスを進める。
    //    このボタンは<button>タグではなく`span.gaia-app-statusbar-action`(kintone標準の
    //    プロセス管理アクションボタン)で、`<button>`セレクターでは見つからない(実機で確認済み)。
    //    座標指定のpage.mouse.click()で押す(auto_lookupの編集リンクと同じ理由)。
    await page.waitForFunction(() => document.body.innerText.includes('承認する'), {
      timeout: 15000,
    });
    const actionHandle = await page.evaluateHandle(() =>
      Array.from(document.querySelectorAll('.gaia-app-statusbar-action')).find(
        (el) => el.textContent.trim() === '承認する',
      ),
    );
    const actionEl = actionHandle.asElement();
    if (!actionEl) {
      throw new Error('プロセスアクション「承認する」ボタンが見つかりませんでした。');
    }
    const actionBox = await actionEl.boundingBox();
    await page.mouse.click(
      actionBox.x + actionBox.width / 2,
      actionBox.y + actionBox.height / 2,
    );

    // クリックすると「次のステータス: 承認済み」の確認ポップオーバーが開くだけで、まだ
    // 実行はされない(実機で確認済み)。「実行」ボタンを押して確定させる。
    await page.waitForFunction(() => document.body.innerText.includes('実行'), {
      timeout: 5000,
    });
    const confirmHandle = await page.evaluateHandle(() =>
      Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent.trim() === '実行',
      ),
    );
    const confirmEl = confirmHandle.asElement();
    if (!confirmEl) {
      throw new Error('プロセスアクションの確認ダイアログの「実行」ボタンが見つかりませんでした。');
    }
    await confirmEl.click();

    // 9. 決裁履歴テーブルに行が追記されるのを、実行ユーザーの値が入るまでREST APIでポーリングする
    //    (kintone.app.record.get()は詳細画面でのプロセスアクション実行後もその場では更新
    //    されなかった〈実機で確認済み〉ため、サーバー側の実データをREST経由で確認する)。
    const recordId = listRecordId;
    let hasHistoryRow = false;
    for (let attempt = 0; attempt < 20 && !hasHistoryRow; attempt += 1) {
      const rec = await kintoneAdmin.request(env, '/k/v1/record.json', 'GET', {
        app: appId,
        id: recordId,
      });
      const rows = rec.record[TABLE_CODE].value;
      hasHistoryRow = rows.some((row) => row.value.executed_by.value.length > 0);
      if (!hasHistoryRow) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (!hasHistoryRow) {
      throw new Error('決裁履歴テーブルに実行ユーザーが記録されませんでした。');
    }

    // 10. 画面を再読み込みして最新の状態を表示してからスクリーンショットを撮る。
    await page.reload({ waitUntil: 'networkidle0' });
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
