'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(TEST_APP_ID_1)のフィールド・レイアウトを
// 冪等に用意する。共通ツール scripts/kintone-admin.js の ensureFormFields()/ensureSpacerInLayout()を
// 使う(既存のものは触らない、self_lookupと同じ方針)。
//
// フィールド設計:
//   - sourceFieldCode(元フィールド、文字列1行)として `uil_user_code` を新設する。
//   - 転記項目の出力先(文字列1行)として `uil_out_name`/`uil_out_email`/`uil_out_orgs`/
//     `uil_out_groups` を新設する。
//   - ボタン設置先スペースとして `uil_button_space` を新設する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TARGET_APP_FIELDS = {
  uil_user_code: {
    type: 'SINGLE_LINE_TEXT',
    code: 'uil_user_code',
    label: 'ユーザーコード(テスト用)',
  },
  uil_out_name: {
    type: 'SINGLE_LINE_TEXT',
    code: 'uil_out_name',
    label: '表示名 転記先(テスト用)',
  },
  uil_out_email: {
    type: 'SINGLE_LINE_TEXT',
    code: 'uil_out_email',
    label: 'メールアドレス 転記先(テスト用)',
  },
  uil_out_orgs: {
    type: 'SINGLE_LINE_TEXT',
    code: 'uil_out_orgs',
    label: '所属 転記先(テスト用)',
  },
  uil_out_groups: {
    type: 'SINGLE_LINE_TEXT',
    code: 'uil_out_groups',
    label: 'グループ 転記先(テスト用)',
  },
};

const BUTTON_SPACE_ELEMENT_ID = 'uil_button_space';

const ensureTargetAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, TARGET_APP_FIELDS);

const ensureButtonSpace = (env, appId) =>
  kintoneAdmin.ensureSpacerInLayout(env, appId, BUTTON_SPACE_ELEMENT_ID);

module.exports = {
  TARGET_APP_FIELDS,
  BUTTON_SPACE_ELEMENT_ID,
  ensureTargetAppFields,
  ensureButtonSpace,
};
