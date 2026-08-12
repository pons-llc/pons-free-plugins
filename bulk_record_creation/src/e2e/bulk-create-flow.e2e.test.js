'use strict';

// 一覧画面ボタン → Dialog1(テンプレート値・対象者・繰り返し日程の入力)→ Dialog2(最終確認)→
// 実行 → 実際のレコード作成までの実環境テスト。config-screen.e2e.test.jsが設定画面の疎通確認
// なのに対し、こちらは「対象者(ユーザー)×繰り返し日程(毎日3件)の直積でレコードが作成される」
// という本プラグインの中核機能を検証する。
//
// 事前準備: config-screen.e2e.test.jsと同様。
// 実行: pnpm run test:e2e
//
// NOTE: kintone.createDialog()が生成するOK/キャンセルボタンはkintone内部のUIコンポーネントの
// ため、`button[name="ok"]`(name属性)で特定する(bulk_field_updateのe2eテストと同じ)。
//
// NOTE: プラグイン設定の保存はプレビューにしか反映されず、一覧画面には
// デプロイしないと反映されない(project_plugin_config_needs_deploy.mdの注意点)。
//
// このテストが作成したレコードは、テストごとに一意なマーカー文字列で識別し、
// afterAllで確実に削除する(feedback_shared_test_app_destructive_ops.md「自分が作った
// と特定できるレコードのみ削除する」に従う)。

const path = require('path');
const puppeteer = require('puppeteer');
const common = require('../../../scripts/e2e/common');
const kintoneAdmin = require('../../../scripts/kintone-admin');

const PLUGIN_SRC_DIR = path.join(__dirname, '..');
const TITLE_FIELD_CODE = '文字列__1行_';
const ASSIGNEE_FIELD_CODE = 'ユーザー選択';
const DATE_FIELD_CODE = '日付';
// bulk_field_updateのE2Eフィクスチャが追加した必須フィールド。他アプリ由来だが
// TEST_APP_ID_1上には実在するため、レコード作成には値を埋める必要がある
// (idea.md「フォーム内の他の必須フィールド」参照)。
const OTHER_REQUIRED_FIELD_CODE = 'bfu_required_test_field';
const OTHER_REQUIRED_VALUE = 'brc_e2e_required';
// MULTI_CHOICE(チェックボックス)型のテンプレート入力欄も実際に値が反映されることを確認する。
const CHECKBOX_FIELD_CODE = 'チェックボックス';
const CHECKBOX_OPTION_KEY = 'sample2';
const MARKER = `brc_e2e_${Date.now()}`;
const START_DATE = '2031-02-01';
const EXPECTED_DATES = ['2031-02-01', '2031-02-02', '2031-02-03'];

// 対象者ピッカーが「組織で絞り込んでユーザーを選択」の2段階UIになった(ユーザーからの
// フィードバックで全ユーザー一覧表示から変更)ため、E2Eテストでも実在する組織コードを
// UI操作で選ぶ必要がある。ただし検証環境のどの組織に所属ユーザーがいるかは不明なため、
// User APIで直接メンバーが1人以上いる組織を1つ探しておく(見つからなければテストは
// 明確なエラーで失敗させ、原因不明のタイムアウトにしない)。
const findOrganizationCodeWithMembers = async (env) => {
  const { organizations } = await kintoneAdmin.request(
    env,
    '/v1/organizations.json',
    'GET',
    { size: 100 },
  );
  for (const org of organizations) {
    const { userTitles } = await kintoneAdmin.request(
      env,
      '/v1/organization/users.json',
      'GET',
      { code: org.code },
    );
    if (userTitles.length > 0) {
      return org.code;
    }
  }
  throw new Error(
    '所属ユーザーが1人以上いる組織が検証環境に見つかりませんでした。',
  );
};

describe('一覧画面ボタンでのレコード一括作成(実環境)', () => {
  let browser;
  let page;
  let env;
  let createdIds = [];
  let orgCodeWithMembers;

  beforeAll(async () => {
    const repoRoot = common.findRepoRoot(PLUGIN_SRC_DIR);
    env = common.loadEnv(repoRoot);
    const pluginId = common.getPluginId(PLUGIN_SRC_DIR);
    await kintoneAdmin.ensurePluginAdded(env, env.TEST_APP_ID_1, pluginId);
    orgCodeWithMembers = await findOrganizationCodeWithMembers(env);

    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1200 });
    page.on('dialog', (dialog) => dialog.accept());
    await common.login(page, env);

    // 対象者フィールド=ユーザー選択、繰り返し用日付フィールド=日付、
    // テンプレート対象=文字列__1行_、に設定する(このテスト専用の自己完結セットアップ)。
    await common.openPluginConfig(page, env, env.TEST_APP_ID_1, pluginId);
    await page.select('#js-assignee-field-code', ASSIGNEE_FIELD_CODE);
    await page.select('#js-date-field-code', DATE_FIELD_CODE);
    await page.evaluate(
      (titleFieldCode, otherRequiredFieldCode, checkboxFieldCode) => {
        const targetCodes = [
          titleFieldCode,
          otherRequiredFieldCode,
          checkboxFieldCode,
        ];
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
      CHECKBOX_FIELD_CODE,
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

  test('対象者1人×毎日3件の直積で3レコード作成され、値が正しく反映される', async () => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`https://${env.KINTONE_DOMAIN}/k/${env.TEST_APP_ID_1}/`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.brc-bulk-button', { timeout: 15000 });
    await page.click('.brc-bulk-button');
    await page.waitForSelector('.brc-dialog-body', { timeout: 15000 });

    // テンプレート値(タイトル・他アプリ由来の必須フィールド・MULTI_CHOICEのチェックボックス)を
    // 入力する。チェックボックス型は`buildMultiChoiceControl`(`.brc-checkbox-group`)で
    // 選択肢ごとのチェックボックスが並ぶ構造になっている。
    await page.evaluate(
      (
        titleLabel,
        titleValue,
        requiredLabel,
        requiredValue,
        checkboxLabel,
        optionKey,
      ) => {
        const rows = Array.from(document.querySelectorAll('.brc-template-row'));
        const findRow = (label) =>
          rows.find((r) =>
            r.querySelector('.brc-field-label').textContent.includes(label),
          );
        findRow(titleLabel).querySelector('input[type="text"]').value =
          titleValue;
        findRow(requiredLabel).querySelector('input[type="text"]').value =
          requiredValue;
        const checkboxRow = findRow(checkboxLabel);
        const optionCheckboxEl = checkboxRow.querySelector(
          `input[type="checkbox"][value="${optionKey}"]`,
        );
        optionCheckboxEl.checked = true;
      },
      '文字列 (1行)',
      MARKER,
      '一括更新必須テスト',
      OTHER_REQUIRED_VALUE,
      'チェックボックス',
      CHECKBOX_OPTION_KEY,
    );

    // 対象者: 「組織で絞り込んでユーザーを選択」モード(既定)のまま、まず組織ツリーの
    // 読み込みを待って、beforeAllで確認済みの(所属ユーザーが1人以上いる)組織を選択し、
    // 所属メンバー一覧が読み込まれたら先頭の1人を選択する(idea.md「対象者フィールドと
    // 展開方式」・ユーザーからのフィードバックで全ユーザー一覧表示から2段階UIに変更)。
    // ツリーの該当ノードは折りたたまれていてもDOM上には存在するため、hiddenでも
    // querySelector/プロパティ操作は問題なく行える。
    await page.waitForFunction(
      (orgCode) =>
        !!document.querySelector(
          `.brc-scoped-user-picker .brc-org-tree input[type="checkbox"][value="${orgCode}"]`,
        ),
      { timeout: 15000 },
      orgCodeWithMembers,
    );
    await page.evaluate((orgCode) => {
      const checkboxEl = document.querySelector(
        `.brc-scoped-user-picker .brc-org-tree input[type="checkbox"][value="${orgCode}"]`,
      );
      checkboxEl.checked = true;
      checkboxEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, orgCodeWithMembers);

    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '.brc-scoped-user-picker .brc-picker-list .brc-picker-row',
        ).length > 0,
      { timeout: 15000 },
    );
    const selectedUserCode = await page.evaluate(() => {
      const row = document.querySelector(
        '.brc-scoped-user-picker .brc-picker-list .brc-picker-row',
      );
      const checkboxEl = row.querySelector('input[type="checkbox"]');
      checkboxEl.checked = true;
      checkboxEl.dispatchEvent(new Event('change', { bubbles: true }));
      return checkboxEl.value;
    });
    expect(selectedUserCode).toBeTruthy();

    // 繰り返し日程: 開始日・回数3を先に設定してから、頻度を「毎日」に変更するイベントを
    // 発火させる(件数表示の再計算はinput/changeイベントの伝播で行われるため、
    // 依存する値をすべて設定し終えてから最後にイベントを発火させる必要がある)。
    await page.evaluate((startDate) => {
      document.querySelector(
        '.brc-recurrence-section input[type="date"]',
      ).value = startDate;
      document.querySelector('.brc-end-condition input[type="number"]').value =
        '3';
      const frequencyEl = document.querySelector(
        '.brc-recurrence-section select',
      );
      frequencyEl.value = 'DAILY';
      frequencyEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, START_DATE);

    // 作成予定件数の表示が3件になるのを待つ(直積の見積り表示、idea.md参照)。
    await page.waitForFunction(
      () =>
        document
          .querySelector('.brc-count-display')
          .textContent.includes('3件'),
      { timeout: 5000 },
    );

    const clickOk = () =>
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[name="ok"]');
        buttons[buttons.length - 1].click();
      });

    await clickOk();

    // 最終確認ダイアログに、対象者コード×3日付ぶんのプレビュー行が表示される。
    await page.waitForSelector('.brc-preview-list', { timeout: 15000 });
    const previewText = await page.$eval(
      '.brc-preview-list',
      (el) => el.textContent,
    );
    EXPECTED_DATES.forEach((date) => {
      expect(previewText).toContain(date);
    });

    await clickOk();

    // 実行完了(alertはbeforeAllで登録したdialogハンドラーが自動acceptする)後、
    // マーカー付きレコードが3件検索結果へ反映されるまで待つ。kintoneのレコード検索は、
    // 更新直後は条件(特にorder by)によって索引への反映に短いタイムラグが生じることがある
    // ため、単発のGETではなく期待件数に達するまでポーリングする。
    const fetchRecords = () =>
      page.evaluate(
        (
          appId,
          titleFieldCode,
          assigneeFieldCode,
          dateFieldCode,
          checkboxFieldCode,
          marker,
        ) =>
          kintone
            .api(kintone.api.url('/k/v1/records.json', true), 'GET', {
              app: appId,
              query: `${titleFieldCode} = "${marker}" order by ${dateFieldCode} asc`,
              fields: [
                '$id',
                titleFieldCode,
                assigneeFieldCode,
                dateFieldCode,
                checkboxFieldCode,
              ],
            })
            .then((res) => res.records)
            .catch(() => []),
        Number(env.TEST_APP_ID_1),
        TITLE_FIELD_CODE,
        ASSIGNEE_FIELD_CODE,
        DATE_FIELD_CODE,
        CHECKBOX_FIELD_CODE,
        MARKER,
      );

    let records = [];
    for (let attempt = 0; attempt < 30 && records.length < 3; attempt += 1) {
      records = await fetchRecords();
      if (records.length < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    createdIds = records.map((r) => r.$id.value);

    expect(records).toHaveLength(3);
    expect(records.map((r) => r[DATE_FIELD_CODE].value)).toEqual(
      EXPECTED_DATES,
    );
    records.forEach((record) => {
      expect(record[TITLE_FIELD_CODE].value).toBe(MARKER);
      expect(record[ASSIGNEE_FIELD_CODE].value).toEqual([
        { code: selectedUserCode, name: expect.any(String) },
      ]);
      expect(record[CHECKBOX_FIELD_CODE].value).toEqual([CHECKBOX_OPTION_KEY]);
    });

    expect(pageErrors).toEqual([]);
  });
});
