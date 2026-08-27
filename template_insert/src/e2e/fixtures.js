'use strict';

// TEST_APP_ID_1には主要な項目タイプ(文字列複数行・ラジオボタン・サブテーブル等)は
// あらかじめ用意済みだが、リッチエディター(RICH_TEXT)フィールドが無いため、
// scripts/kintone-admin.js の ensureFormFields() で冪等に追加する(既存フィールドは触らない)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const RICH_TEXT_FIELD_CODE = 'tmpi_rich_text';

const TARGET_APP_FIELDS = {
  [RICH_TEXT_FIELD_CODE]: {
    type: 'RICH_TEXT',
    code: RICH_TEXT_FIELD_CODE,
    label: 'リッチエディター(template_insertテスト用)',
  },
};

const ensureTargetAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, TARGET_APP_FIELDS);

module.exports = {
  RICH_TEXT_FIELD_CODE,
  TARGET_APP_FIELDS,
  ensureTargetAppFields,
};
