'use strict';

// TEST_APP_ID_1にはkintoneの主要な項目タイプに対応したフィールドがあらかじめ用意されている
// (CLAUDE.md「E2Eテストの前提条件」)。本プラグインはDATETIME/TIME型のフィールドを変換元として
// 使うため、実際に存在するフィールドコードを推測せずREST(kintone-admin.getFormFields)で確認して
// 取得する(org_lookupのfetchAnyOrganizationと同じ「実データに基づく実装」の方針)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

// 変換元として使えるDATETIME型フィールドを1件返す(無ければTIME型で代用、両方無ければ例外)。
const findSourceField = async (env, appId) => {
  const fields = await kintoneAdmin.getFormFields(env, appId);
  const datetimeField = Object.values(fields).find(
    (f) => f.type === 'DATETIME',
  );
  if (datetimeField) {
    return datetimeField;
  }
  const timeField = Object.values(fields).find((f) => f.type === 'TIME');
  if (timeField) {
    return timeField;
  }
  throw new Error(
    `検証環境アプリ(${appId})にDATETIME/TIME型のフィールドが1件もありません。先にフィールドを追加してください。`,
  );
};

// ドロップダウンの絞り込みが実際に効いているかの回帰確認用に、対象外(文字列1行)フィールドも1件返す。
const findExcludedField = async (env, appId) => {
  const fields = await kintoneAdmin.getFormFields(env, appId);
  const textField = Object.values(fields).find(
    (f) => f.type === 'SINGLE_LINE_TEXT',
  );
  if (!textField) {
    throw new Error(
      `検証環境アプリ(${appId})にSINGLE_LINE_TEXT型のフィールドが1件もありません。`,
    );
  }
  return textField;
};

module.exports = { findSourceField, findExcludedField };
