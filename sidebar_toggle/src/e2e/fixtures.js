'use strict';

// TEST_APP_ID_2にはDROP_DOWN/CHECK_BOX型のフィールドが用意されていないことをREST
// (kintone-admin.getFormFields)で確認したため(e2e-test Skillの前提条件、
// 「本当に不足している場合のみensureFormFields()で追加する」CLAUDE.md開発方針7)、
// 条件のフィールド種別テストに使うDROP_DOWN/CHECK_BOXフィールドを冪等に追加する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const DROP_DOWN_FALLBACK_CODE = 'sbt_dropdown_for_e2e';
const CHECK_BOX_FALLBACK_CODE = 'sbt_checkbox_for_e2e';

const FALLBACK_FIELDS = {
  [DROP_DOWN_FALLBACK_CODE]: {
    type: 'DROP_DOWN',
    code: DROP_DOWN_FALLBACK_CODE,
    label: 'サイドバー開閉プラグインE2E用ドロップダウン',
    options: {
      未着手: { label: '未着手', index: '0' },
      対応中: { label: '対応中', index: '1' },
      完了: { label: '完了', index: '2' },
    },
  },
  [CHECK_BOX_FALLBACK_CODE]: {
    type: 'CHECK_BOX',
    code: CHECK_BOX_FALLBACK_CODE,
    label: 'サイドバー開閉プラグインE2E用チェックボックス',
    options: {
      緊急: { label: '緊急', index: '0' },
      重要: { label: '重要', index: '1' },
    },
  },
};

const ensureConditionFields = async (env, appId) => {
  const fields = await kintoneAdmin.getFormFields(env, appId);
  const missing = {};
  if (!Object.values(fields).some((f) => f.type === 'DROP_DOWN')) {
    missing[DROP_DOWN_FALLBACK_CODE] = FALLBACK_FIELDS[DROP_DOWN_FALLBACK_CODE];
  }
  if (!Object.values(fields).some((f) => f.type === 'CHECK_BOX')) {
    missing[CHECK_BOX_FALLBACK_CODE] = FALLBACK_FIELDS[CHECK_BOX_FALLBACK_CODE];
  }
  if (Object.keys(missing).length > 0) {
    await kintoneAdmin.ensureFormFields(env, appId, missing);
  }
};

module.exports = { ensureConditionFields, DROP_DOWN_FALLBACK_CODE, CHECK_BOX_FALLBACK_CODE };
