'use strict';

// 記事「kintoneで全部署に一斉に調査照会を作成する方法(レコード一括作成プラグイン)」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。scripts/templates/article-setup.template.jsを
// この記事向けに具体化したもの(article-app-setup skill参照)。
//
// シナリオ: ある部署が、社内のすべての組織(部署)に対して一斉に調査照会レコードを作成する。
// bulk_record_creationの対象者フィールド=ORGANIZATION_SELECT、「組織を複数選択」モード
// (1組織=1レコード)を使う。繰り返し日程機能は使わない(このシナリオでは不要)。
//
// 実行: node articles/organization-inquiry/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'organization-inquiry';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../bulk_record_creation/src');

const ASSIGNEE_FIELD_CODE = '依頼先組織';
const TITLE_FIELD_CODE = '調査件名';
const DEADLINE_FIELD_CODE = '回答期限';
const DETAIL_FIELD_CODE = '調査内容';

const TITLE_VALUE = '令和8年度 事務用品の使用状況調査';
const DEADLINE_VALUE = '2026-09-30';
const DETAIL_VALUE =
  '各部署で使用している事務用品の在庫状況を、期限までにご回答ください。';

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

    // 2. フィールド作成
    await kintoneAdmin.addFormFields(env, appId, {
      [ASSIGNEE_FIELD_CODE]: {
        type: 'ORGANIZATION_SELECT',
        code: ASSIGNEE_FIELD_CODE,
        label: ASSIGNEE_FIELD_CODE,
      },
      [TITLE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: TITLE_FIELD_CODE,
        label: TITLE_FIELD_CODE,
      },
      [DEADLINE_FIELD_CODE]: {
        type: 'DATE',
        code: DEADLINE_FIELD_CODE,
        label: DEADLINE_FIELD_CODE,
      },
      [DETAIL_FIELD_CODE]: {
        type: 'MULTI_LINE_TEXT',
        code: DETAIL_FIELD_CODE,
        label: DETAIL_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 3. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 4. 設定: 対象者フィールド=依頼先組織(ORGANIZATION_SELECT)、
    //    テンプレート対象=調査件名・回答期限・調査内容。繰り返し日程は使わない。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.select('#js-assignee-field-code', ASSIGNEE_FIELD_CODE);
    await page.evaluate(
      (titleCode, deadlineCode, detailCode) => {
        const targetCodes = [titleCode, deadlineCode, detailCode];
        document
          .querySelectorAll('#js-template-field-body tr')
          .forEach((row) => {
            const checkboxEl = row.querySelector('input[type="checkbox"]');
            checkboxEl.checked = targetCodes.includes(
              checkboxEl.dataset.fieldCode,
            );
          });
        document.querySelector('.js-group-codes').value = 'Administrators';
      },
      TITLE_FIELD_CODE,
      DEADLINE_FIELD_CODE,
      DETAIL_FIELD_CODE,
    );
    await common.savePluginConfig(page);
    await kintoneAdmin.deployApp(env, appId);

    // 5. 設定画面のスクリーンショット(保存直後、値が入った状態を再度開いて撮る)。
    await common.openPluginConfig(page, env, appId, pluginId);
    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');

    // 6. レコード一覧画面 → ボタン押下 → Dialog1(テンプレート値+対象者)入力
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.brc-bulk-button', { timeout: 15000 });
    await page.click('.brc-bulk-button');
    await page.waitForSelector('.brc-dialog-body', { timeout: 15000 });

    await page.evaluate(
      (
        titleLabel,
        titleValue,
        deadlineLabel,
        deadlineValue,
        detailLabel,
        detailValue,
      ) => {
        const rows = Array.from(
          document.querySelectorAll('.brc-template-row'),
        );
        const findRow = (label) =>
          rows.find((r) =>
            r.querySelector('.brc-field-label').textContent.includes(label),
          );
        findRow(titleLabel).querySelector('input[type="text"]').value =
          titleValue;
        findRow(deadlineLabel).querySelector('input[type="date"]').value =
          deadlineValue;
        findRow(detailLabel).querySelector('textarea').value = detailValue;
      },
      TITLE_FIELD_CODE,
      TITLE_VALUE,
      DEADLINE_FIELD_CODE,
      DEADLINE_VALUE,
      DETAIL_FIELD_CODE,
      DETAIL_VALUE,
    );

    // 対象者: 組織ツリーの読み込みを待ち、表示されている組織すべてにチェックを入れる
    // (「社内のすべての組織に対して」のシナリオ)。
    await page.waitForSelector('.brc-assignee-section .brc-org-tree-row', {
      timeout: 15000,
    });
    const selectedOrgCount = await page.evaluate(() => {
      const boxes = document.querySelectorAll(
        '.brc-assignee-section .brc-org-tree input[type="checkbox"]',
      );
      boxes.forEach((cb) => {
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      });
      return boxes.length;
    });
    if (selectedOrgCount === 0) {
      throw new Error(
        '検証環境に組織が1件も見つかりませんでした(/v1/organizations.json)。',
      );
    }

    await page.waitForFunction(
      (n) =>
        document.querySelector('.brc-count-display').textContent.includes(
          `${n}件`,
        ),
      { timeout: 5000 },
      selectedOrgCount,
    );

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    await clickOk(); // Dialog1 -> Dialog2(最終確認)
    await page.waitForSelector('.brc-preview-list', { timeout: 15000 });
    await clickOk(); // Dialog2 -> 実行

    // 7. レコードが作成され、検索結果へ反映されるまでポーリングする
    //    (kintoneのレコード検索は更新直後に短いタイムラグが生じることがある)。
    let records = [];
    for (let attempt = 0; attempt < 30 && records.length < selectedOrgCount; attempt++) {
      const res = await kintoneAdmin.getRecords(
        env,
        appId,
        `${TITLE_FIELD_CODE} = "${TITLE_VALUE}"`,
      );
      records = res.records;
      if (records.length < selectedOrgCount) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (records.length < selectedOrgCount) {
      throw new Error(
        `期待した件数のレコードが作成されませんでした(期待:${selectedOrgCount}, 実際:${records.length})`,
      );
    }

    // 8. レコード一覧のスクリーンショット。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await common.screenshotToDirectory(page, screenshotDir, 'record-list');

    console.log(`done. created ${records.length} records.`);
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
