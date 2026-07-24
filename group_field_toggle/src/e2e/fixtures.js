'use strict';

// TEST_APP_ID_2にはGROUP型フィールドが用意されていないことをREST(kintone-admin.getFormFields)で
// 確認したため(e2e-test Skillの前提条件、「本当に不足している場合のみensureFormFields()で
// 追加する」CLAUDE.md開発方針7)、対象グループフィールド用に冪等に追加する。DROP_DOWN型は
// sidebar_toggleのE2E実行時にTEST_APP_ID_2へ追加済みの場合があるため、既存のものがあれば
// それを再利用し(status_celebrationのfindOrCreateSourceFieldと同じ方針)、無い場合のみ追加する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const GROUP_FALLBACK_CODE = 'gft_group_for_e2e';
const DROP_DOWN_FALLBACK_CODE = 'gft_dropdown_for_e2e';

const FALLBACK_FIELDS = {
  [GROUP_FALLBACK_CODE]: {
    type: 'GROUP',
    code: GROUP_FALLBACK_CODE,
    label: 'グループ開閉プラグインE2E用グループ',
    openGroup: true,
  },
  [DROP_DOWN_FALLBACK_CODE]: {
    type: 'DROP_DOWN',
    code: DROP_DOWN_FALLBACK_CODE,
    label: 'グループ開閉プラグインE2E用ドロップダウン',
    options: {
      未着手: { label: '未着手', index: '0' },
      対応中: { label: '対応中', index: '1' },
      完了: { label: '完了', index: '2' },
    },
  },
};

// 対象グループフィールド・条件用DROP_DOWNフィールドをそれぞれ用意し、実際に使うフィールドコードを
// 返す(既存のDROP_DOWNフィールドがあれば新規追加せずそれを再利用する)。
const ensureFields = async (env, appId) => {
  const fields = await kintoneAdmin.getFormFields(env, appId);
  const missing = {};
  if (!Object.values(fields).some((f) => f.type === 'GROUP')) {
    missing[GROUP_FALLBACK_CODE] = FALLBACK_FIELDS[GROUP_FALLBACK_CODE];
  }
  const existingDropDown = Object.values(fields).find((f) => f.type === 'DROP_DOWN');
  if (!existingDropDown) {
    missing[DROP_DOWN_FALLBACK_CODE] = FALLBACK_FIELDS[DROP_DOWN_FALLBACK_CODE];
  }
  if (Object.keys(missing).length > 0) {
    await kintoneAdmin.ensureFormFields(env, appId, missing);
  }
  return {
    groupFieldCode: GROUP_FALLBACK_CODE,
    dropDownFieldCode: existingDropDown ? existingDropDown.code : DROP_DOWN_FALLBACK_CODE,
  };
};

module.exports = { ensureFields, GROUP_FALLBACK_CODE, DROP_DOWN_FALLBACK_CODE };
