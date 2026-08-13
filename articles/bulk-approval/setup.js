'use strict';

// articles/bulk-approval/setup.js
// 記事「kintoneで複数レコードを一括承認する方法」用に ARTICLE_APP_ID を白紙に戻し、
// bulk_approval プラグインで「(作業者が自分)一覧で、申請中の複数レコードをまとめて承認する」
// デモを実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/bulk-approval/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../bulk_approval/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'bulk-approval';
const TITLE_FIELD_CODE = '件名';
const STATUS_FIELD_CODE = 'ステータス';
const SELF_ASSIGNED_VIEW_NAME = '（作業者が自分）';

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
      [TITLE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: TITLE_FIELD_CODE,
        label: TITLE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // プロセス管理: 未処理(index0)→申請中(index1)→承認済み(index2)。
    // 先頭ステータスの作業者は「レコードの作成者」以外を指定するとREST APIがエラーになるため
    // FIELD_ENTITY(作成者)を使う(bulk_approval/src/e2e/fixtures.jsで実機確認済みの設定)。
    // 申請中の作業者は実行ユーザー自身を明示し、「(作業者が自分)」一覧に乗るようにする。
    await kintoneAdmin.updateProcessManagement(env, appId, {
      enable: true,
      states: {
        未処理: {
          name: '未処理',
          index: '0',
          assignee: { type: 'ONE', entities: [{ entity: { type: 'FIELD_ENTITY', code: '作成者' } }] },
        },
        申請中: {
          name: '申請中',
          index: '1',
          assignee: {
            type: 'ALL',
            entities: [{ entity: { type: 'USER', code: env.KINTONE_USERNAME } }],
          },
        },
        承認済み: {
          name: '承認済み',
          index: '2',
          assignee: { type: 'ONE', entities: [] },
        },
      },
      actions: [
        { name: '申請する', from: '未処理', to: '申請中', type: 'PRIMARY' },
        { name: '承認する', from: '申請中', to: '承認済み', type: 'PRIMARY' },
      ],
    });
    await kintoneAdmin.deployApp(env, appId);

    // プロセス管理を有効にすると一覧が「（作業者が自分）」1件だけになり、承認後(作業者なし)の
    // レコードを一覧で見せるビューが無くなるため、絞り込みなしの「すべてのレコード」ビューを
    // 追加しておく(スクリーンショット用、実行結果の全件確認に使う)。
    await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'PUT', {
      app: appId,
      views: {
        すべてのレコード: {
          index: '1',
          type: 'LIST',
          name: 'すべてのレコード',
          fields: [TITLE_FIELD_CODE, STATUS_FIELD_CODE],
        },
        [SELF_ASSIGNED_VIEW_NAME]: { index: '0', type: 'LIST' },
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 表示項目=件名。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.evaluate(
      (titleFieldCode) => {
        const checkboxEl = document.querySelector(
          `.js-display-fields input[value="${titleFieldCode}"]`,
        );
        if (!checkboxEl) {
          throw new Error('表示項目の候補が見つかりませんでした。');
        }
        checkboxEl.checked = true;
      },
      TITLE_FIELD_CODE,
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
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, appId);

    // デモ用レコードを3件作成し(初期ステータス=未処理)、いずれも「申請する」で申請中へ進める。
    const { ids } = await kintoneAdmin.addRecords(env, appId, [
      { [TITLE_FIELD_CODE]: { value: '出張申請(東京)' } },
      { [TITLE_FIELD_CODE]: { value: '出張申請(大阪)' } },
      { [TITLE_FIELD_CODE]: { value: '出張申請(福岡)' } },
    ]);
    for (const id of ids) {
      await kintoneAdmin.request(env, '/k/v1/record/status.json', 'PUT', {
        app: appId,
        id,
        action: '申請する',
      });
    }

    // 「(作業者が自分)」一覧のIDを取得して直接開く(既定のビューはこれではない場合があるため)。
    const { views } = await kintoneAdmin.request(env, '/k/v1/app/views.json', 'GET', {
      app: appId,
    });
    const selfAssignedView = Object.values(views).find(
      (v) => v.name === SELF_ASSIGNED_VIEW_NAME,
    );
    if (!selfAssignedView) {
      throw new Error('「(作業者が自分)」一覧が見つかりませんでした。');
    }
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${appId}/?view=${selfAssignedView.id}`,
      { waitUntil: 'networkidle0' },
    );
    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.bap-bulk-button'));
      },
      { timeout: 15000 },
    );
    await page.click('.bap-bulk-button');
    await page.waitForSelector('.bap-status-group .bap-record-table tbody tr', {
      timeout: 15000,
    });

    const groupHeading = await page.$eval(
      '.bap-group-heading',
      (el) => el.textContent,
    );
    if (!groupHeading.includes('申請中')) {
      throw new Error(`想定外のグループ見出し: ${groupHeading}`);
    }

    await page.select('.bap-status-group .bap-action-select', '承認する');
    await common.screenshotToDirectory(page, screenshotDir, 'select-dialog');

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    await clickOk();
    await page.waitForSelector('.bap-confirm-body', { timeout: 15000 });
    await common.screenshotToDirectory(page, screenshotDir, 'confirm-dialog');
    await clickOk();

    // 実行完了(alertは自動accept)後、3件とも承認済みになるまでポーリングする。
    let approvedCount = 0;
    for (let attempt = 0; attempt < 30 && approvedCount < 3; attempt += 1) {
      const res = await kintoneAdmin.request(env, '/k/v1/records.json', 'GET', {
        app: appId,
        query: `${STATUS_FIELD_CODE} in ("承認済み")`,
        fields: ['$id'],
      });
      approvedCount = res.records.length;
      if (approvedCount < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (approvedCount < 3) {
      throw new Error(`承認済みになったレコード数が想定と異なります: ${approvedCount}`);
    }

    const { views: viewsAfter } = await kintoneAdmin.request(
      env,
      '/k/v1/app/views.json',
      'GET',
      { app: appId },
    );
    const allRecordsView = Object.values(viewsAfter).find(
      (v) => v.name === 'すべてのレコード',
    );
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/?view=${allRecordsView.id}`, {
      waitUntil: 'networkidle0',
    });
    await common.screenshotToDirectory(page, screenshotDir, 'record-list');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
