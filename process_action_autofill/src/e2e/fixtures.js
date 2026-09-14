'use strict';

// TEST_APP_ID_1/2はプロセス管理が無効(かつ他プラグインと共有しているため、プロセス管理の
// 有効化のような「フォーム上部にステータスバーが追加される」アプリ全体に影響する変更を加えると、
// 他プラグインのE2Eテスト〈特にスクリーンショット〉に予期せぬ影響を与えるリスクがある)。
// delete_backup(DBACK_ARCHIVE_APP_ID)・fiscal_year_numbering(カウンター専用アプリ)と同じ
// 「専用の小さなテストアプリを新規作成する」方針に倣い、`provisioning/seed-test-app.js`で
// プロセス管理を有効にした専用アプリ(PAF_TEST_APP_ID)を作成済み。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const PAF_TEST_APP_ID = process.env.PAF_TEST_APP_ID || '776';

const FIELD_CODES = {
  textSource: 'paf_text_source',
  textTarget: 'paf_text_target',
  numberTarget: 'paf_number_target',
  radioTarget: 'paf_radio_target',
  checkboxTarget: 'paf_checkbox_target',
  dateTarget: 'paf_date_target',
  datetimeTarget: 'paf_datetime_target',
  userTarget: 'paf_user_target',
  orgTarget: 'paf_org_target',
  groupTarget: 'paf_group_target',
};

const PROCESS_ACTIONS = {
  start: { name: '処理を開始する', from: '未処理', to: '処理中' },
  complete: { name: '完了する', from: '処理中', to: '完了' },
};

// provisioning/seed-test-app.jsで作成済みのフィールドが何らかの理由で欠けていた場合の
// 安全網(冪等・既存フィールドは触らない、CLAUDE.md開発方針7と同じ考え方)。
const ensureFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, {
    [FIELD_CODES.textSource]: {
      type: 'SINGLE_LINE_TEXT',
      code: FIELD_CODES.textSource,
      label: '文字列(コピー元テスト用)',
    },
    [FIELD_CODES.textTarget]: {
      type: 'SINGLE_LINE_TEXT',
      code: FIELD_CODES.textTarget,
      label: '文字列(対象フィールドテスト用)',
    },
    [FIELD_CODES.numberTarget]: {
      type: 'NUMBER',
      code: FIELD_CODES.numberTarget,
      label: '数値(対象フィールドテスト用)',
    },
    [FIELD_CODES.radioTarget]: {
      type: 'RADIO_BUTTON',
      code: FIELD_CODES.radioTarget,
      label: 'ラジオボタン(対象フィールドテスト用)',
      options: {
        選択肢A: { label: '選択肢A', index: '0' },
        選択肢B: { label: '選択肢B', index: '1' },
      },
    },
    [FIELD_CODES.checkboxTarget]: {
      type: 'CHECK_BOX',
      code: FIELD_CODES.checkboxTarget,
      label: 'チェックボックス(対象フィールドテスト用)',
      options: {
        選択肢A: { label: '選択肢A', index: '0' },
        選択肢B: { label: '選択肢B', index: '1' },
      },
    },
    [FIELD_CODES.dateTarget]: {
      type: 'DATE',
      code: FIELD_CODES.dateTarget,
      label: '日付(対象フィールドテスト用)',
    },
    [FIELD_CODES.datetimeTarget]: {
      type: 'DATETIME',
      code: FIELD_CODES.datetimeTarget,
      label: '日時(対象フィールドテスト用)',
    },
    [FIELD_CODES.userTarget]: {
      type: 'USER_SELECT',
      code: FIELD_CODES.userTarget,
      label: 'ユーザー選択(対象フィールドテスト用)',
    },
    [FIELD_CODES.orgTarget]: {
      type: 'ORGANIZATION_SELECT',
      code: FIELD_CODES.orgTarget,
      label: '組織選択(対象フィールドテスト用)',
    },
    [FIELD_CODES.groupTarget]: {
      type: 'GROUP_SELECT',
      code: FIELD_CODES.groupTarget,
      label: 'グループ選択(対象フィールドテスト用)',
    },
  });

// フィルター条件のチェックボックス一覧(.js-filter-action-options等)から、指定したラベルの
// チェックボックスをクリックする。config-screen.e2e.test.js/process-proceed-flow.e2e.test.jsの
// 両方で使う共通ヘルパー。
const clickFilterCheckbox = async (rowHandle, containerSelector, label) => {
  const checkboxHandle = await rowHandle.evaluateHandle(
    (row, selector, text) => {
      const checkboxes = Array.from(
        row.querySelectorAll(`${selector} input[type=checkbox]`),
      );
      return checkboxes.find((el) => el.value === text);
    },
    containerSelector,
    label,
  );
  const checkboxEl = checkboxHandle.asElement();
  if (!checkboxEl) {
    throw new Error(
      `チェックボックス「${label}」(${containerSelector})が見つかりません。`,
    );
  }
  await checkboxEl.click();
};

const isFilterCheckboxChecked = (rowHandle, containerSelector, label) =>
  rowHandle.evaluate(
    (row, selector, text) => {
      const el = Array.from(
        row.querySelectorAll(`${selector} input[type=checkbox]`),
      ).find((c) => c.value === text);
      return el ? el.checked : null;
    },
    containerSelector,
    label,
  );

module.exports = {
  PAF_TEST_APP_ID,
  FIELD_CODES,
  PROCESS_ACTIONS,
  ensureFields,
  clickFilterCheckbox,
  isFilterCheckboxChecked,
};
