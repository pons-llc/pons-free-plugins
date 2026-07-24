module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 60000,
  // list-view.e2e.test.jsがプラグインの設定を保存してからレコード一覧画面を検証するため、
  // config-screen.e2e.test.jsと並列実行すると設定の保存が競合する。直列実行にする。
  maxWorkers: 1,
};
