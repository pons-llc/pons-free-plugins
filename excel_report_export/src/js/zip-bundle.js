(function (global) {
  'use strict';

  // 複数のxlsxファイル(ArrayBuffer/Uint8Array)を1つのzipファイルにまとめる(fflateのラッパー)。
  // 一括ダウンロード時にのみ使用する。ファイル名の重複解消はjs/lib/filename-template.jsの
  // dedupeFileNamesで呼び出し元があらかじめ行う前提。

  const NS = global.ExcelReportExport;

  // files: [{ name: string, data: ArrayBuffer|Uint8Array }]
  const buildZip = (files) => {
    const entries = {};
    files.forEach((file) => {
      entries[file.name] =
        file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    });
    // zipSyncは同期処理(ブラウザのメインスレッドをブロックする)。一括ダウンロードの上限件数を
    // 設定画面で必須にしているのは、この同期処理が長時間化しないようにする意図もある(判断記録.md参照)。
    return global.fflate.zipSync(entries, { level: 6 });
  };

  NS.ZipBundle = { buildZip };
})(window);
