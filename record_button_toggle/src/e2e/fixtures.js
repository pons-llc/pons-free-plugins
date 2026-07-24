'use strict';

// DROP_DOWN型フィールドはsidebar_toggle/group_field_toggleのE2E実行時にTEST_APP_ID_2へ
// 追加済みの場合があるため、既存のものがあればそれを再利用し(status_celebrationの
// findOrCreateSourceFieldと同じ方針)、無い場合のみ冪等に追加する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const DROP_DOWN_FALLBACK_CODE = 'rbt_dropdown_for_e2e';

const FALLBACK_FIELDS = {
  [DROP_DOWN_FALLBACK_CODE]: {
    type: 'DROP_DOWN',
    code: DROP_DOWN_FALLBACK_CODE,
    label: 'ボタン非表示プラグインE2E用ドロップダウン',
    options: {
      未着手: { label: '未着手', index: '0' },
      対応中: { label: '対応中', index: '1' },
      完了: { label: '完了', index: '2' },
    },
  },
};

// 条件用DROP_DOWNフィールドを用意し、実際に使うフィールドコードを返す(既存のDROP_DOWN
// フィールドがあれば新規追加せずそれを再利用する)。
const ensureFields = async (env, appId) => {
  const fields = await kintoneAdmin.getFormFields(env, appId);
  const existingDropDown = Object.values(fields).find(
    (f) => f.type === 'DROP_DOWN',
  );
  if (!existingDropDown) {
    await kintoneAdmin.ensureFormFields(env, appId, {
      [DROP_DOWN_FALLBACK_CODE]: FALLBACK_FIELDS[DROP_DOWN_FALLBACK_CODE],
    });
  }
  return {
    dropDownFieldCode: existingDropDown
      ? existingDropDown.code
      : DROP_DOWN_FALLBACK_CODE,
  };
};

module.exports = { ensureFields, DROP_DOWN_FALLBACK_CODE };
