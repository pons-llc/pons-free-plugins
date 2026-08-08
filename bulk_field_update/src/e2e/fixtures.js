'use strict';

// このプラグイン固有のE2Eテスト用フィクスチャ。TEST_APP_ID_1には必須(required)の
// SINGLE_LINE_TEXTフィールドが用意されていないため、確認ダイアログの必須バリデーションを
// 実環境で検証するには専用フィールドが必要(冪等・既存フィールドは触らない)。

const REQUIRED_TEST_FIELD_CODE = 'bfu_required_test_field';

const ensureRequiredTestField = async (env, appId, kintoneAdmin) => {
  await kintoneAdmin.ensureFormFields(env, appId, {
    [REQUIRED_TEST_FIELD_CODE]: {
      type: 'SINGLE_LINE_TEXT',
      code: REQUIRED_TEST_FIELD_CODE,
      label: '一括更新必須テスト',
      required: true,
    },
  });
};

module.exports = { REQUIRED_TEST_FIELD_CODE, ensureRequiredTestField };
