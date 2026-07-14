'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(TEST_APP_ID_1)のフィールド・レイアウトを
// 冪等に用意する。共通ツール scripts/kintone-admin.js の ensureFormFields()/
// ensureSpacerInLayout() を使う(既存のものは触らない)。
//
// フィールド設計:
//   - bcs_corporate_number(文字列1行): 法人番号フィールド(ボタン1の入出力・ボタン2の反映先)
//   - bcs_company_name(文字列1行): 法人名フィールド(ボタン2の検索キー)
//   - bcs_name_output(文字列1行): 転記項目「法人名」の出力先
//   - bcs_rep_output(文字列1行): 転記項目「代表者名」の出力先
//   - ボタン設置スペースとして bcs_number_button_space / bcs_name_button_space を新設する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TARGET_APP_FIELDS = {
  bcs_corporate_number: {
    type: 'SINGLE_LINE_TEXT',
    code: 'bcs_corporate_number',
    label: '法人番号(テスト用)',
  },
  bcs_company_name: {
    type: 'SINGLE_LINE_TEXT',
    code: 'bcs_company_name',
    label: '法人名(テスト用)',
  },
  bcs_name_output: {
    type: 'SINGLE_LINE_TEXT',
    code: 'bcs_name_output',
    label: '法人名転記先(テスト用)',
  },
  bcs_rep_output: {
    type: 'SINGLE_LINE_TEXT',
    code: 'bcs_rep_output',
    label: '代表者名転記先(テスト用)',
  },
};

const NUMBER_BUTTON_SPACE_ELEMENT_ID = 'bcs_number_button_space';
const NAME_BUTTON_SPACE_ELEMENT_ID = 'bcs_name_button_space';

// 実在する法人(サイボウズ株式会社)の法人番号。gBizINFOへ実際にリクエストして
// レスポンス形式を確認した際に使ったものと同じ(idea.md参照)。
const KNOWN_CORPORATE_NUMBER = '5010001072207';
const KNOWN_CORPORATE_NAME = 'サイボウズ株式会社';
const SEARCH_NAME_QUERY = 'サイボウズ';

const ensureTargetAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, TARGET_APP_FIELDS);

const ensureButtonSpaces = async (env, appId) => {
  await kintoneAdmin.ensureSpacerInLayout(
    env,
    appId,
    NUMBER_BUTTON_SPACE_ELEMENT_ID,
  );
  await kintoneAdmin.ensureSpacerInLayout(
    env,
    appId,
    NAME_BUTTON_SPACE_ELEMENT_ID,
  );
};

module.exports = {
  TARGET_APP_FIELDS,
  NUMBER_BUTTON_SPACE_ELEMENT_ID,
  NAME_BUTTON_SPACE_ELEMENT_ID,
  KNOWN_CORPORATE_NUMBER,
  KNOWN_CORPORATE_NAME,
  SEARCH_NAME_QUERY,
  ensureTargetAppFields,
  ensureButtonSpaces,
};
