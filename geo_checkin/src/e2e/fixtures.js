'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(TEST_APP_ID_1)のフィールドを冪等に用意する。
// 共通ツール scripts/kintone-admin.js の ensureFormFields() を使う(既存のものは触らない、
// org_lookupと同じ方針)。TEST_APP_ID_1には汎用の「数値」フィールドは既にあるが、緯度・経度用に
// 名前で区別できる専用フィールドを新設する(設定画面のプルダウンで確実に選べるようにするため)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TARGET_APP_FIELDS = {
  geoc_lat: {
    type: 'NUMBER',
    code: 'geoc_lat',
    label: '緯度(テスト用)',
  },
  geoc_lng: {
    type: 'NUMBER',
    code: 'geoc_lng',
    label: '経度(テスト用)',
  },
};

const ensureTargetAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, TARGET_APP_FIELDS);

module.exports = {
  TARGET_APP_FIELDS,
  ensureTargetAppFields,
};
