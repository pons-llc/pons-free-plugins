module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 60000,
  // 各テストファイルのfixtures.jsが同じ検証環境アプリ(TEST_APP_ID_1)に対して
  // ensureFormFields()/ensureSpacerInLayout()(デプロイを伴う)を実行するため、並列実行すると
  // デプロイ競合(データベースのロック失敗)やフィールド作成のTOCTOU競合が発生する。直列実行にする。
  maxWorkers: 1,
};
