module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 60000,
  // record-panel.e2e.test.jsが同じ検証環境アプリ(TEST_APP_ID_1)に対してプラグイン設定の保存・
  // デプロイを行うため、並列実行するとconfig-screen.e2e.test.jsと競合する(org_lookupと同じ理由)。
  // 直列実行にする。
  maxWorkers: 1,
};
