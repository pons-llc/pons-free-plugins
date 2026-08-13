'use strict';

// articles/bulk-record-creation/setup.js
// 記事「kintoneでレコードを一括作成する方法」用に ARTICLE_APP_ID を白紙に戻し、
// bulk_record_creation プラグインで「毎週の定例会議レコードをまとめて作成する」デモを
// 実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/bulk-record-creation/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../bulk_record_creation/src');
// puppeteerはこのリポジトリ直下には存在せず、紹介するプラグイン(bulk_record_creation)の
// node_modulesにe2eテスト用の依存として入っているため、そこから読み込む。
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'bulk-record-creation';

const TITLE_FIELD_CODE = '会議名';
const PLACE_FIELD_CODE = '場所';
const DATE_FIELD_CODE = '開催日';

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
  await page.setViewport({ width: 1280, height: 900 });

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
      [PLACE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: PLACE_FIELD_CODE,
        label: PLACE_FIELD_CODE,
      },
      [DATE_FIELD_CODE]: {
        type: 'DATE',
        code: DATE_FIELD_CODE,
        label: DATE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 繰り返し用日付フィールド=開催日、テンプレート対象=会議名・場所。
    // 対象者フィールドは未選択のまま(ユーザー/組織割り当てのデモは articles/organization-inquiry
    // 側で扱っているため、この記事では日程の繰り返し機能に絞る)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.select('#js-date-field-code', DATE_FIELD_CODE);
    await page.evaluate(
      (titleFieldCode, placeFieldCode) => {
        const targetCodes = [titleFieldCode, placeFieldCode];
        const rows = Array.from(
          document.querySelectorAll('#js-template-field-body tr'),
        );
        rows.forEach((row) => {
          const checkboxEl = row.querySelector('input[type="checkbox"]');
          checkboxEl.checked = targetCodes.includes(
            checkboxEl.dataset.fieldCode,
          );
        });
        document.querySelector('.js-group-codes').value = 'Administrators';
      },
      TITLE_FIELD_CODE,
      PLACE_FIELD_CODE,
    );
    const screenshotDir = path.join(
      repoRoot,
      'site',
      'articles',
      ARTICLE_SLUG,
      'screenshots',
    );
    await common.screenshotToDirectory(page, screenshotDir, 'config-screen');
    await common.savePluginConfig(page);
    await kintoneAdmin.deployApp(env, appId);

    // 一覧画面のボタンから、毎週水曜(定例会議)を4回ぶん一括作成する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.brc-bulk-button', { timeout: 15000 });
    await page.click('.brc-bulk-button');
    await page.waitForSelector('.brc-dialog-body', { timeout: 15000 });

    await page.evaluate(
      (titleLabel, titleValue, placeLabel, placeValue) => {
        const rows = Array.from(document.querySelectorAll('.brc-template-row'));
        const findRow = (label) =>
          rows.find((r) =>
            r.querySelector('.brc-field-label').textContent.includes(label),
          );
        findRow(titleLabel).querySelector('input[type="text"]').value =
          titleValue;
        findRow(placeLabel).querySelector('input[type="text"]').value =
          placeValue;
      },
      '会議名',
      '定例進捗会議',
      '場所',
      '第1会議室',
    );

    // 開始日(次の水曜)・頻度=毎週・曜日=水曜・回数=4件。
    const startDate = '2031-03-05'; // 水曜日
    await page.evaluate((start) => {
      document.querySelector(
        '.brc-recurrence-section input[type="date"]',
      ).value = start;
      const frequencyEl = document.querySelector(
        '.brc-recurrence-section select',
      );
      frequencyEl.value = 'WEEKLY';
      frequencyEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, startDate);
    await page.evaluate(() => {
      const checkboxEl = document.querySelector(
        '.brc-weekdays input[type="checkbox"][value="3"]',
      ); // 0=日,...,3=水
      checkboxEl.checked = true;
      checkboxEl.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('.brc-end-condition input[type="number"]').value =
        '4';
      document
        .querySelector('.brc-end-condition input[type="number"]')
        .dispatchEvent(new Event('input', { bubbles: true }));
    });

    const countText = await page.$eval(
      '.brc-count-display',
      (el) => el.textContent,
    );
    if (!countText.includes('4件')) {
      throw new Error(`想定外の件数表示: ${countText}`);
    }

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    await clickOk();
    await page.waitForSelector('.brc-preview-list', { timeout: 15000 });

    // 最終確認ダイアログのスクリーンショット(プレビュー一覧)。
    await common.screenshotToDirectory(page, screenshotDir, 'preview-dialog');

    await clickOk();

    // 作成完了後、レコード一覧のスクリーンショット。kintoneのダイアログはDOM上に残ったまま
    // hiddenになるだけの場合があるため、要素の消滅ではなくレコードが実際に作成されたことを
    // REST APIでポーリングして確認する(bulk_record_creationのe2eテストと同じ方針)。
    const fetchCreatedCount = () =>
      page.evaluate(
        (appIdNum, titleFieldCode, titleValue) =>
          kintone
            .api(kintone.api.url('/k/v1/records.json', true), 'GET', {
              app: appIdNum,
              query: `${titleFieldCode} = "${titleValue}"`,
              fields: ['$id'],
            })
            .then((res) => res.records.length)
            .catch(() => 0),
        Number(appId),
        TITLE_FIELD_CODE,
        '定例進捗会議',
      );
    let createdCount = 0;
    for (let attempt = 0; attempt < 30 && createdCount < 4; attempt += 1) {
      createdCount = await fetchCreatedCount();
      if (createdCount < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (createdCount < 4) {
      throw new Error(`作成されたレコード数が想定と異なります: ${createdCount}`);
    }

    await page.reload({ waitUntil: 'networkidle0' });
    await common.screenshotToDirectory(page, screenshotDir, 'record-list');
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
