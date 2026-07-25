module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 60000,
  // 両テストファイルともTEST_APP_ID_1へのプラグイン追加・フィールド追加(deployApp()を伴う)を
  // 行うため、並列実行するとデプロイ競合が起きうる(self_lookup・org_lookupと同じ理由)。
  maxWorkers: 1,
};
