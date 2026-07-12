'use strict';

// TEST_APP_ID_1/2にはkintoneの主要な項目タイプに対応したフィールドがあらかじめ用意されている
// (CLAUDE.md「E2Eテストの前提条件」)。本プラグインはDROP_DOWN/RADIO_BUTTON型のフィールドを
// 対象フィールドとして使うため、実際に存在するフィールドコードを推測せずREST
// (kintone-admin.getFormFields)で確認して取得する(time_band_aggregatorと同じ
// 「実データに基づく実装」の方針)。万一どちらの型も無い場合のみ、冪等にDROP_DOWNフィールドを追加する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const FALLBACK_FIELD_CODE = 'stc_status_for_e2e';
const FALLBACK_FIELD = {
  [FALLBACK_FIELD_CODE]: {
    type: 'DROP_DOWN',
    code: FALLBACK_FIELD_CODE,
    label: 'お祝いプラグインE2E用ステータス',
    options: {
      未着手: { label: '未着手', index: '0' },
      対応中: { label: '対応中', index: '1' },
      完了: { label: '完了', index: '2' },
    },
  },
};

// 対象フィールドとして使えるDROP_DOWN/RADIO_BUTTON型フィールドを1件返す。
// 無ければFALLBACK_FIELDを冪等に追加する(ensureFormFields、既存フィールドは触らない)。
const findOrCreateSourceField = async (env, appId) => {
  const fields = await kintoneAdmin.getFormFields(env, appId);
  const existing = Object.values(fields).find(
    (f) => f.type === 'DROP_DOWN' || f.type === 'RADIO_BUTTON',
  );
  if (existing) {
    return existing;
  }
  await kintoneAdmin.ensureFormFields(env, appId, FALLBACK_FIELD);
  const updatedFields = await kintoneAdmin.getFormFields(env, appId);
  return updatedFields[FALLBACK_FIELD_CODE];
};

module.exports = { findOrCreateSourceField };
