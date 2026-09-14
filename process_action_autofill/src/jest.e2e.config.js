module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 60000,
  // config-screen.e2e.test.jsとprocess-proceed-flow.e2e.test.jsが同じ検証環境アプリ
  // (PAF_TEST_APP_ID)のプラグイン設定を書き換えるため、並列実行すると設定保存・デプロイの
  // 競合が起きる(delete_backup/self_lookupと同じ理由)。直列実行にする。
  maxWorkers: 1,
};
