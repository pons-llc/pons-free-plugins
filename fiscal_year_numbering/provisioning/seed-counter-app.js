// カウンター専用アプリ(採番の排他制御・追記ログ)を一度だけ作成するセットアップスクリプト。
// 実行: node provisioning/seed-counter-app.js
//
// フィールド追加/権限変更/デプロイなどのREST API呼び出しは、リポジトリ共通ツール
// scripts/kintone-admin.js を使う(「アプリを作成するAPI」がAPIトークン認証を利用できない
// 仕様のため、このツール全体をパスワード認証(.envのKINTONE_USERNAME/KINTONE_PASSWORD)で統一)。
// 外部npmパッケージは一切追加しない(CLAUDE.md方針9)。

const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');
const CounterKey = require('../src/js/lib/counter-key');

// セグメントは最大何個まで、カウンター専用アプリ側で個別の列(segment_N_code/segment_N_value)
// として持つか(js/lib/counter-key.jsのMAX_SEGMENTSと共有)。これを超えるセグメント数を設定した
// 場合でも採番自体は動作するが(combination_key/segment_summaryには常に全セグメントが含まれる)、
// カウンター専用アプリの一覧で個別列として見えるのはこの数までになる。
const MAX_SEGMENTS = CounterKey.MAX_SEGMENTS;

const buildFieldProperties = () => {
  const properties = {
    key_sequence: {
      type: 'SINGLE_LINE_TEXT',
      code: 'key_sequence',
      label: '一意キー(combination_key::連番)',
      required: true,
      unique: true,
    },
    combination_key: {
      type: 'SINGLE_LINE_TEXT',
      code: 'combination_key',
      label: '組み合わせキー(対象アプリID::年度::セグメント)',
      required: true,
    },
    sequence_number: {
      type: 'NUMBER',
      code: 'sequence_number',
      label: '連番',
      required: true,
    },
    target_app_id: {
      type: 'NUMBER',
      code: 'target_app_id',
      label: '対象アプリID',
    },
    fiscal_year: {
      type: 'NUMBER',
      code: 'fiscal_year',
      label: '会計年度',
    },
    era_code: {
      type: 'SINGLE_LINE_TEXT',
      code: 'era_code',
      label: '元号コード',
    },
    era_year: {
      type: 'NUMBER',
      code: 'era_year',
      label: '元号年',
    },
    segment_summary: {
      type: 'MULTI_LINE_TEXT',
      code: 'segment_summary',
      label: 'セグメント内容(監査用、まとめ文字列)',
    },
  };

  // 位置ベースの汎用列。セグメントはプラグインごとに管理者が自由に選べる(数も内容も可変)ため、
  // 意味のある固定列名は作れない。「1番目のセグメント」「2番目のセグメント」という位置で
  // 個別に絞り込み・並び替えできるようにするための妥協案。
  for (let i = 1; i <= MAX_SEGMENTS; i += 1) {
    properties[`segment_${i}_code`] = {
      type: 'SINGLE_LINE_TEXT',
      code: `segment_${i}_code`,
      label: `セグメント${i}: フィールドコード`,
    };
    properties[`segment_${i}_value`] = {
      type: 'SINGLE_LINE_TEXT',
      code: `segment_${i}_value`,
      label: `セグメント${i}: 値`,
    };
  }

  return properties;
};

(async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  if (!env.KINTONE_DOMAIN || !env.KINTONE_USERNAME || !env.KINTONE_PASSWORD) {
    console.error(
      '.envにKINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORDを設定してください。'
    );
    process.exit(1);
  }

  console.log('1/4 カウンター専用アプリを作成しています...');
  const created = await kintoneAdmin.createApp(env, '採番カウンター(fiscal_year_numbering)');
  const appId = created.app;
  console.log(`  -> アプリID: ${appId}`);

  console.log('2/4 フィールドを追加しています...');
  await kintoneAdmin.addFormFields(env, appId, buildFieldProperties());

  console.log('3/4 一般権限を「閲覧+作成のみ(編集・削除は不可)」に設定しています...');
  await kintoneAdmin.updateAppPermissions(env, appId, [
    {
      entity: { type: 'GROUP', code: 'everyone' },
      appEditable: false,
      recordViewable: true,
      recordAddable: true,
      recordEditable: false,
      recordDeletable: false,
      recordImportable: false,
      recordExportable: false,
    },
    {
      entity: { type: 'CREATOR' },
      appEditable: true,
      recordViewable: true,
      recordAddable: true,
      recordEditable: true,
      recordDeletable: true,
      recordImportable: true,
      recordExportable: true,
    },
  ]);

  console.log('4/4 運用環境へ反映しています...');
  await kintoneAdmin.deployApp(env, appId);

  console.log('');
  console.log(`完了しました。カウンター専用アプリID: ${appId}`);
  console.log(
    'このIDを fiscal_year_numbering プラグインの設定画面「カウンター専用アプリID」に入力してください。'
  );
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
