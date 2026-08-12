'use strict';

// DATETIME型の繰り返し用フィールドを使った「時間帯を一定間隔で分割」する繰り返し
// (会議室予約枠のようなユースケース)の実環境テスト。bulk-create-flow.e2e.test.jsが
// DATE型+対象者(ユーザー)の組み合わせを検証するのに対し、こちらはDATETIME型+日付の
// 繰り返し(毎日)×時刻の繰り返し(時間帯分割)の直積を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様。
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TITLE_FIELD_CODE = '文字列__1行_';
const DATETIME_FIELD_CODE = '日時';
// 終了日時フィールド(idea.md「終了日時フィールド」参照)。TEST_APP_ID_1に用意されている
// 別のDATETIME型フィールドを使う。
const END_DATETIME_FIELD_CODE = '日時_0';
// bulk_field_updateのE2Eフィクスチャが追加した必須フィールド(idea.md「フォーム内の他の
// 必須フィールド」参照)。
const OTHER_REQUIRED_FIELD_CODE = 'bfu_required_test_field';
const OTHER_REQUIRED_VALUE = 'brc_e2e_required';
const MARKER = `brc_e2e_slot_${Date.now()}`;
const START_DATE = '2031-03-03';
// 開始日から毎日2日分(DAILY, count=2)×9:00-11:00を60分間隔(2枠)の直積で4件を期待する。
const EXPECTED_LOCAL_DATETIMES = [
  '2031-03-03T09:00',
  '2031-03-03T10:00',
  '2031-03-04T09:00',
  '2031-03-04T10:00',
];
// 終了日時は各枠の開始時刻+間隔(60分)で自動計算される。
const EXPECTED_END_LOCAL_DATETIMES = [
  '2031-03-03T10:00',
  '2031-03-03T11:00',
  '2031-03-04T10:00',
  '2031-03-04T11:00',
];

describe('DATETIME型フィールドでの時間帯分割繰り返し(実環境)', () => {
  let browser;
  let page;
  let env;
  let createdIds = [];

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1300 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 対象者フィールドは使わず、繰り返し用フィールド=日時(DATETIME)、
    // 終了日時フィールド=日時_0、テンプレート対象=文字列__1行_・bfu_required_test_field、
    // に設定する。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.select('#js-assignee-field-code', '');
    await page.select('#js-date-field-code', DATETIME_FIELD_CODE);
    // 終了日時フィールドの選択欄は、繰り返し用フィールドがDATETIME型の場合のみ表示される
    // (config.jsのrenderEndDateFieldOptions)。
    await page.waitForFunction(
      () => !document.getElementById('js-end-date-field-row').hidden,
      { timeout: 5000 },
    );
    await page.select('#js-end-date-field-code', END_DATETIME_FIELD_CODE);
    await page.evaluate(
      (titleFieldCode, otherRequiredFieldCode) => {
        const targetCodes = [titleFieldCode, otherRequiredFieldCode];
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
      OTHER_REQUIRED_FIELD_CODE,
    );
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await kintoneAdmin.request(env, '/k/v1/records.json', 'DELETE', {
        app: env.TEST_APP_ID_1,
        ids: createdIds,
      });
    }
    if (browser) {
      await browser.close();
    }
  });

  test('毎日2日分×9:00-11:00を60分間隔で分割した4件が作成される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.brc-bulk-button', { timeout: 15000 });
    await page.click('.brc-bulk-button');
    await page.waitForSelector('.brc-dialog-body', { timeout: 15000 });

    await page.evaluate(
      (titleLabel, titleValue, requiredLabel, requiredValue) => {
        const rows = Array.from(document.querySelectorAll('.brc-template-row'));
        const setValue = (label, value) => {
          const row = rows.find((r) =>
            r.querySelector('.brc-field-label').textContent.includes(label),
          );
          row.querySelector('input[type="text"]').value = value;
        };
        setValue(titleLabel, titleValue);
        setValue(requiredLabel, requiredValue);
      },
      '文字列 (1行)',
      MARKER,
      '一括更新必須テスト',
      OTHER_REQUIRED_VALUE,
    );

    // 日付側: 開始日 + 毎日 + 回数2。時刻側: 「時間帯を一定間隔で分割」9:00-11:00・60分。
    // 依存する値をすべて設定してから最後にchangeイベントを発火させる
    // (bulk-create-flow.e2e.test.jsと同じ理由)。
    await page.evaluate((startDate) => {
      document.querySelector(
        '.brc-recurrence-section input[type="date"]',
      ).value = startDate;
      document.querySelector('.brc-end-condition input[type="number"]').value =
        '2';

      const timeInputs = document.querySelectorAll(
        '.brc-time-range input[type="time"]',
      );
      timeInputs[0].value = '09:00';
      timeInputs[1].value = '11:00';
      document.querySelector('.brc-time-range input[type="number"]').value =
        '60';
      const rangeModeRadioEl = document.querySelector(
        '.brc-time-mode input[value="RANGE"]',
      );
      rangeModeRadioEl.checked = true;

      const frequencyEl = document.querySelector(
        '.brc-recurrence-section select',
      );
      frequencyEl.value = 'DAILY';
      frequencyEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, START_DATE);

    await page.waitForFunction(
      () =>
        document
          .querySelector('.brc-count-display')
          .textContent.includes('4件'),
      { timeout: 5000 },
    );

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    await clickOk();

    // 最終確認ダイアログのプレビューには、UTC表記ではなく入力したローカル日時が「開始 〜 終了」
    // の形式で表示される(idea.md「時刻の繰り返し」「終了日時フィールド」参照)。
    await page.waitForSelector('.brc-preview-list', { timeout: 15000 });
    const previewText = await page.$eval(
      '.brc-preview-list',
      (el) => el.textContent,
    );
    EXPECTED_LOCAL_DATETIMES.forEach((local, i) => {
      expect(previewText).toContain(
        `${local.replace('T', ' ')} 〜 ${EXPECTED_END_LOCAL_DATETIMES[i].replace('T', ' ')}`,
      );
    });

    await clickOk();

    const fetchRecords = () =>
      page.evaluate(
        (
          appId,
          titleFieldCode,
          datetimeFieldCode,
          endDatetimeFieldCode,
          marker,
        ) =>
          kintone
            .api(kintone.api.url('/k/v1/records.json', true), 'GET', {
              app: appId,
              query: `${titleFieldCode} = "${marker}" order by ${datetimeFieldCode} asc`,
              fields: [
                '$id',
                titleFieldCode,
                datetimeFieldCode,
                endDatetimeFieldCode,
              ],
            })
            .then((res) => res.records)
            .catch(() => []),
        Number(env.TEST_APP_ID_1),
        TITLE_FIELD_CODE,
        DATETIME_FIELD_CODE,
        END_DATETIME_FIELD_CODE,
        MARKER,
      );

    let records = [];
    for (let attempt = 0; attempt < 30 && records.length < 4; attempt += 1) {
      records = await fetchRecords();
      if (records.length < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    createdIds = records.map((r) => r.$id.value);

    expect(records).toHaveLength(4);

    // UTC値をこのブラウザのローカルタイムゾーンで復号し、入力したローカル日時と一致するか
    // 確認する(encode/decodeが同じブラウザコンテキストで対称であることを利用する)。
    const decodeLocalDatetimes = (values) =>
      page.evaluate((vs) => {
        const pad2 = (n) => String(n).padStart(2, '0');
        return vs.map((v) => {
          const d = new Date(v);
          return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        });
      }, values);

    const decodedLocalDatetimes = await decodeLocalDatetimes(
      records.map((r) => r[DATETIME_FIELD_CODE].value),
    );
    const decodedEndLocalDatetimes = await decodeLocalDatetimes(
      records.map((r) => r[END_DATETIME_FIELD_CODE].value),
    );

    expect(decodedLocalDatetimes).toEqual(EXPECTED_LOCAL_DATETIMES);
    expect(decodedEndLocalDatetimes).toEqual(EXPECTED_END_LOCAL_DATETIMES);
    records.forEach((record) => {
      expect(record[TITLE_FIELD_CODE].value).toBe(MARKER);
    });

    expect(pageErrors).toEqual([]);
  });
});
