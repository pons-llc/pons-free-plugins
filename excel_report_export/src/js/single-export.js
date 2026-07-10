(function (global, kintone) {
  'use strict';

  // 1件のレコード(現在開いている詳細画面のレコード)をExcel出力する一連の処理。

  const NS = global.ExcelReportExport;
  const {
    TemplateSource,
    WorkbookBuilder,
    DownloadFile,
    FileNameTemplate,
    RecordValues,
  } = NS;

  const isConfigured = (config) =>
    Boolean(
      config.templateSource.appId &&
      config.templateSource.recordId &&
      config.templateSource.fieldCode,
    );

  const exportRecord = async (config, record) => {
    if (!isConfigured(config)) {
      throw new Error(
        'テンプレート参照先が設定されていません。プラグインの設定を確認してください。',
      );
    }

    kintone.showLoading('VISIBLE');
    try {
      const templateArrayBuffer = await TemplateSource.fetchTemplateArrayBuffer(
        config.templateSource,
      );
      const { arrayBuffer, warnings } = await WorkbookBuilder.buildWorkbook(
        templateArrayBuffer,
        config,
        record,
      );

      const fileNameValues = RecordValues.buildFileNameValues(
        config.fileNameTemplate,
        record,
      );
      const fileName = FileNameTemplate.buildFileName(
        config.fileNameTemplate,
        fileNameValues,
      );

      DownloadFile.triggerDownload(
        arrayBuffer,
        fileName,
        DownloadFile.XLSX_MIME_TYPE,
      );

      if (warnings.length > 0) {
        // 書き込みに失敗したセルやテーブルの行あふれがあっても、生成できたファイルは
        // ダウンロードまで完了させ、警告は別途ユーザーへ知らせる(判断記録.md参照)。
        global.alert(
          `Excelファイルを出力しました。ただし以下の点にご注意ください。\n\n${warnings.join('\n')}`,
        );
      }
    } finally {
      kintone.showLoading('HIDDEN');
    }
  };

  NS.SingleExport = { exportRecord, isConfigured };
})(window, kintone);
