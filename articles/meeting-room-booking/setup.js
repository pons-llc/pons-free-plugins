'use strict';

// 記事「kintoneで会議室の予約枠を一括作成する方法(平日9-17時を1時間ごとに)」用の
// ARTICLE_APP_IDセットアップ+実行スクリプト。
//
// bulk_record_creationのDATETIME型繰り返し用フィールド+「時間帯を一定間隔で分割」モードを使う
// (organization-inquiryが対象者=組織展開だったのに対し、こちらは日程展開が主役)。
//
// 実行: node articles/meeting-room-booking/setup.js

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'meeting-room-booking';
const PLUGIN_SRC_DIR = path.join(__dirname, '../../bulk_record_creation/src');

const ROOM_FIELD_CODE = '会議室';
const START_FIELD_CODE = '開始日時';
const END_FIELD_CODE = '終了日時';
const ROOM_VALUE = '第1会議室';

// 実行日の翌週の月曜を開始日にする(過去日にならないよう、常に未来の日付を計算する)。
const nextMondayIso = () => {
  const d = new Date();
  const day = d.getDay();
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilNextMonday);
  return d.toISOString().slice(0, 10);
};

const main = async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  const appId = env.ARTICLE_APP_ID;
  if (!appId) {
    throw new Error('.env に ARTICLE_APP_ID が設定されていません。');
  }
  const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
  const startDate = nextMondayIso();

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewport({ width: 1200, height: 1200 });

  try {
    await common.login(page, env);

    // 1. 白紙に戻す(プロセス管理も無効化する。前の記事(approval_history)が有効化したまま
    //    残っていると、一覧のデフォルト表示が「作業者が自分」フィルタになり0件に見える
    //    〈実機で確認済み〉)。
    await kintoneAdmin.deleteAllRecords(env, appId);
    await kintoneAdmin.deleteAllFormFields(env, appId);
    await common.removeAllAppPlugins(page, env, appId);
    await kintoneAdmin.updateProcessManagement(env, appId, { enable: false });
    await kintoneAdmin.deployApp(env, appId);

    // 2. フィールド作成
    await kintoneAdmin.addFormFields(env, appId, {
      [ROOM_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: ROOM_FIELD_CODE,
        label: ROOM_FIELD_CODE,
      },
      [START_FIELD_CODE]: {
        type: 'DATETIME',
        code: START_FIELD_CODE,
        label: START_FIELD_CODE,
      },
      [END_FIELD_CODE]: {
        type: 'DATETIME',
        code: END_FIELD_CODE,
        label: END_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    // 3. プラグインを追加
    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 4. 設定: 対象者フィールドは使わず、繰り返し用フィールド=開始日時(DATETIME)、
    //    終了日時フィールド=終了日時、テンプレート対象=会議室。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.select('#js-assignee-field-code', '');
    await page.select('#js-date-field-code', START_FIELD_CODE);
    await page.waitForFunction(
      () => !document.getElementById('js-end-date-field-row').hidden,
      { timeout: 5000 },
    );
    await page.select('#js-end-date-field-code', END_FIELD_CODE);
    await page.evaluate(
      (roomFieldCode) => {
        document.querySelectorAll('#js-template-field-body tr').forEach((row) => {
          const checkboxEl = row.querySelector('input[type="checkbox"]');
          checkboxEl.checked = checkboxEl.dataset.fieldCode === roomFieldCode;
        });
        document.querySelector('.js-group-codes').value = 'Administrators';
      },
      ROOM_FIELD_CODE,
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

    // 6. レコード一覧画面 → ボタン押下 → Dialog1(テンプレート値+繰り返し日程)入力。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.brc-bulk-button', { timeout: 15000 });
    await page.click('.brc-bulk-button');
    await page.waitForSelector('.brc-dialog-body', { timeout: 15000 });

    await page.evaluate(
      (roomLabel, roomValue) => {
        const rows = Array.from(document.querySelectorAll('.brc-template-row'));
        const row = rows.find((r) =>
          r.querySelector('.brc-field-label').textContent.includes(roomLabel),
        );
        row.querySelector('input[type="text"]').value = roomValue;
      },
      ROOM_FIELD_CODE,
      ROOM_VALUE,
    );

    // 日付側: 開始日+毎日+回数3。時刻側: 「時間帯を一定間隔で分割」9:00-17:00・60分
    // (平日5日ぶんの代わりに3日ぶんに絞り、生成件数を24件に抑える)。
    await page.evaluate((start) => {
      document.querySelector('.brc-recurrence-section input[type="date"]').value = start;
      document.querySelector('.brc-end-condition input[type="number"]').value = '3';

      const timeInputs = document.querySelectorAll('.brc-time-range input[type="time"]');
      timeInputs[0].value = '09:00';
      timeInputs[1].value = '17:00';
      document.querySelector('.brc-time-range input[type="number"]').value = '60';
      document.querySelector('.brc-time-mode input[value="RANGE"]').checked = true;

      const frequencyEl = document.querySelector('.brc-recurrence-section select');
      frequencyEl.value = 'DAILY';
      frequencyEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, startDate);

    await page.waitForFunction(
      () => document.querySelector('.brc-count-display').textContent.includes('24件'),
      { timeout: 5000 },
    );

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    await clickOk(); // Dialog1 -> Dialog2(最終確認)
    await page.waitForSelector('.brc-preview-list', { timeout: 15000 });
    await clickOk(); // Dialog2 -> 実行

    // 7. 24件作成されるまでポーリングする。
    let records = [];
    for (let attempt = 0; attempt < 30 && records.length < 24; attempt += 1) {
      const res = await kintoneAdmin.getRecords(
        env,
        appId,
        `${ROOM_FIELD_CODE} = "${ROOM_VALUE}"`,
      );
      records = res.records;
      if (records.length < 24) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (records.length < 24) {
      throw new Error(
        `期待した件数のレコードが作成されませんでした(期待:24, 実際:${records.length})`,
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
