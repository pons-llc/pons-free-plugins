// NOTE(判断記録.md参照): fiscal_year_numberingのeslint.config.mjsをそのままコピーしたところ、
// インストールされた@cybozu/eslint-config@25.0.1では `flat/globals/kintone.js` や
// `flat/lib/base.js` 等の個別モジュールの公開形式(配列ではなくオブジェクト/関数)が変わっており、
// `...kintoneGlobalConfig` のspreadが失敗して起動不能だった。
// パッケージが公式に提供している統合プリセット`flat/presets/kintone-customize-prettier.js`
// (kintoneのグローバル+ベースルール+Prettier連携を1つにまとめたもの)を使う形に変更している。
import kintoneCustomizePrettierConfig from '@cybozu/eslint-config/flat/presets/kintone-customize-prettier.js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...kintoneCustomizePrettierConfig,
  {
    // js/lib/*.jsはブラウザ(kintoneプラグイン本体)とNode(Jestのrequire())の両方から
    // 読み込まれるUMD形式(`typeof module !== 'undefined'`)になっており、
    // __tests__/*.test.jsやjest.config.jsもNode(CommonJS)環境で動く。
    // kintone向けプリセットのグローバルはブラウザ+kintone専用のため、
    // module/require等のCommonJSグローバルを明示的に追加する。
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': ['error', { singleQuote: true }],
      'space-before-function-paren': 0,
      'object-curly-spacing': 0,
    },
  },
  {
    // __tests__配下はJest環境で実行されるため、Jestが注入するグローバル関数を追加する。
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: {
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
];
