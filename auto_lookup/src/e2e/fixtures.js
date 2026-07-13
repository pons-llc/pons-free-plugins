'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(TEST_APP_ID_1)のフィールドを冪等に用意する。
//
// NOTE: e2e-testスキルの言うとおり、TEST_APP_ID_1・TEST_APP_ID_2にはLOOKUP(ルックアップ)フィールドが
// 未設定のため、auto_lookupプラグイン(設定画面がLOOKUPフィールドの一覧を表示する)のテストには
// LOOKUPフィールドを都度作成する必要がある。
//
// フィールド設計:
//   - atl_lookup_out(文字列1行、新設): TEST_APP_ID_2の「文字列__1行__0」をコピーする先。
//     LOOKUPフィールドのfieldMappings.fieldが参照するため、LOOKUPフィールドより先に作成する。
//   - atl_lookup(LOOKUPフィールド、新設): TEST_APP_ID_2の「文字列__1行_」をキーにルックアップする。
//     LOOKUPフィールド自身のtypeは、コピー元キーフィールド(文字列__1行_)と同じSINGLE_LINE_TEXTを
//     指定する(REST APIドキュメント「フィールドを追加する」の補足: 「ルックアップフィールドは、
//     コピー元のフィールドのフィールドタイプを指定します」)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const OUTPUT_FIELD_CODE = 'atl_lookup_out';
const LOOKUP_FIELD_CODE = 'atl_lookup';

const ensureOutputField = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, {
    [OUTPUT_FIELD_CODE]: {
      type: 'SINGLE_LINE_TEXT',
      code: OUTPUT_FIELD_CODE,
      label: 'ルックアップコピー先(テスト用)',
    },
  });

const ensureLookupField = (env, appId, relatedAppId) =>
  kintoneAdmin.ensureFormFields(env, appId, {
    [LOOKUP_FIELD_CODE]: {
      type: 'SINGLE_LINE_TEXT',
      code: LOOKUP_FIELD_CODE,
      label: 'ルックアップ(テスト用)',
      lookup: {
        relatedApp: { app: String(relatedAppId) },
        relatedKeyField: '文字列__1行_',
        fieldMappings: [
          { field: OUTPUT_FIELD_CODE, relatedField: '文字列__1行__0' },
        ],
      },
    },
  });

// 出力先フィールドを先に確定させてからLOOKUPフィールドを追加する(fieldMappings.fieldが
// 追加時点で存在している必要があるため)。
const ensureLookupSetup = async (env, appId, relatedAppId) => {
  await ensureOutputField(env, appId);
  await ensureLookupField(env, appId, relatedAppId);
};

module.exports = {
  OUTPUT_FIELD_CODE,
  LOOKUP_FIELD_CODE,
  ensureLookupSetup,
};
