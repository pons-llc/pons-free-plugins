'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(TEST_APP_ID_1)のフィールド・レイアウト・
// シードレコードを冪等に用意する。共通ツール scripts/kintone-admin.js の ensureFormFields()/
// ensureSpacerInLayout() を使う(既存のものは触らない)。
//
// NOTE: LOOKUP関連プラグインの中でもself_lookupは同一アプリ内検索のため、
// 「参照先アプリ」の概念自体がなく(自アプリ=参照先)、e2e-testスキルが言及するLOOKUPフィールドの
// 作成(relatedApp等)は不要。代わりに、TEST_APP_ID_1・TEST_APP_ID_2のどちらにも
// unique設定のあるフィールドが存在しない(要件確認済み)ため、「検索先のキーフィールド」用に
// unique設定のフィールドを1つ新設する。
//
// フィールド設計:
//   - selfKeyFieldCode(自レコードの検索キー) には既存の「文字列__1行_」を使う(新設不要)。
//   - otherKeyFieldCode(検索先のキーフィールド、unique必須)として `slk_key` を新設する。
//   - フィールドマッピングの検索先(コピー元)には既存の「文字列__1行__0」を使う。
//   - フィールドマッピングの出力先(コピー先)として `slk_copied_name` を新設する。
//   - ルックアップボタンの設置先スペースとして `self_lookup_button_space` を新設する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TARGET_APP_FIELDS = {
  slk_key: {
    type: 'SINGLE_LINE_TEXT',
    code: 'slk_key',
    label: 'セルフルックアップキー(テスト用・ユニーク)',
    unique: true,
  },
  slk_copied_name: {
    type: 'SINGLE_LINE_TEXT',
    code: 'slk_copied_name',
    label: 'コピー先名称(テスト用)',
  },
};

const BUTTON_SPACE_ELEMENT_ID = 'self_lookup_button_space';

const SEED_KEY_VALUE = 'A001';
const SEED_NAME_VALUE = 'マスターレコードA';

const ensureTargetAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, TARGET_APP_FIELDS);

const ensureButtonSpace = (env, appId) =>
  kintoneAdmin.ensureSpacerInLayout(env, appId, BUTTON_SPACE_ELEMENT_ID);

// slk_key='A001'を持つ「マスターレコード」を1件用意する(検索対象、ボタン押下時にヒットさせる用)。
// slk_keyはunique制約があるため、既に存在する場合は再作成せず何もしない(冪等)。
const ensureSeedRecord = async (env, appId) => {
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    {
      app: appId,
      query: `slk_key = "${SEED_KEY_VALUE}"`,
    },
  );
  if (existing.records && existing.records.length > 0) {
    return { created: false };
  }
  await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record: {
      slk_key: { value: SEED_KEY_VALUE },
      文字列__1行__0: { value: SEED_NAME_VALUE },
    },
  });
  return { created: true };
};

module.exports = {
  TARGET_APP_FIELDS,
  BUTTON_SPACE_ELEMENT_ID,
  SEED_KEY_VALUE,
  SEED_NAME_VALUE,
  ensureTargetAppFields,
  ensureButtonSpace,
  ensureSeedRecord,
};
