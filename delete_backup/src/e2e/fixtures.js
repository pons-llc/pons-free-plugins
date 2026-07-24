'use strict';

// このプラグインのE2Eテストが必要とする、対象アプリのフィールドを冪等に用意する。共通ツール
// scripts/kintone-admin.js の ensureFormFields()を使う(既存のものは触らない、org_lookupと
// 同じ方針)。
//
// フィールド設計:
//   - 削除元アプリ(TEST_APP_ID_1)には添付ファイルフィールドが元々無いため、テスト用に
//     dback_test_file(FILE)を新設する。
//   - アーカイブ先には、TEST_APP_ID_2ではなく専用の新規アプリ(DBACK_ARCHIVE_APP_ID)を使う。
//     TEST_APP_ID_2には元々「文字列__1行_」という必須(かつ重複禁止)の文字列フィールドが
//     存在し、このプラグインのアーカイブ登録(JSON保存先・添付ファイル保存先の2フィールドのみを
//     指定するレコード登録)がその必須フィールド未入力でREST APIから400
//     (CB_VA01、「文字列__1行_」が必須です)を返されてしまい、実機で実際に確認した
//     (アーカイブ登録失敗→削除キャンセルのフェイルセーフが働き、削除自体が起きない)。
//     TEST_APP_ID_1/2は他プラグインと共有しており、この必須フィールドは既存設定のため触らない
//     方針(CLAUDE.md開発方針7)と合わせ、fiscal_year_numbering(専用のカウンターアプリを別途
//     作成している)と同じ考え方で、このプラグイン専用の小さなアーカイブ先テストアプリを
//     新規作成した(アプリID: 600、`削除バックアップアーカイブ先アプリ`のフィールドのみで
//     他の必須フィールドを持たない)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const DBACK_ARCHIVE_APP_ID = process.env.DBACK_ARCHIVE_APP_ID || '600';

const SOURCE_APP_FIELDS = {
  dback_test_file: {
    type: 'FILE',
    code: 'dback_test_file',
    label: '添付ファイル(削除バックアップテスト用)',
  },
};

const ARCHIVE_APP_FIELDS = {
  dback_archive_json: {
    type: 'MULTI_LINE_TEXT',
    code: 'dback_archive_json',
    label: 'バックアップJSON(テスト用)',
  },
  dback_archive_files: {
    type: 'FILE',
    code: 'dback_archive_files',
    label: 'バックアップ添付ファイル(テスト用)',
  },
};

const ensureSourceAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, SOURCE_APP_FIELDS);

const ensureArchiveAppFields = (env, appId) =>
  kintoneAdmin.ensureFormFields(env, appId, ARCHIVE_APP_FIELDS);

// ファイルアップロードAPIはmultipart/form-data専用で、kintone-admin.jsのrequest()は
// JSONボディのみに対応している。テストデータ作成専用に、Node標準のグローバルfetch/
// FormData/Blob(Node 18+、追加の依存パッケージ不要)を使った薄いヘルパーをここに置く。
const uploadTestFile = async (env, content, filename, contentType) => {
  const domain = env.KINTONE_DOMAIN.replace(/^https?:\/\//, '').replace(
    /\/+$/,
    '',
  );
  const auth = Buffer.from(
    `${env.KINTONE_USERNAME}:${env.KINTONE_PASSWORD}`,
  ).toString('base64');
  const formData = new FormData();
  formData.append('file', new Blob([content], { type: contentType }), filename);

  const resp = await fetch(`https://${domain}/k/v1/file.json`, {
    method: 'POST',
    headers: { 'X-Cybozu-Authorization': auth },
    body: formData,
  });
  if (!resp.ok) {
    throw new Error(
      `テストファイルのアップロードに失敗しました: ${resp.status} ${await resp.text()}`,
    );
  }
  const data = await resp.json();
  return data.fileKey;
};

// 削除元アプリ(TEST_APP_ID_1)に、添付ファイル1件を持つテストレコードを作成し、レコードIDを返す。
const createSourceRecordWithFile = async (
  env,
  appId,
  fileContent,
  fileName,
) => {
  const fileKey = await uploadTestFile(
    env,
    fileContent,
    fileName,
    'text/plain',
  );
  const resp = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record: {
      dback_test_file: { value: [{ fileKey }] },
    },
  });
  return resp.id;
};

module.exports = {
  DBACK_ARCHIVE_APP_ID,
  SOURCE_APP_FIELDS,
  ARCHIVE_APP_FIELDS,
  ensureSourceAppFields,
  ensureArchiveAppFields,
  uploadTestFile,
  createSourceRecordWithFile,
};
