module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 120000,
  // aggregation.e2e.test.jsが同じ検証環境アプリ(TEST_APP_ID_1)へプラグイン設定の保存・
  // デプロイを行うため、並列実行するとデプロイ競合が起きる(self_lookupと同様の対応)。
  maxWorkers: 1,
};
