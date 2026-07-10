'use strict';

// pnpm installで取得した外部ライブラリ(ExcelJS, fflate)のブラウザ向けビルド成果物を
// js/vendor/ にコピーする。本プラグインの実行コード(manifest.jsonが参照するファイル)は
// このコピー結果であり、node_modules配下のファイルを直接参照しない。
// バンドラーを導入しない方針(CLAUDE.md)のため、各ライブラリが配布しているUMD/ブラウザ用の
// ビルド済みファイルをそのまま使う。
//
// pnpm run build の中で毎回実行され、js/vendor/ の中身は常にpackage.jsonで固定した
// バージョンから再生成される(js/vendor/はgitignore対象、node_modules同様に生成物として扱う)。

const fs = require('fs');
const path = require('path');

const VENDOR_DIR = path.join(__dirname, '..', 'js', 'vendor');

const FILES = [
  {
    from: path.join(
      __dirname,
      '..',
      'node_modules',
      'exceljs',
      'dist',
      'exceljs.min.js',
    ),
    to: path.join(VENDOR_DIR, 'exceljs.min.js'),
  },
  {
    from: path.join(
      __dirname,
      '..',
      'node_modules',
      'fflate',
      'umd',
      'index.js',
    ),
    to: path.join(VENDOR_DIR, 'fflate.min.js'),
  },
];

fs.mkdirSync(VENDOR_DIR, { recursive: true });

for (const file of FILES) {
  if (!fs.existsSync(file.from)) {
    console.error(
      `[copy-vendor] コピー元が見つかりません: ${file.from}\n` +
        '  先に `pnpm install` を実行してください。',
    );
    process.exit(1);
  }
  fs.copyFileSync(file.from, file.to);
  console.log(
    `[copy-vendor] ${path.relative(process.cwd(), file.from)} -> ${path.relative(process.cwd(), file.to)}`,
  );
}
