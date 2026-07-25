'use strict';

// notebooklm_exportのE2Eテストが必要とする、TEST_APP_ID_1のフィールドを冪等に用意する。
//
// TEST_APP_ID_1・TEST_APP_ID_2にはLOOKUP(ルックアップ)フィールドが未設定(e2e-testスキル参照)の
// ため、本プラグインの核心機能である「ルックアップ/関連レコード一覧からの関連アプリ探索」を
// 実環境で検証するには、TEST_APP_ID_1にTEST_APP_ID_2を参照するLOOKUPフィールドを都度作成する
// 必要がある(auto_lookupの`fixtures.js`と同じ設計)。
//
// フィールド設計:
//   - ne_lookup_out(文字列1行、新設): TEST_APP_ID_2の「文字列__1行__0」をコピーする先。
//     LOOKUPフィールドのfieldMappings.fieldが参照するため、LOOKUPフィールドより先に作成する。
//   - ne_lookup(LOOKUPフィールド、新設): TEST_APP_ID_2の「文字列__1行_」をキーにルックアップする。
//     フィールド自身のtypeは、コピー元キーフィールドと同じSINGLE_LINE_TEXTを指定する
//     (REST APIドキュメント「フィールドを追加する」の補足に明記)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const OUTPUT_FIELD_CODE = 'ne_lookup_out';
const LOOKUP_FIELD_CODE = 'ne_lookup';

const ensureOutputField = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, {
    [OUTPUT_FIELD_CODE]: {
      type: 'SINGLE_LINE_TEXT',
      code: OUTPUT_FIELD_CODE,
      label: 'ルックアップコピー先(notebooklm_exportテスト用)',
    },
  });

const ensureLookupField = (env, appId, relatedAppId) =>
  kintoneAdmin.ensureFormFields(env, appId, {
    [LOOKUP_FIELD_CODE]: {
      type: 'SINGLE_LINE_TEXT',
      code: LOOKUP_FIELD_CODE,
      label: 'ルックアップ(notebooklm_exportテスト用)',
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
