(function (global) {
  'use strict';

  // Blob + <a download> によるクライアント完結のファイルダウンロード。
  // secureCodingGuideline.mdの「外部サイトへのリダイレクト」対策として、a要素のhrefには
  // 常にこの関数内で生成したBlob URL(blob:から始まるURL)のみを設定し、外部からの入力を使わない。

  const NS = global.ExcelReportExport;

  const triggerDownload = (data, fileName, mimeType) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // 生成したBlob URLはダウンロード開始後に解放する(メモリリーク防止)。
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const XLSX_MIME_TYPE =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const ZIP_MIME_TYPE = 'application/zip';

  NS.DownloadFile = { triggerDownload, XLSX_MIME_TYPE, ZIP_MIME_TYPE };
})(window);
