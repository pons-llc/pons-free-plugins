'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(番号を書き込む先)のフィールドを
// 冪等に用意する。共通ツール scripts/kintone-admin.js の ensureFormFields() を使う
// (既にあるフィールドはそのまま、無ければ追加してデプロイする)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TARGET_APP_FIELDS = {
  // NOTE: kintoneのフィールド追加APIは選択肢の label が選択肢名(オブジェクトのキー)と
  // 完全一致している必要がある(実際のAPIエラーで確認済み: CB_VA01
  // 「JSONオブジェクトのキーに指定した選択肢名と一致しません」)。そのため選択肢はコードのような
  // 値(soumu/keiri)にしておき、日本語の表示名はプラグイン側の「選択肢ごとの表示文字列の上書き」
  // 機能でテストする(むしろその機能を検証できるので都合がよい)。
  buka: {
    type: 'DROP_DOWN',
    code: 'buka',
    label: '部課(セグメント用テストフィールド)',
    options: {
      soumu: { label: 'soumu', index: '0' },
      keiri: { label: 'keiri', index: '1' },
    },
  },
  seiban: {
    type: 'SINGLE_LINE_TEXT',
    code: 'seiban',
    label: '採番結果(テスト用)',
  },
};

const ensureTargetAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, TARGET_APP_FIELDS);

module.exports = { TARGET_APP_FIELDS, ensureTargetAppFields };
