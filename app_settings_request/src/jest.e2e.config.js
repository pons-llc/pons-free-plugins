module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 60000,
  // fixtures.jsが同じ検証環境アプリ(TEST_APP_ID_1)に対してensureFormFields()/
  // ensureSpacerInLayout()(デプロイを伴う)を実行するため、並列実行すると
  // デプロイ競合やフィールド作成のTOCTOU競合が発生する(self_lookupと同じ理由)。直列実行にする。
  maxWorkers: 1,
};
