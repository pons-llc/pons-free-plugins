module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 60000,
  // 複数のe2eテストファイルが同じ検証環境アプリのプラグイン設定(単一スロット)を
  // 同時に書き換えると競合するため、直列実行にする(他プラグインと同じ対策)。
  maxWorkers: 1,
};
