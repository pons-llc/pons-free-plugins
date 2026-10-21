'use strict';

// 依頼の作成(アプリ検索 → フィールド選択 → 変更内容)から、プロセス管理の「承認する」(→完了)で
// 対象アプリへ反映・運用環境へ反映されるまでを実環境で確認する。
//
// 対象アプリ(TARGET_APP_ID)の「件名(title)」を必須にする依頼を使い、各テストの前に任意へ戻す。
// プロセス管理のアクションボタン(span.gaia-app-statusbar-action)はkintone内部のDOMのため、
// 実環境で確認したセレクターを使う(2026-10-21)。
//
// NOTE: 「対象アプリの管理権限がない」ケースは、検証環境に管理者以外のユーザーがいないため
// E2Eでは確認できない。apply-runner.test.js(CB_NO02)のユニットテストで担保している。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');
const ChangeRequest = require('../js/lib/change-request.js');
const { makeFlowHelpers } = require('./flow-helpers');
const {
  REQUEST_APP_ID,
  TARGET_APP_ID,
  resetTargetApp,
  ensureRequestApp,
} = require('./fixtures');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');

let browser;
let page;
let env;
let pluginId;
const pageErrors = [];

const requiredChange = () =>
  ChangeRequest.buildChange({
    app: { id: TARGET_APP_ID, name: '[e2e] 変更対象', guestSpaceId: '' },
    field: {
      code: 'title',
      label: '件名',
      type: 'SINGLE_LINE_TEXT',
      subtableCode: '',
    },
    operation: 'required',
    before: false,
    after: true,
  });

const {
  createPendingRequest,
  getLiveFields,
  getRecord,
  openDetail,
  approve,
  waitForStatus,
} = makeFlowHelpers({ getPage: () => page, getEnv: () => env });

describe('依頼の作成と完了時の反映(実環境)', () => {
  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, REQUEST_APP_ID, pluginId);
    await ensureRequestApp(env, env.KINTONE_USERNAME);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await common.login(page, env);
  }, 240000);

  beforeEach(async () => {
    await resetTargetApp(env);
  }, 120000);

  afterAll(async () => {
    if (env) {
      await resetTargetApp(env);
    }
    if (browser) {
      await browser.close();
    }
  }, 120000);

  test('追加画面: アプリを検索してフィールド・変更内容を選び、依頼を保存できる', async () => {
    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${REQUEST_APP_ID}/edit`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.asr-editor');

    await page.type('.asr-js-keyword', '変更対象');
    await page.$eval('.asr-js-search', (el) => el.click());
    await page.waitForFunction(
      (id) =>
        !document.querySelector('.asr-js-app-results').hidden &&
        !!document.querySelector(`.asr-js-app-results option[value="${id}"]`),
      { timeout: 30000 },
      TARGET_APP_ID,
    );
    await page.select('.asr-js-app-results', TARGET_APP_ID);
    await page.waitForFunction(
      () =>
        !document.querySelector('.asr-js-field').disabled &&
        !!document.querySelector('.asr-js-field option[value="tbl/item"]'),
      { timeout: 30000 },
    );
    const status = await page.$eval(
      '.asr-js-app-status',
      (el) => el.textContent,
    );
    expect(status).toContain(`アプリID: ${TARGET_APP_ID}`);

    await page.select('.asr-js-field', 'title');
    await page.select('.asr-js-operation', 'required');
    const current = await page.$eval('.asr-js-current', (el) => el.textContent);
    expect(current).toBe('現在: 任意');
    // 初期表示は「現在と逆」(必須)が選ばれている
    const checked = await page.$eval(
      'input.asr-js-bool:checked',
      (el) => el.value,
    );
    expect(checked).toBe('true');
    await page.type(
      `.control-multiple_line_text-field-gaia textarea`,
      'E2Eテスト',
    );

    await Promise.all([
      page.waitForFunction(() => location.href.includes('/show'), {
        timeout: 60000,
      }),
      page.$eval('.gaia-ui-actionmenu-save', (el) => el.click()),
    ]);
    const id = new URL(page.url()).hash.match(/record=(\d+)/)[1];
    const record = await getRecord(id);
    expect(record.asr_app_id.value).toBe(TARGET_APP_ID);
    expect(record.asr_field_label.value).toBe('件名(title)');
    expect(record.asr_operation.value).toBe('必須項目の設定');
    const parsed = ChangeRequest.parseChange(record.asr_change_json.value);
    expect(parsed.ok).toBe(true);
    expect(parsed.change.after).toBe(true);

    await page.waitForSelector('.asr-detail');
    const detail = await page.$eval('.asr-detail', (el) => el.innerText);
    expect(detail).toContain('必須');
    expect(detail).toContain(`アプリID: ${TARGET_APP_ID}`);

    // 編集画面で依頼内容が復元される
    await common.goToEditScreenFromDetail(page);
    await page.waitForFunction(
      () => document.querySelector('.asr-js-operation').value === 'required',
      { timeout: 30000 },
    );
    expect(await page.$eval('.asr-js-field', (el) => el.value)).toBe('title');
    expect(pageErrors).toEqual([]);
  }, 180000);

  test('「承認する」(→完了)で対象アプリへ反映し、運用環境へ反映する', async () => {
    const id = await createPendingRequest(requiredChange());
    await openDetail(id);
    await approve();
    const record = await waitForStatus(id, '完了');

    const live = await getLiveFields(TARGET_APP_ID);
    expect(live.title.required).toBe(true);
    // 未反映の変更が残っていない(デプロイ済み)
    const preview = await kintoneAdmin.request(
      env,
      '/k/v1/preview/app/form/fields.json',
      'GET',
      { app: TARGET_APP_ID },
    );
    const liveResp = await kintoneAdmin.request(
      env,
      '/k/v1/app/form/fields.json',
      'GET',
      { app: TARGET_APP_ID },
    );
    expect(preview.revision).toBe(liveResp.revision);
    expect(record.asr_result.value).toContain('運用環境へ反映しました');
    expect(record.asr_applied_at.value).not.toBe('');
    expect(pageErrors).toEqual([]);
  }, 240000);

  test('確認ダイアログに依頼内容が表示され、キャンセルするとステータスも対象アプリも変わらない', async () => {
    const id = await createPendingRequest(requiredChange());
    await openDetail(id);
    const dialogText = await approve('cancel');
    expect(dialogText).toContain('件名(title)');
    expect(dialogText).toContain('必須項目の設定');
    expect(dialogText).toContain('運用環境へ反映');
    // 少し待ってもステータスは承認待ちのまま
    await new Promise((r) => setTimeout(r, 3000));
    const record = await getRecord(id);
    expect(record['ステータス'].value).toBe('承認待ち');
    expect(record.asr_result.value).toBe('');
    const live = await getLiveFields(TARGET_APP_ID);
    expect(live.title.required).toBe(false);
    // ローディングが残っておらず、もう一度アクションを押せる
    const loading = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="loading"]')).some(
        (e) =>
          e.offsetParent !== null && e.getBoundingClientRect().height > 100,
      ),
    );
    expect(loading).toBe(false);
    expect(pageErrors).toEqual([]);
  }, 240000);

  test('対象アプリに未反映の変更があるとエラーになり、ステータスは変わらない', async () => {
    // 誰かが設定変更の途中(アプリを更新していない)状態を作る
    await kintoneAdmin.request(
      env,
      '/k/v1/preview/app/form/fields.json',
      'PUT',
      {
        app: TARGET_APP_ID,
        properties: { amount: { type: 'NUMBER', label: '金額(作業中)' } },
      },
    );
    const id = await createPendingRequest(requiredChange());
    await openDetail(id);
    await approve();
    await page.waitForFunction(
      () => document.body.innerText.includes('未反映の設定変更があります'),
      { timeout: 60000 },
    );
    const record = await getRecord(id);
    expect(record['ステータス'].value).toBe('承認待ち');
    const live = await getLiveFields(TARGET_APP_ID);
    expect(live.title.required).toBe(false);
    expect(live.amount.label).toBe('金額');
    expect(pageErrors).toEqual([]);
  }, 240000);

  test('テーブル内フィールドのラベル変更・選択肢の変更(初期値の補正つき)も反映できる', async () => {
    const app = { id: TARGET_APP_ID, name: '[e2e] 変更対象', guestSpaceId: '' };
    const labelId = await createPendingRequest(
      ChangeRequest.buildChange({
        app,
        field: {
          code: 'item',
          label: '品名',
          type: 'SINGLE_LINE_TEXT',
          subtableCode: 'tbl',
        },
        operation: 'label',
        before: '品名',
        after: '商品名',
      }),
    );
    await openDetail(labelId);
    await approve();
    await waitForStatus(labelId, '完了');

    const optionsId = await createPendingRequest(
      ChangeRequest.buildChange({
        app,
        field: {
          code: 'kind',
          label: '種別',
          type: 'DROP_DOWN',
          subtableCode: '',
        },
        operation: 'options',
        before: ['A', 'B'],
        after: [
          { from: 'B', label: 'B' },
          { from: '', label: 'C' },
        ],
      }),
    );
    await openDetail(optionsId);
    await approve();
    const record = await waitForStatus(optionsId, '完了');

    const live = await getLiveFields(TARGET_APP_ID);
    expect(live.tbl.fields.item.label).toBe('商品名');
    expect(
      Object.values(live.kind.options)
        .sort((a, b) => Number(a.index) - Number(b.index))
        .map((o) => o.label),
    ).toEqual(['B', 'C']);
    // 初期値「A」が選択肢から消えたため空に補正される
    expect(live.kind.defaultValue).toBe('');
    expect(record.asr_result.value).toContain('初期値');
    expect(pageErrors).toEqual([]);
  }, 300000);

  test('選択肢の名前の変更(B→新しい名前)は、既存レコードの値も新しい名前になる', async () => {
    // kintoneは「過去に削除された選択肢と同じ名前への変更」をエラーにする(実環境で確認)。
    // 前回の実行で付けた名前はresetTargetApp()で削除済みになるため、毎回新しい名前を使う。
    const newName = `B${Date.now()}`;
    // 変更対象アプリに「種別 = B」のレコードを用意する(テストごとに作成し、最後に削除する)
    const target = await kintoneAdmin.request(
      env,
      '/k/v1/record.json',
      'POST',
      {
        app: TARGET_APP_ID,
        record: { kind: { value: 'B' } },
      },
    );

    try {
      // 依頼の入力画面で、Bの名前を書き換え、Cを追加する
      await page.goto(
        `https://${env.KINTONE_DOMAIN}/k/${REQUEST_APP_ID}/edit`,
        {
          waitUntil: 'networkidle0',
        },
      );
      await page.waitForSelector('.asr-editor');
      await page.type('.asr-js-app-id', TARGET_APP_ID);
      await page.$eval('.asr-js-load-id', (el) => el.click());
      await page.waitForSelector('.asr-js-field option[value="kind"]', {
        timeout: 30000,
      });
      await page.select('.asr-js-field', 'kind');
      await page.select('.asr-js-operation', 'options');
      await page.waitForSelector('.asr-option-row[data-from="B"]');
      await page.$eval(
        '.asr-option-row[data-from="B"] .asr-js-option-label',
        (el) => {
          el.value = '';
        },
      );
      await page.type(
        '.asr-option-row[data-from="B"] .asr-js-option-label',
        newName,
      );
      await page.$eval('.asr-js-option-add', (el) => el.click());
      await page.type(
        '.asr-option-row[data-from=""] .asr-js-option-label',
        'C',
      );
      const warnings = await page.$eval('.asr-warnings', (el) => el.innerText);
      expect(warnings).toContain('既存レコードの値');

      await Promise.all([
        page.waitForFunction(() => location.href.includes('/show'), {
          timeout: 60000,
        }),
        page.$eval('.gaia-ui-actionmenu-save', (el) => el.click()),
      ]);
      const id = new URL(page.url()).hash.match(/record=(\d+)/)[1];
      await page.waitForSelector('.asr-detail');
      const detail = await page.$eval('.asr-detail', (el) => el.innerText);
      expect(detail).toContain(`B → ${newName}(名前を変更)`);
      expect(detail).toContain('C(追加)');

      await kintoneAdmin.request(env, '/k/v1/record/status.json', 'PUT', {
        app: REQUEST_APP_ID,
        id,
        action: '申請する',
      });
      await openDetail(id);
      await approve();
      await waitForStatus(id, '完了');

      const live = await getLiveFields(TARGET_APP_ID);
      expect(
        Object.values(live.kind.options)
          .sort((a, b) => Number(a.index) - Number(b.index))
          .map((o) => o.label),
      ).toEqual(['A', newName, 'C']);
      const targetRecord = await kintoneAdmin.request(
        env,
        '/k/v1/record.json',
        'GET',
        {
          app: TARGET_APP_ID,
          id: target.id,
        },
      );
      expect(targetRecord.record.kind.value).toBe(newName);
      expect(pageErrors).toEqual([]);
    } finally {
      // 変更対象アプリに作ったテスト用レコードは成否にかかわらず消す
      await kintoneAdmin.deleteRecords(env, TARGET_APP_ID, [target.id]);
    }
  }, 300000);
});
