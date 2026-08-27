'use strict';

// ラジオボタン連動モードでの挙動を検証する。
// - ヘッダーにはドロップダウンが表示されず、挿入ボタンのみが表示される
// - ラジオボタンの値に対応するテンプレートが無い場合、挿入ボタンは無効化される
// - 対応するテンプレートがある場合、挿入ボタン押下でそのテンプレートが挿入される
//
// 制約: kintoneのラジオボタンのDOM構造(実際の<input type="radio">セレクター)に依存せず
// テストするため、レコード追加画面を開いた直後の初期値(フィールドの初期値設定)に対して
// ボタンの有効/無効・挿入結果を検証する。値変更(change)イベントによるボタン状態の
// 動的な切り替え自体は本テストの対象外(idea.mdの仕様どおりdesktop.js/mobile.jsで実装済みだが、
// UIの実クリックによる検証は行わない)。
//
// 事前準備: config-screen.e2e.test.jsと同じ。実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const { ensureTargetAppFields } = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
// record-insert-flow.e2e.test.jsと同じ理由でgeo_checkinを一時的に取り外す(そちらのコメント参照)。
const GEO_CHECKIN_SRC_DIR = path.join(
  PLUGIN_SRC_DIR,
  '..',
  '..',
  'geo_checkin',
  'src',
);
const GEO_CHECKIN_DISPLAY_NAME = '位置情報強制登録プラグイン';
const TARGET_FIELD_CODE = '文字列__複数行_';
const RADIO_FIELD_CODE = 'ラジオボタン';
// TEST_APP_ID_1のラジオボタンフィールドの初期値(kintone側の設定、fixtures.jsでは変更しない)。
const DEFAULT_RADIO_VALUE = 'sample1';
const UNMAPPED_RADIO_VALUE = 'sample2';

const TEMPLATE_NAME = '承認連動テンプレート';
const TEMPLATE_BODY = `ステータス({${RADIO_FIELD_CODE}})を確認しました。`;

describe('ラジオボタン連動モード(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let geoCheckinPluginId;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    geoCheckinPluginId = common.getPluginId(GEO_CHECKIN_SRC_DIR);
    await ensureTargetAppFields(env, env.TEST_APP_ID_1);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    await common.removeAppPluginByName(
      page,
      env,
      env.TEST_APP_ID_1,
      GEO_CHECKIN_DISPLAY_NAME,
    );

    // TEST_APP_ID_1は他のe2eテストとも共有しており、テンプレートが蓄積したまま残ってしまう
    // ため、このテストで使う設定を組み立てる前に一度空の状態へリセットする
    // (record-insert-flow.e2e.test.jsと同じ理由)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.evaluate(
      (id) =>
        new Promise((resolve) => {
          kintone.plugin.app.setConfig(
            {
              mode: 'DROPDOWN',
              radioFieldCode: '',
              radioMappings: '[]',
              templates: '[]',
            },
            resolve,
          );
        }),
      pluginId,
    );
    // config.js冒頭で読み込んだconfig変数へ反映させるため、プラグイン一覧からの再遷移
    // (common.openPluginConfig)より軽いpage.reload()で読み直す。
    await page.reload({ waitUntil: 'networkidle0' });

    await page.click('#js-template-add');
    const rowIndex =
      (await page.$$eval('.js-template-row', (rows) => rows.length)) - 1;
    await page.evaluate(
      (targetRowIndex, name, targetFieldCode, body) => {
        const rowEl =
          document.querySelectorAll('.js-template-row')[targetRowIndex];
        const setValue = (selector, value) => {
          const el = rowEl.querySelector(selector);
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setValue('.js-template-name', name);
        setValue('.js-template-target', targetFieldCode);
        setValue('.js-template-body', body);
      },
      rowIndex,
      TEMPLATE_NAME,
      TARGET_FIELD_CODE,
      TEMPLATE_BODY,
    );

    await page.select('.js-mode', 'RADIO_LINKED');
    await page.select('.js-radio-field', RADIO_FIELD_CODE);

    // ラジオボタン連動の対応表(js-radio-mapping-row)から、選択肢ラベルが
    // DEFAULT_RADIO_VALUE と一致する行を探し、そのテンプレート選択に今回追加した
    // テンプレートを割り当てる(テンプレートのIDは動的生成のため、名前で一致させる)。
    await page.evaluate(
      (optionValue, templateName) => {
        const rows = Array.from(
          document.querySelectorAll('.js-radio-mapping-row'),
        );
        const targetRow = rows.find(
          (row) =>
            row.querySelector('.js-radio-mapping-option-label').textContent ===
            optionValue,
        );
        const selectEl = targetRow.querySelector('.js-radio-mapping-template');
        // TEST_APP_ID_1は他のe2eテスト実行の積み重ねで同名のテンプレートが複数残っていることが
        // あるため、最後に一致した選択肢(=直前に追加したもの)を選ぶ。
        const matches = Array.from(selectEl.options).filter((o) =>
          o.textContent.startsWith(templateName),
        );
        selectEl.value = matches[matches.length - 1].value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      },
      DEFAULT_RADIO_VALUE,
      TEMPLATE_NAME,
    );

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);

    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  });

  afterAll(async () => {
    await kintoneAdmin.ensurePluginAdded(
      env,
      env.TEST_APP_ID_1,
      geoCheckinPluginId,
    );
    if (browser) {
      await browser.close();
    }
  });

  const openAddScreen = async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    const addLinkEl = await page.$('a.gaia-argoui-app-menu-add');
    await page.evaluate((el) => el.click(), addLinkEl);
    await page.waitForFunction(() => location.href.includes('/edit'));
    await page.waitForSelector('.tmpi-button');
    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
      .catch(() => {});
  };

  test('ドロップダウンは表示されず、挿入ボタンのみが表示される', async () => {
    await openAddScreen();
    const selectCount = await page.$$eval('.tmpi-select', (els) => els.length);
    expect(selectCount).toBe(0);
    const buttonCount = await page.$$eval('.tmpi-button', (els) => els.length);
    expect(buttonCount).toBe(1);
  });

  test('初期値(マッピング済み)では挿入ボタンが有効で、押下するとテンプレートが挿入される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await openAddScreen();

    const radioValue = await page.evaluate(
      (fieldCode) => kintone.app.record.get().record[fieldCode].value,
      RADIO_FIELD_CODE,
    );
    expect(radioValue).toBe(DEFAULT_RADIO_VALUE);

    const disabled = await page.$eval('.tmpi-button', (el) => el.disabled);
    expect(disabled).toBe(false);

    await page.click('.tmpi-button');

    await page.waitForFunction(
      (fieldCode, expected) =>
        kintone.app.record.get().record[fieldCode].value.includes(expected),
      {},
      TARGET_FIELD_CODE,
      `ステータス(${DEFAULT_RADIO_VALUE})を確認しました。`,
    );

    expect(pageErrors).toEqual([]);
  });

  test('対応するテンプレートが無い選択肢に切り替えると、挿入ボタンが無効化される', async () => {
    await openAddScreen();

    // kintone.app.record.set()はkintone標準のchangeイベントを発火しないため、
    // ここだけは実際のラジオボタン入力要素を直接クリックして本物のユーザー操作を再現する
    // (kintoneのラジオボタンフィールドは選択肢コードをそのままinput[value]に使っている、
    // 実環境のDOMで確認済み)。
    await page.click(`input[type="radio"][value="${UNMAPPED_RADIO_VALUE}"]`);

    await page.waitForFunction(
      () => document.querySelector('.tmpi-button').disabled === true,
    );
  });
});
