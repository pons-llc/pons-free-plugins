import kintoneConfig from '@cybozu/eslint-config/flat/lib/kintone.js';
import prettierConfig from '@cybozu/eslint-config/flat/lib/prettier.js';

// @cybozu/eslint-config 25.0.1 では flat/lib 配下は設定配列そのものではなく、
// 呼び出すと配列を返すファクトリー関数になっている(self_lookupと同じ構成)。

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...kintoneConfig(),
  ...prettierConfig(),
  {
    rules: {
      'prettier/prettier': ['error', { singleQuote: true }],
      'space-before-function-paren': 0,
      'object-curly-spacing': 0,
    },
  },
  {
    files: [
      '__tests__/**/*.js',
      'e2e/**/*.js',
      'jest.config.js',
      'jest.e2e.config.js',
      'eslint.config.mjs',
    ],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
  {
    // js/lib/**/*.js はブラウザ(manifest.jsonから読み込まれる)とNode(Jestからrequireされる)の
    // 両方で動く「isomorphic UMD風」パターンを使っている(self_lookupと同じ構成)。
    files: ['js/lib/**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
];
