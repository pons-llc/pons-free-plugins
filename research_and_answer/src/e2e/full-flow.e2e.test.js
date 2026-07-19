'use strict';

// 依頼アプリ(TEST_APP_ID_1)・回答アプリ(TEST_APP_ID_2)の専用アプリペアを使った通しE2E。
//
//   1. 依頼アプリ: 設定画面で自動作成(related以外) → 保存 → デプロイ
//   2. 回答アプリ: 設定画面で自動作成(lookup・予備フィールド・一覧) → 保存 → デプロイ →
//      再実行で依頼アプリへrelated(関連レコード一覧)を自動追加
//      (参照整合性チェックは相手アプリの運用環境に対して行われるため、lookupのデプロイ後にのみ作れる)
//   3. 依頼アプリ: 保存済み設定の復元確認とデプロイ(related反映)
//   4. RESTで依頼レコード+回答レコードを投入し、集計リスト(仮想一覧)の描画を確認
//   5. 「現在の条件で分析する」から分析ダッシュボード(自前SVGチャート)の描画を確認
//   6. 回答レコード詳細で仮想フォーム(閲覧モード)の描画を確認
//   7. 依頼レコード詳細でプレビューと「集計・分析」ボタンを確認
//
// 事前準備: pnpm run build 済みのdist/plugin.zipをアップロードし、両アプリにプラグインを
// 追加済みであること(.envのTEST_APP_ID_1/2は本プラグイン専用の新規アプリを指すこと。
// 自動作成が予備フィールド55個や一覧を追加するため、他プラグインと共有するアプリでは実行しない)。
//
// NOTE: このテストは実行のたびに依頼レコード1件+回答レコード3件を追加する(削除しない)。
// 各実行は自分が作った依頼レコードのIDで絞り込むため、過去実行のレコードとは干渉しない。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const admin = require('../../../scripts/kintone-admin');
const FormModel = require('../js/lib/form-model');

const PLUGIN_NAME = 'research_and_answer';
const PLUGIN_SRC_DIR = path.join(__dirname, '..');

jest.setTimeout(240000);

describe('通しE2E(依頼→回答→集計リスト→分析)', () => {
  let browser;
  let page;
  let repoRoot;
  let env;
  let pluginId;
  let requestAppId;
  let answerAppId;
  let requestRecordId;
  let answerRecordIds = [];
  let pageErrors = [];

  const questionsRows = [
    {
      value: {
        order: { value: '1' },
        question: { value: '担当者名' },
        question_detail: { value: '' },
        field_type: { value: '文字列' },
        insert_column: { value: 'text_1' },
        choice: { value: '' },
        question_width: { value: '1/2' },
        mondatory: { value: '必須' },
      },
    },
    {
      value: {
        order: { value: '2' },
        question: { value: '対応状況' },
        question_detail: { value: '現在の対応状況を選択してください' },
        field_type: { value: 'ラジオボタン' },
        insert_column: { value: 'text_2' },
        choice: { value: '完了,対応中,未着手' },
        question_width: { value: '1/2' },
        mondatory: { value: '必須' },
      },
    },
    {
      value: {
        order: { value: '3' },
        question: { value: '対応件数' },
        question_detail: { value: '' },
        field_type: { value: '数値' },
        insert_column: { value: 'number_1' },
        choice: { value: '' },
        question_width: { value: '1/1' },
        mondatory: { value: '任意' },
      },
    },
    {
      value: {
        order: { value: '4' },
        question: { value: '回答日' },
        question_detail: { value: '' },
        field_type: { value: '日付' },
        insert_column: { value: 'date_1' },
        choice: { value: '' },
        question_width: { value: '1/1' },
        mondatory: { value: '任意' },
      },
    },
  ];

  const answerValues = [
    {
      text_1: '田中',
      text_2: '完了',
      number_1: '5',
      date_1: '2026-07-01',
      answer_status: '回答済',
    },
    {
      text_1: '佐藤',
      text_2: '対応中',
      number_1: '3',
      date_1: '2026-07-02',
      answer_status: '対応中',
    },
    {
      text_1: '鈴木',
      text_2: '完了',
      number_1: '2',
      date_1: '2026-07-02',
      answer_status: '回答済',
    },
  ];

  beforeAll(async () => {
    repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    requestAppId = env.TEST_APP_ID_1;
    answerAppId = env.TEST_APP_ID_2;

    await admin.ensurePluginAdded(env, requestAppId, pluginId);
    await admin.ensurePluginAdded(env, answerAppId, pluginId);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    // 設定保存時のalert()を自動で閉じる
    page.on('dialog', (dialog) => dialog.accept().catch(() => {}));
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await common.login(page, env);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(() => {
    pageErrors = [];
  });

  const fillInput = async (selector, value) => {
    await page.$eval(
      selector,
      (el, v) => {
        el.value = v;
      },
      value,
    );
  };

  const runGenerate = async () => {
    await page.click('#js-generate');
    await page.waitForFunction(
      () => {
        const t = document.getElementById('js-generate-log').textContent;
        return t.includes('※ここまでの変更') || t.includes('失敗しました');
      },
      { timeout: 120000 },
    );
    return page.$eval('#js-generate-log', (el) => el.textContent);
  };

  const saveConfig = async () => {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.kintoneplugin-button-dialog-ok'),
    ]);
  };

  test('1. 依頼アプリ: 設定+自動作成(related以外)+保存', async () => {
    // 再実行にも耐えるよう、実行前の状態を見て期待値を分岐する(自動作成は冪等)
    const answerHadLookup = !!(await admin.getFormFields(env, answerAppId))
      .lookup;

    await common.openPluginConfig(page, env, requestAppId, pluginId);
    await page.select('#js-role', 'request');
    await fillInput('#js-answer-app-id', answerAppId);

    const log = await runGenerate();
    expect(log).not.toContain('失敗');
    if (!answerHadLookup) {
      // 初回: 回答アプリ側が未生成のため、relatedはスキップされる旨の案内が出る
      expect(log).toContain('スキップしました');
    }

    await saveConfig();
    await admin.deployApp(env, requestAppId);

    const fields = await admin.getFormFields(env, requestAppId);
    [
      'title',
      'description',
      'requester',
      'recipients',
      'deadline',
      'attachment',
      'questions',
      'condition_json',
      'json',
      'related_links',
      'related_rich_text',
    ].forEach((code) => expect(fields[code]).toBeDefined());
    expect(fields.requester.type).toBe('ORGANIZATION_SELECT');
    expect(fields.recipients.type).toBe('ORGANIZATION_SELECT');
    expect(fields.deadline.type).toBe('DATETIME');
    expect(fields.attachment.type).toBe('FILE');
    expect(fields.questions.fields.insert_column).toBeDefined();
    if (!answerHadLookup) {
      expect(fields.related).toBeUndefined();
    }
    expect(pageErrors).toEqual([]);
  });

  test('2. 回答アプリ: 設定+自動作成(lookup・予備フィールド・一覧)+保存', async () => {
    const viewsBefore = await admin.request(
      env,
      '/k/v1/preview/app/views.json',
      'GET',
      {
        app: answerAppId,
      },
    );
    const hadListView = !!viewsBefore.views['集計リスト'];

    await common.openPluginConfig(page, env, answerAppId, pluginId);
    await page.select('#js-role', 'answer');
    await fillInput('#js-request-app-id', requestAppId);

    const requestHadRelated = !!(await admin.getFormFields(env, requestAppId))
      .related;

    const log = await runGenerate();
    expect(log).not.toContain('失敗');
    expect(log).toContain(
      hadListView ? '追加が必要な一覧はありませんでした' : '一覧を追加しました',
    );
    if (!requestHadRelated) {
      // 初回はlookupがまだ運用環境に無いため、related作成は「アプリ更新後の再実行」を案内する
      // (関連レコード一覧の参照整合性チェックは相手アプリの運用環境に対して行われるため)
      expect(log).toContain('もう一度このボタン');
    }

    await saveConfig();
    await admin.deployApp(env, answerAppId);

    // アプリ更新(deploy)後にもう一度自動作成を実行すると、依頼アプリへrelatedが自動追加される
    await common.openPluginConfig(page, env, answerAppId, pluginId);
    const log2 = await runGenerate();
    expect(log2).not.toContain('失敗');
    if (!requestHadRelated) {
      expect(log2).toContain('関連レコード一覧(related)を追加しました');
    }
    expect(
      (await admin.getFormFields(env, requestAppId)).related,
    ).toBeDefined();

    const fields = await admin.getFormFields(env, answerAppId);
    expect(fields.lookup).toBeDefined();
    expect(fields.lookup.lookup.relatedApp.app).toBe(String(requestAppId));
    expect(fields.lookup.lookup.fieldMappings.map((m) => m.field)).toContain(
      'deadline',
    );
    [
      'text_1',
      'text_20',
      'multi_text_10',
      'number_10',
      'date_5',
      'datetime_5',
      'time_5',
      'answer_department',
      'answer_status',
      'attachment',
      'deadline',
    ].forEach((code) => expect(fields[code]).toBeDefined());
    // 回答部署は「優先する組織」が初期値
    expect(fields.answer_department.type).toBe('ORGANIZATION_SELECT');
    expect(fields.answer_department.defaultValue).toEqual([
      { type: 'FUNCTION', code: 'PRIMARY_ORGANIZATION()' },
    ]);
    expect(fields.answer_status.type).toBe('RADIO_BUTTON');

    const viewsResp = await admin.request(env, '/k/v1/app/views.json', 'GET', {
      app: answerAppId,
    });
    expect(viewsResp.views['集計リスト'].type).toBe('CUSTOM');
    expect(viewsResp.views['集計リスト'].html).toContain('virtual-table-div');
    expect(viewsResp.views['分析'].type).toBe('LIST');
    expect(pageErrors).toEqual([]);
  });

  test('3. 依頼アプリ: 保存済み設定の復元と、再実行でのrelated作成', async () => {
    const hadRelated = !!(await admin.getFormFields(env, requestAppId)).related;

    await common.openPluginConfig(page, env, requestAppId, pluginId);
    // 保存済み設定が復元されること(config-store load の回帰確認)
    expect(await page.$eval('#js-role', (el) => el.value)).toBe('request');
    expect(await page.$eval('#js-answer-app-id', (el) => el.value)).toBe(
      String(answerAppId),
    );

    const log = await runGenerate();
    expect(log).not.toContain('失敗');
    expect(log).toContain(
      hadRelated ? '追加が必要なフィールドはありませんでした' : 'related',
    );
    expect(log).not.toContain('スキップしました');

    await saveConfig();
    await admin.deployApp(env, requestAppId);

    const fields = await admin.getFormFields(env, requestAppId);
    expect(fields.related).toBeDefined();
    expect(fields.related.type).toBe('REFERENCE_TABLE');
    expect(fields.related.referenceTable.condition.relatedField).toBe('lookup');
    expect(pageErrors).toEqual([]);
  });

  test('4. レコード投入(REST)と集計リスト(仮想一覧)の描画', async () => {
    // 依頼レコード。jsonはプラグインが保存時に生成するものと同じロジック(FormModel)で生成する
    const settingJson = FormModel.buildSettingJson(
      FormModel.sortLayoutByOrder(questionsRows),
      '',
    );
    const reqResp = await admin.request(env, '/k/v1/record.json', 'POST', {
      app: requestAppId,
      record: {
        title: { value: '窓口対応状況調査(E2E)' },
        description: { value: 'E2Eテスト用の照会です' },
        deadline: { value: '2026-07-31T08:00:00Z' },
        questions: { value: questionsRows },
        json: { value: settingJson },
      },
    });
    requestRecordId = reqResp.id;

    // 回答レコード3件。lookupフィールドに依頼レコード番号を指定すると、コピー対象
    // (title/json等)はkintoneサーバー側で自動コピーされる
    answerRecordIds = [];
    for (const values of answerValues) {
      const record = { lookup: { value: requestRecordId } };
      Object.entries(values).forEach(([code, value]) => {
        record[code] = { value };
      });
      const resp = await admin.request(env, '/k/v1/record.json', 'POST', {
        app: answerAppId,
        record,
      });
      answerRecordIds.push(resp.id);
    }

    // lookupのfieldMappingsによりjson/titleが自動コピーされていること(自動生成したlookup定義の検証)
    const copied = await admin.request(env, '/k/v1/record.json', 'GET', {
      app: answerAppId,
      id: answerRecordIds[0],
    });
    expect(copied.record.json.value).toContain('"layout"');
    expect(copied.record.title.value).toBe('窓口対応状況調査(E2E)');
    expect(copied.record.deadline.value).toBe('2026-07-31T08:00:00Z');
    expect(copied.record.answer_status.value).toBe('回答済');

    // 集計リスト(デフォルト一覧)を照会レコードで絞り込んで表示
    const query = encodeURIComponent(`lookup = ${requestRecordId}`);
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${answerAppId}/?query=${query}`,
      {
        waitUntil: 'networkidle0',
      },
    );
    await page.waitForSelector('#virtual-table-div table.modern-table', {
      timeout: 30000,
    });

    const title = await page.$eval('.ra-list-title', (el) => el.textContent);
    expect(title).toBe('窓口対応状況調査(E2E)');

    const headers = await page.$$eval('#virtual-table-div th', (els) =>
      els.map((el) => el.textContent),
    );
    [
      '担当者名',
      '対応状況',
      '対応件数',
      '回答日',
      '回答部署',
      '回答状況',
    ].forEach((label) => expect(headers).toContain(label));
    // 予備フィールド(未使用)・管理用・照会ごとに一定の値(期限等)は列に出ない
    expect(headers).not.toContain('予備 文字列3');
    expect(headers).not.toContain('フォーム定義JSON(自動コピー)');
    expect(headers).not.toContain('回答期限(自動コピー)');

    const rowCount = await page.$$eval(
      '#virtual-table-div tbody tr',
      (els) => els.length,
    );
    expect(rowCount).toBe(3);

    const bodyText = await page.$eval(
      '#virtual-table-div tbody',
      (el) => el.textContent,
    );
    expect(bodyText).toContain('田中');
    expect(bodyText).toContain('対応中');
    expect(bodyText).toContain('回答済');

    await page.waitForSelector('#ra-analysis-button');
    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'virtual-list');
    expect(pageErrors).toEqual([]);
  });

  test('5. 分析ダッシュボード(自前SVGチャート)の描画', async () => {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#ra-analysis-button'),
    ]);

    await page.waitForSelector('#ra-dashboard', { timeout: 30000 });
    // 全件取得(カーソルAPI)が完了して件数が表示されるまで待つ
    await page.waitForFunction(
      () => document.querySelector('.ra-record-count')?.textContent === '全3件',
      { timeout: 30000 },
    );

    // KPI: 対象レコード数3、数値フィールド(対応件数)の合計カードがある
    const kpiText = await page.$eval('#kpiContainer', (el) => el.textContent);
    expect(kpiText).toContain('対象レコード数');
    expect(kpiText).toContain('3');
    expect(kpiText).toContain('対応件数');

    // グラフがSVGで描画されている(Chart.js/CDNは使っていない)
    const svgCount = await page.$$eval('#chartsGrid svg', (els) => els.length);
    expect(svgCount).toBeGreaterThan(0);
    const externalScripts = await page.$$eval(
      'script[src*="cdn.jsdelivr.net"]',
      (els) => els.length,
    );
    expect(externalScripts).toBe(0);

    // フィルターパネルが描画されている
    const filterText = await page.$eval('#filterList', (el) => el.textContent);
    expect(filterText).toContain('対応状況');
    expect(filterText).toContain('回答状況');

    // データ一覧タブ
    await page.click('#mainTabs button[data-tab="table"]');
    const tableRows = await page.$$eval(
      '#mainTable tbody tr',
      (els) => els.length,
    );
    expect(tableRows).toBe(3);
    await page.click('#mainTabs button[data-tab="dashboard"]');

    await common.screenshot(page, repoRoot, PLUGIN_NAME, 'analysis-dashboard');
    expect(pageErrors).toEqual([]);
  });

  test('6. 回答レコード詳細: 仮想フォーム(閲覧モード)の描画', async () => {
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${answerAppId}/show#record=${answerRecordIds[0]}`,
      { waitUntil: 'networkidle0' },
    );
    await page.waitForSelector('.ra-virtual-form', { timeout: 30000 });

    // 定義した質問がラベル表示され、値が入っており、閲覧モードで編集不可になっている
    const labels = await page.$$eval(
      '.ra-virtual-form .kintoneplugin-label',
      (els) => els.map((el) => el.textContent),
    );
    expect(labels.join(',')).toContain('担当者名');
    expect(await page.$eval('#pons-text_1', (el) => el.value)).toBe('田中');
    expect(await page.$eval('#pons-text_1', (el) => el.disabled)).toBe(true);
    const radioChecked = await page.$eval('#pons-text_2-0', (el) => el.checked);
    expect(radioChecked).toBe(true); // 選択肢1番目「完了」
    expect(pageErrors).toEqual([]);
  });

  test('7. 依頼レコード詳細: プレビューと「集計・分析」ボタン', async () => {
    await page.goto(
      `https://${env.KINTONE_DOMAIN}/k/${requestAppId}/show#record=${requestRecordId}`,
      { waitUntil: 'networkidle0' },
    );
    await page.waitForSelector('.ra-virtual-form', { timeout: 30000 });

    const labels = await page.$$eval(
      '.ra-virtual-form .kintoneplugin-label',
      (els) => els.map((el) => el.textContent),
    );
    expect(labels.join(',')).toContain('対応状況');

    const moveButton = await page.$('#ra-move-list');
    expect(moveButton).not.toBeNull();
    expect(pageErrors).toEqual([]);
  });
});
