// cross_app_check のE2Eで使う検証環境アプリと、その初期化処理。
//
// 【共有アプリを使わない理由】
// このプラグインのE2Eは「基準アプリと対象アプリに、キーが一致する/しないレコードが
// 決まった件数だけ存在する」という前提に依存する。TEST_APP_ID_1 / TEST_APP_ID_2 は
// 他プラグインのE2Eと共用のため、レコードを一括で消したり増やしたりすると
// 他のテストのfixtureを壊す。そこで delete_backup が DBACK_ARCHIVE_APP_ID で
// 専用アプリを使っているのと同じ方針で、このプラグイン専用に3つのアプリを用意する。
//
//   CAC_BASE_APP_ID    妊娠届(cross_app_check E2E)   … 基準アプリ(母集団)
//   CAC_TARGET_APP_ID  面談予約(cross_app_check E2E) … 対象アプリ(提出状況を調べる先)
//   CAC_SUMMARY_APP_ID 突合結果(cross_app_check E2E) … 集計アプリ(プラグインを入れる先)
//
// いずれも .env で上書きできるが、既定値は初回に作成したアプリIDを直接書いている
// (delete_backup/src/e2e/fixtures.js と同じ作法)。
const kintoneAdmin = require('../../../scripts/kintone-admin');

const CAC_BASE_APP_ID = process.env.CAC_BASE_APP_ID || '676';
const CAC_TARGET_APP_ID = process.env.CAC_TARGET_APP_ID || '677';
const CAC_SUMMARY_APP_ID = process.env.CAC_SUMMARY_APP_ID || '675';

const KEY_FIELD = '宛名番号';
const NAME_FIELD = '氏名';
const DATE_FIELD = '面談日';

const textField = (code, label) => ({
  type: 'SINGLE_LINE_TEXT',
  code,
  label,
  noLabel: false,
  required: false,
  unique: false,
  defaultValue: '',
  expression: '',
  hideExpression: false,
  minLength: '',
  maxLength: '',
});

const dateField = (code, label) => ({
  type: 'DATE',
  code,
  label,
  noLabel: false,
  required: false,
  unique: false,
  defaultValue: '',
  defaultNowValue: false,
});

// 基準アプリ: 宛名番号(突合キー) + 氏名(表示名)
const ensureBaseAppFields = (env) =>
  kintoneAdmin.ensureFormFields(env, CAC_BASE_APP_ID, {
    [KEY_FIELD]: textField(KEY_FIELD, '宛名番号'),
    [NAME_FIELD]: textField(NAME_FIELD, '氏名'),
  });

// 対象アプリ: 宛名番号(突合キー) + 面談日(提出日)
const ensureTargetAppFields = (env) =>
  kintoneAdmin.ensureFormFields(env, CAC_TARGET_APP_ID, {
    [KEY_FIELD]: textField(KEY_FIELD, '宛名番号'),
    [DATE_FIELD]: dateField(DATE_FIELD, '面談日'),
  });

// 突合結果が読み取りやすいよう、毎回同じデータに戻してから流す。
// 対象はこのプラグイン専用アプリのみで、共有アプリには一切触らない。
//
//   A-001 山田花子  → 面談あり(2回。最終 2026-07-20)
//   A-002 鈴木一郎  → 面談なし  ← 「妊娠届は出たが面談予約が無い」= 検出したい人
//   A-003 佐藤次郎  → 面談あり(1回)
//   A-004 高橋三郎  → 面談なし  ← 同上
//   (X-999 は面談アプリにだけ居る。母集団は基準アプリなので行にならないこと)
const BASE_RECORDS = [
  { [KEY_FIELD]: { value: 'A-001' }, [NAME_FIELD]: { value: '山田花子' } },
  { [KEY_FIELD]: { value: 'A-002' }, [NAME_FIELD]: { value: '鈴木一郎' } },
  { [KEY_FIELD]: { value: 'A-003' }, [NAME_FIELD]: { value: '佐藤次郎' } },
  { [KEY_FIELD]: { value: 'A-004' }, [NAME_FIELD]: { value: '高橋三郎' } },
];

const TARGET_RECORDS = [
  { [KEY_FIELD]: { value: 'A-001' }, [DATE_FIELD]: { value: '2026-05-01' } },
  { [KEY_FIELD]: { value: 'A-001' }, [DATE_FIELD]: { value: '2026-07-20' } },
  { [KEY_FIELD]: { value: 'A-003' }, [DATE_FIELD]: { value: '2026-06-10' } },
  { [KEY_FIELD]: { value: 'X-999' }, [DATE_FIELD]: { value: '2026-06-11' } },
];

const EXPECTED = {
  baseCount: 4,
  submitted: 2,
  unsubmitted: 2,
  unsubmittedNames: ['鈴木一郎', '高橋三郎'],
  submittedNames: ['山田花子', '佐藤次郎'],
  lastDateOfA001: '2026-07-20',
};

const resetRecords = async (env) => {
  await kintoneAdmin.deleteAllRecords(env, CAC_BASE_APP_ID);
  await kintoneAdmin.deleteAllRecords(env, CAC_TARGET_APP_ID);
  await kintoneAdmin.addRecords(env, CAC_BASE_APP_ID, BASE_RECORDS);
  await kintoneAdmin.addRecords(env, CAC_TARGET_APP_ID, TARGET_RECORDS);
};

// 集計アプリは突合結果の入れ物。プラグインが履歴を追記していくので、
// 各テストの前に空のレコードを1件だけ用意し直す。
const resetSummaryRecord = async (env) => {
  await kintoneAdmin.deleteAllRecords(env, CAC_SUMMARY_APP_ID);
  const resp = await kintoneAdmin.addRecords(env, CAC_SUMMARY_APP_ID, [{}]);
  return String(resp.ids[0]);
};

module.exports = {
  CAC_BASE_APP_ID,
  CAC_TARGET_APP_ID,
  CAC_SUMMARY_APP_ID,
  KEY_FIELD,
  NAME_FIELD,
  DATE_FIELD,
  BASE_RECORDS,
  TARGET_RECORDS,
  EXPECTED,
  ensureBaseAppFields,
  ensureTargetAppFields,
  resetRecords,
  resetSummaryRecord,
};
