'use strict';

// 一括承認プラグインのE2Eテストが対象とするアプリと、テストデータの用意。
//
// TEST_APP_ID_1/2はプロセス管理が未設定の共有フィクスチャアプリであり、他プラグインとの
// 共有資産を巻き込まずにこのプラグインの中核機能(プロセス管理のアクション実行)を検証するには
// 不向きなため、`delete_backup`のDBACK_ARCHIVE_APP_IDと同じ考え方で本プラグイン専用の
// 検証環境アプリ(一括承認プラグインE2Eテスト用アプリ)を新規作成した
// (アプリID: 638。フィールドはbap_title/bap_amountのみ、プロセス管理を
// 未処理→承認待ち→承認済み、および承認待ち→未処理〈差し戻す〉の構成で有効化済み)。
// このアプリは他プラグインと共有しないため、テストのたびにレコードを全削除して作り直してよい。
//
// 実機で判明した落とし穴: プロセス管理を有効化したアプリのデフォルトの一覧(すべてのレコード)は
// 「作業者 in (LOGINUSER())」で自動的に絞り込まれる(idea.mdの「自分の一覧」という設計前提の
// 裏付けでもある)。そのため、先頭ステータス(未処理、index "0")の作業者を空のままにすると、
// 新規作成したレコードの「作業者」が空になり、テスト実行ユーザーのデフォルト一覧に一件も
// 表示されずボタン押下後「対象レコードがありません」になってしまう(実際に発生し原因調査済み)。
// このアプリでは先頭ステータスの作業者に`{ type: 'FIELD_ENTITY', code: '作成者' }`を設定して
// レコード作成者(=REST APIを叩くadminユーザー)を自動的に作業者にしている
// (先頭ステータスの作業者は「空」または「レコードの作成者フィールド」以外を指定するとPUT
// /k/v1/preview/app/status.jsonが400 CB_VA01を返す仕様のため、type:'USER'や'CREATOR'は使えない)。
// 2番目のステータス(承認待ち)は`type: 'ALL', entities: [{type:'USER', code: admin}]`にしており、
// assignee必須(`isAssigneeRequired`)には該当しない(先頭ステータスではない、かつtypeがONEでない)。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const BAP_TEST_APP_ID = process.env.BAP_TEST_APP_ID || '638';

// 対象レコードをすべて削除し、指定した件名で「未処理」状態のレコードを新規作成する
// (プロセス管理有効化直後の新規レコードは自動的に先頭ステータスになる)。
const seedRecords = async (env, appId, titles) => {
  await kintoneAdmin.deleteAllRecords(env, appId);
  const records = titles.map((title, i) => ({
    bap_title: { value: title },
    bap_amount: { value: String((i + 1) * 1000) },
  }));
  const { ids } = await kintoneAdmin.addRecords(env, appId, records);
  return ids;
};

// レコード1件のプロセス管理アクションを実行し、ステータスを進める(テストデータの
// ステータスを「承認待ち」等へ動かすためのヘルパー。値の直接書き換えはできないため
// 〈フィールド形式で確認済み〉、実際のアクション実行APIを使う)。
const advanceStatus = (env, appId, id, action) =>
  kintoneAdmin.request(env, '/k/v1/record/status.json', 'PUT', {
    app: appId,
    id,
    action,
  });

module.exports = { BAP_TEST_APP_ID, seedRecords, advanceStatus };
