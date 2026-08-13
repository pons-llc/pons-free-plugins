'use strict';

// articles/bulk-field-update/setup.js
// 記事「kintoneのレコードを一括更新する方法」用に ARTICLE_APP_ID を白紙に戻し、
// bulk_field_update プラグインで「一覧の対応状況をまとめて『対応済み』に変更する」デモを
// 実行してスクリーンショットを撮る(scripts/templates/article-setup.template.js のコピー)。
//
// 実行: node articles/bulk-field-update/setup.js

const path = require('path');
const PLUGIN_SRC_DIR = path.join(__dirname, '../../bulk_field_update/src');
const puppeteer = require(path.join(PLUGIN_SRC_DIR, 'node_modules/puppeteer'));
const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const ARTICLE_SLUG = 'bulk-field-update';

const TITLE_FIELD_CODE = '件名';
const STATUS_FIELD_CODE = '対応状況';
const NOTE_FIELD_CODE = '備考';

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
      [STATUS_FIELD_CODE]: {
        type: 'RADIO_BUTTON',
        code: STATUS_FIELD_CODE,
        label: STATUS_FIELD_CODE,
        options: {
          未対応: { label: '未対応', index: '0' },
          対応中: { label: '対応中', index: '1' },
          対応済み: { label: '対応済み', index: '2' },
        },
        align: 'HORIZONTAL',
        defaultValue: '未対応',
      },
      [NOTE_FIELD_CODE]: {
        type: 'SINGLE_LINE_TEXT',
        code: NOTE_FIELD_CODE,
        label: NOTE_FIELD_CODE,
      },
    });
    await kintoneAdmin.deployApp(env, appId);

    await kintoneAdmin.addPlugin(env, appId, pluginId);
    await kintoneAdmin.deployApp(env, appId);

    // 設定画面: 対象フィールド=対応状況・備考(件名は対象外のまま)。
    await common.openPluginConfig(page, env, appId, pluginId);
    await page.evaluate(
      (statusFieldCode, noteFieldCode) => {
        const targetCodes = [statusFieldCode, noteFieldCode];
        const rows = Array.from(document.querySelectorAll('.js-row'));
        rows.forEach((row) => {
          const labelText = row.children[1].textContent;
          const isTarget = targetCodes.some((code) =>
            labelText.includes(`(${code})`),
          );
          row.querySelector('.js-row-enabled').checked = isTarget;
        });
        document.querySelector('.js-group-codes').value = 'Administrators';
      },
      STATUS_FIELD_CODE,
      NOTE_FIELD_CODE,
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

    // デモ用レコードを3件作成する(すべて対応状況=未対応)。
    await kintoneAdmin.addRecords(env, appId, [
      {
        [TITLE_FIELD_CODE]: { value: '問い合わせ対応1' },
        [STATUS_FIELD_CODE]: { value: '未対応' },
      },
      {
        [TITLE_FIELD_CODE]: { value: '問い合わせ対応2' },
        [STATUS_FIELD_CODE]: { value: '未対応' },
      },
      {
        [TITLE_FIELD_CODE]: { value: '問い合わせ対応3' },
        [STATUS_FIELD_CODE]: { value: '未対応' },
      },
    ]);

    // 一覧画面(絞り込みなし=全件が対象)でボタンを押し、対応状況・備考を一括更新する。
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${appId}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.bfu-bulk-button'));
      },
      { timeout: 15000 },
    );
    await page.click('.bfu-bulk-button');
    await page.waitForSelector('.bfu-confirm-body', { timeout: 15000 });

    const dialogText = await page.$eval(
      '.bfu-confirm-message',
      (el) => el.textContent,
    );
    if (!dialogText.includes('対象レコード数: 3件')) {
      throw new Error(`想定外の対象件数表示: ${dialogText}`);
    }

    await common.screenshotToDirectory(page, screenshotDir, 'confirm-dialog');

    await page.evaluate(
      (statusLabel, statusValue, noteLabel, noteValue) => {
        const rows = Array.from(document.querySelectorAll('.bfu-confirm-row'));
        rows.forEach((row) => {
          const labelText = row.querySelector('.bfu-field-name').textContent;
          if (labelText.startsWith(statusLabel)) {
            row.querySelector('select.bfu-value-input').value = statusValue;
          } else if (labelText.startsWith(noteLabel)) {
            row.querySelector('.bfu-value-input').value = noteValue;
          }
        });
      },
      '対応状況',
      '対応済み',
      '備考',
      '一括更新済み',
    );

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    await clickOk();
    await page.waitForSelector('.bfu-final-summary-list', { timeout: 15000 });
    await clickOk();

    // 書き戻し完了(3件とも対応状況=対応済みになる)まで待つ(REST APIでポーリング)。
    let doneCount = 0;
    for (let attempt = 0; attempt < 30 && doneCount < 3; attempt += 1) {
      const res = await kintoneAdmin.request(env, '/k/v1/records.json', 'GET', {
        app: appId,
        query: `${STATUS_FIELD_CODE} in ("対応済み")`,
        fields: ['$id'],
      });
      doneCount = res.records.length;
      if (doneCount < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (doneCount < 3) {
      throw new Error(`更新されたレコード数が想定と異なります: ${doneCount}`);
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
