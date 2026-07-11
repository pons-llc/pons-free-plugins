'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(TEST_APP_ID_1)のフィールド・レイアウトを
// 冪等に用意する。共通ツール scripts/kintone-admin.js の ensureFormFields()/ensureSpacerInLayout()を
// 使う(既存のものは触らない、user_info_lookupと同じ方針)。
//
// フィールド設計:
//   - sourceFieldCode(元フィールド、文字列1行)として `orgl_org_code` を新設する。
//   - 転記項目の出力先(文字列1行)として `orgl_out_name`/`orgl_out_desc`/`orgl_out_parent_name` を
//     新設する。
//   - ボタン設置先スペースとして `orgl_button_space` を新設する。
//
// NOTE: 検証環境のcybozu.com共通管理には親子関係を持つ組織が存在しない。組織の追加・編集は
// アプリ横断的なcybozu.com共通管理への変更(1つのkintoneアプリのフィールド追加とは影響範囲が
// 異なる)にあたるため、このe2eテストでは新しい組織を作成しない。既存の(親を持たない)組織を
// 対象に「該当組織が見つかり、親組織欄は空になる」ケースのみ実機確認する
// (親組織を1階層だけ遡るロジック自体はresolve-org-info.test.jsでモックにより検証済み、idea.md参照)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TARGET_APP_FIELDS = {
  orgl_org_code: {
    type: 'SINGLE_LINE_TEXT',
    code: 'orgl_org_code',
    label: '組織コード(テスト用)',
  },
  orgl_out_name: {
    type: 'SINGLE_LINE_TEXT',
    code: 'orgl_out_name',
    label: '組織名 転記先(テスト用)',
  },
  orgl_out_desc: {
    type: 'SINGLE_LINE_TEXT',
    code: 'orgl_out_desc',
    label: '組織の説明 転記先(テスト用)',
  },
  orgl_out_parent_name: {
    type: 'SINGLE_LINE_TEXT',
    code: 'orgl_out_parent_name',
    label: '親組織名 転記先(テスト用)',
  },
};

const BUTTON_SPACE_ELEMENT_ID = 'orgl_button_space';

const ensureTargetAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, TARGET_APP_FIELDS);

const ensureButtonSpace = (env, appId) =>
  kintoneAdmin.ensureSpacerInLayout(env, appId, BUTTON_SPACE_ELEMENT_ID);

// 検証環境に実在する組織を1件取得する(新規作成はしない、上記NOTE参照)。
const fetchAnyOrganization = async (env) => {
  const resp = await kintoneAdmin.request(
    env,
    '/v1/organizations.json',
    'GET',
    {},
  );
  if (!resp.organizations || resp.organizations.length === 0) {
    throw new Error(
      '検証環境に組織が1件も存在しません。cybozu.com共通管理で組織を1件作成してから再実行してください。',
    );
  }
  return resp.organizations[0];
};

module.exports = {
  TARGET_APP_FIELDS,
  BUTTON_SPACE_ELEMENT_ID,
  ensureTargetAppFields,
  ensureButtonSpace,
  fetchAnyOrganization,
};
