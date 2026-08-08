'use strict';

// ルックアップフィールドを一括更新の対象にした場合の実環境テスト。他のフィールド型と異なり、
// ルックアップフィールドは確認ダイアログに値の入力欄を出さず、現在の値をそのまま書き戻すことで
// kintone側の自動転記(ルックアップの「ほかのフィールドのコピー」)を再実行させる
// (idea.md「ルックアップフィールドの再取得」、kintone公式Tips「ルックアップの更新を自動で行う」
// で確認した挙動)。このテストでは、コピー先フィールドが古い値のまま(参照先の最新値と
// ずれた状態)のレコードに対して一括更新を実行し、実際に最新の値へ更新されることを確認する。
//
// 事前準備: config-screen.e2e.test.jsと同様。TEST_APP_ID_1の`ne_lookup`
// (TEST_APP_ID_2をルックアップし、`ne_lookup_out`へ`文字列__1行__0`をコピーする設定、
// notebooklm_exportプラグインのテスト用に作成済み)を利用する。
// 実行: pnpm run test:e2e

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const {
  REQUIRED_TEST_FIELD_CODE,
  ensureRequiredTestField,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const LOOKUP_FIELD_CODE = 'ne_lookup';
const LOOKUP_OUT_FIELD_CODE = 'ne_lookup_out';
const LOOKUP_KEY_FIELD_CODE = '文字列__1行_';
const LOOKUP_SOURCE_VALUE_FIELD_CODE = '文字列__1行__0';
const LOOKUP_KEY_VALUE = 'bfu_e2e_lookup_key';
const LOOKUP_COPIED_VALUE = 'BFU_LOOKUP_COPIED_VALUE';
const STALE_OUT_VALUE = 'STALE_VALUE_BEFORE_REFRESH';
const MARKER_FIELD_CODE = '文字列__1行__1';
const MARKER_VALUE = 'bfu_e2e_lookup_refresh_seed';

// TEST_APP_ID_2側に、ルックアップのコピー元となるレコードを1件用意する(冪等)。
const ensureLookupSourceRecord = async (env) => {
  const query = `${LOOKUP_KEY_FIELD_CODE} = "${LOOKUP_KEY_VALUE}" limit 1`;
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    { app: env.TEST_APP_ID_2, query, fields: ['$id'] },
  );
  if (existing.records.length > 0) {
    await kintoneAdmin.request(env, '/k/v1/record.json', 'PUT', {
      app: env.TEST_APP_ID_2,
      id: existing.records[0].$id.value,
      record: {
        [LOOKUP_SOURCE_VALUE_FIELD_CODE]: { value: LOOKUP_COPIED_VALUE },
      },
    });
    return;
  }
  await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: env.TEST_APP_ID_2,
    record: {
      [LOOKUP_KEY_FIELD_CODE]: { value: LOOKUP_KEY_VALUE },
      [LOOKUP_SOURCE_VALUE_FIELD_CODE]: { value: LOOKUP_COPIED_VALUE },
    },
  });
};

// このテスト専用のレコードを1件だけ用意する(既存レコードを巻き込まない、冪等)。
// ルックアップフィールドの値はコピー元のキーに合わせ、コピー先はあえて古い値のままにしておく。
const ensureSeedRecord = async (env) => {
  const query = `${MARKER_FIELD_CODE} = "${MARKER_VALUE}" limit 1`;
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    { app: env.TEST_APP_ID_1, query, fields: ['$id'] },
  );
  const record = {
    [LOOKUP_FIELD_CODE]: { value: LOOKUP_KEY_VALUE },
    [LOOKUP_OUT_FIELD_CODE]: { value: STALE_OUT_VALUE },
  };
  if (existing.records.length > 0) {
    const id = existing.records[0].$id.value;
    await kintoneAdmin.request(env, '/k/v1/record.json', 'PUT', {
      app: env.TEST_APP_ID_1,
      id,
      record,
    });
    return id;
  }
  const created = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: env.TEST_APP_ID_1,
    record: {
      ...record,
      [MARKER_FIELD_CODE]: { value: MARKER_VALUE },
      // このアプリのbfu_required_test_fieldは必須のため、レコード作成には値が要る
      // (bulk-update-flow.e2e.test.jsのfixtures.jsで作成済みの想定だが、このテストを
      // 単独実行する場合に備えてbeforeAllでも冪等に作成しておく)。
      [REQUIRED_TEST_FIELD_CODE]: { value: 'lookup_refresh_test_placeholder' },
    },
  });
  return created.id;
};

describe('ルックアップフィールドの一括更新(実環境)', () => {
  let browser;
  let page;
  let env;
  let pluginId;
  let recordId;
  let scopedQuery;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    await ensureRequiredTestField(env, env.TEST_APP_ID_1, kintoneAdmin);

    await ensureLookupSourceRecord(env);
    recordId = await ensureSeedRecord(env);
    scopedQuery = `$id = ${recordId}`;

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 900 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 対象フィールドとしてne_lookupだけをONにする(それ以外はOFFにする、冪等)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const rows = await page.$$('.js-row');
    for (const row of rows) {
      const label = await row.$eval(':nth-child(2)', (el) => el.textContent);
      const shouldBeEnabled = label.includes(`(${LOOKUP_FIELD_CODE})`);
      await row.$eval(
        '.js-row-enabled',
        (el, checked) => {
          el.checked = checked;
        },
        shouldBeEnabled,
      );
    }
    await page.evaluate(() => {
      document.querySelector('.js-group-codes').value = 'Administrators';
    });
    await Promise.all([
      page.waitForFunction(() => !location.href.includes('plugin/config')),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
    // プラグイン設定の保存はプレビューにしか反映されないため、明示的にデプロイする。
    await kintoneAdmin.deployApp(env, env.TEST_APP_ID_1);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('種類欄に「ルックアップ」と表示され、確認ダイアログには値の入力欄が出ず、実行すると関連レコードの最新値へ更新される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 設定画面の種類欄で、ne_lookupが通常の文字列(1行)と区別できることを確認する
    // (バグ報告: 種類欄にルックアップの表示が無く見分けが付かなかった)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    const rows = await page.$$('.js-row');
    let typeText = null;
    for (const row of rows) {
      const label = await row.$eval(':nth-child(2)', (el) => el.textContent);
      if (label.includes(`(${LOOKUP_FIELD_CODE})`)) {
        typeText = await row.$eval(':nth-child(3)', (el) => el.textContent);
        break;
      }
    }
    expect(typeText).toContain('ルックアップ');

    // 一覧画面ボタンから確認ダイアログを開く。
    const url = `https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/?query=${encodeURIComponent(scopedQuery)}`;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(
      () => {
        const el = kintone.app.getHeaderMenuSpaceElement();
        return !!(el && el.querySelector('.bfu-bulk-button'));
      },
      { timeout: 15000 },
    );
    await page.click('.bfu-bulk-button');
    await page.waitForSelector('.bfu-confirm-body', { timeout: 15000 });

    // ルックアップフィールドの行には値の入力欄が無く、注記が表示される。
    const hasValueInput = await page.evaluate(
      () => !!document.querySelector('.bfu-value-input'),
    );
    expect(hasValueInput).toBe(false);
    const noteText = await page.$eval(
      '.bfu-lookup-note',
      (el) => el.textContent,
    );
    expect(noteText).toContain('現在の値のまま更新');

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    await clickOk();

    // 最終確認ダイアログにも、値の入力ではなく「現在の値のまま更新」という説明が表示される。
    await page.waitForSelector('.bfu-final-summary-list', { timeout: 15000 });
    const finalSummaryText = await page.$eval(
      '.bfu-final-summary-list',
      (el) => el.textContent,
    );
    expect(finalSummaryText).toContain('現在の値のまま更新');

    await clickOk();

    // 書き戻し完了後、コピー先フィールド(ne_lookup_out)が参照先アプリの最新値に
    // 更新されるまで待つ(完了時のalertはbeforeAllで登録したdialogハンドラーが自動acceptする)。
    await page.waitForFunction(
      (appId, id, outFieldCode, expectedValue) =>
        kintone
          .api(kintone.api.url('/k/v1/record.json', true), 'GET', {
            app: appId,
            id,
          })
          .then((res) => res.record[outFieldCode].value === expectedValue)
          .catch(() => false),
      { timeout: 30000, polling: 1000 },
      Number(env.TEST_APP_ID_1),
      recordId,
      LOOKUP_OUT_FIELD_CODE,
      LOOKUP_COPIED_VALUE,
    );

    expect(pageErrors).toEqual([]);
  });
});
