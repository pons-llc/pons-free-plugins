// プロセス管理を有効にした専用のE2Eテスト用アプリを一度だけ作成するセットアップスクリプト。
// 実行: node provisioning/seed-test-app.js
//
// TEST_APP_ID_1/2はプロセス管理が無効(かつ他プラグインと共有しているため、プロセス管理の
// 有効化のような「フォーム上部にステータスバーが追加される」アプリ全体に影響する変更を加えると、
// 他プラグインのE2Eテスト(特にスクリーンショット)に予期せぬ影響を与えるリスクがある)。
// delete_backup(DBACK_ARCHIVE_APP_ID)・fiscal_year_numbering(カウンター専用アプリ)と同じ
// 「専用の小さなテストアプリを新規作成する」方針に倣い、本プラグイン専用のテストアプリを作る。
//
// フィールド追加/プロセス管理設定/デプロイなどのREST API呼び出しは、リポジトリ共通ツール
// scripts/kintone-admin.js を使う。外部npmパッケージは一切追加しない(CLAUDE.md方針9)。

const common = require('../../scripts/e2e/common');
const kintoneAdmin = require('../../scripts/kintone-admin');

const buildFieldProperties = () => ({
  paf_text_source: {
    type: 'SINGLE_LINE_TEXT',
    code: 'paf_text_source',
    label: '文字列(コピー元テスト用)',
  },
  paf_text_target: {
    type: 'SINGLE_LINE_TEXT',
    code: 'paf_text_target',
    label: '文字列(対象フィールドテスト用)',
  },
  paf_number_target: {
    type: 'NUMBER',
    code: 'paf_number_target',
    label: '数値(対象フィールドテスト用)',
  },
  paf_radio_target: {
    type: 'RADIO_BUTTON',
    code: 'paf_radio_target',
    label: 'ラジオボタン(対象フィールドテスト用)',
    options: {
      選択肢A: { label: '選択肢A', index: '0' },
      選択肢B: { label: '選択肢B', index: '1' },
    },
  },
  paf_checkbox_target: {
    type: 'CHECK_BOX',
    code: 'paf_checkbox_target',
    label: 'チェックボックス(対象フィールドテスト用)',
    options: {
      選択肢A: { label: '選択肢A', index: '0' },
      選択肢B: { label: '選択肢B', index: '1' },
    },
  },
  paf_date_target: {
    type: 'DATE',
    code: 'paf_date_target',
    label: '日付(対象フィールドテスト用)',
  },
  paf_datetime_target: {
    type: 'DATETIME',
    code: 'paf_datetime_target',
    label: '日時(対象フィールドテスト用)',
  },
  paf_user_target: {
    type: 'USER_SELECT',
    code: 'paf_user_target',
    label: 'ユーザー選択(対象フィールドテスト用)',
  },
  paf_org_target: {
    type: 'ORGANIZATION_SELECT',
    code: 'paf_org_target',
    label: '組織選択(対象フィールドテスト用)',
  },
  paf_group_target: {
    type: 'GROUP_SELECT',
    code: 'paf_group_target',
    label: 'グループ選択(対象フィールドテスト用)',
  },
});

// assignee.entitiesを空配列にすると「レコード閲覧可能なユーザー全員が実行できる」扱いになる
// (kintoneドキュメントMCP「プロセス管理の設定を変更する」actions[].type=PRIMARYの説明で確認済み)
// ため、検証環境の管理ユーザーがそのままどのアクションも実行できる。
const PROCESS_MANAGEMENT_SETTINGS = {
  enable: true,
  states: {
    未処理: { name: '未処理', index: '0', assignee: { type: 'ONE', entities: [] } },
    処理中: { name: '処理中', index: '1', assignee: { type: 'ONE', entities: [] } },
    完了: { name: '完了', index: '2', assignee: { type: 'ONE', entities: [] } },
  },
  actions: [
    { name: '処理を開始する', from: '未処理', to: '処理中', filterCond: '', type: 'PRIMARY' },
    { name: '完了する', from: '処理中', to: '完了', filterCond: '', type: 'PRIMARY' },
  ],
};

(async () => {
  const repoRoot = common.findRepoRoot(__dirname);
  const env = common.loadEnv(repoRoot);
  if (!env.KINTONE_DOMAIN || !env.KINTONE_USERNAME || !env.KINTONE_PASSWORD) {
    console.error('.envにKINTONE_DOMAIN / KINTONE_USERNAME / KINTONE_PASSWORDを設定してください。');
    process.exit(1);
  }

  console.log('1/5 プロセスアクション自動入力用テストアプリを作成しています...');
  const created = await kintoneAdmin.createApp(env, 'プロセスアクション自動入力 テスト用アプリ');
  const appId = created.app;
  console.log(`  -> アプリID: ${appId}`);

  console.log('2/5 フィールドを追加しています...');
  await kintoneAdmin.addFormFields(env, appId, buildFieldProperties());

  console.log('3/5 プロセス管理を有効化しています...');
  await kintoneAdmin.updateProcessManagement(env, appId, PROCESS_MANAGEMENT_SETTINGS);

  console.log('4/5 一般権限を「閲覧+作成+編集(削除は不可)」に設定しています...');
  await kintoneAdmin.updateAppPermissions(env, appId, [
    {
      entity: { type: 'GROUP', code: 'everyone' },
      appEditable: false,
      recordViewable: true,
      recordAddable: true,
      recordEditable: true,
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

  console.log('5/5 運用環境へ反映しています...');
  await kintoneAdmin.deployApp(env, appId);

  console.log('');
  console.log(`完了しました。テスト用アプリID: ${appId}`);
  console.log('このIDを .env の PAF_TEST_APP_ID に設定してください(src/e2e/fixtures.jsのフォールバック既定値としても使われます)。');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
