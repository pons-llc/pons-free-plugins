'use strict';

// このプラグインのe2eテストが必要とする、対象アプリのスペースフィールド(アンカー用)を
// 冪等に用意する。共通ツール scripts/kintone-admin.js の ensureSpacerInLayout() を使う
// (既にレイアウトにあれば触らず、無ければ新しい行として追加してデプロイする)。
//
// NOTE: SPACER/LABEL/HRはensureFormFields()(フィールド追加API)では作れない
// (「フィールド」ではなくレイアウト専用の要素のため)。レイアウト変更APIを使う
// ensureSpacerInLayout()で対応する。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const ANCHOR_SPACER_ELEMENT_ID = 'tbl_e2e_anchor_spacer';

const ensureAnchorSpacer = (env, appId) =>
  kintoneAdmin.ensureSpacerInLayout(env, appId, ANCHOR_SPACER_ELEMENT_ID);

module.exports = { ANCHOR_SPACER_ELEMENT_ID, ensureAnchorSpacer };
