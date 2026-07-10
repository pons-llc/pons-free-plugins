(function (global, kintone) {
  'use strict';

  // 一覧画面での複数レコード一括ダウンロード。現在の絞り込み条件(kintone.app.getQueryCondition())に
  // 一致する全レコードを対象に、レコードごとにExcelファイルを生成し、1つのzipにまとめてダウンロードする。

  const NS = global.ExcelReportExport;
  const {
    TemplateSource,
    WorkbookBuilder,
    DownloadFile,
    FileNameTemplate,
    RecordValues,
    RecordFetcher,
    BulkLimit,
    ZipBundle,
  } = NS;

  const buildZipFileName = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `excel_report_export_${stamp}.zip`;
  };

  const preventUnload = (event) => {
    event.preventDefault();
    event.returnValue = '';
  };

  const exportBulk = async (config, appId) => {
    const query = kintone.app.getQueryCondition() || '';

    const totalCount = await RecordFetcher.fetchTotalCount(appId, query);
    const limitCheck = BulkLimit.checkBulkLimit(
      totalCount,
      config.bulkDownloadLimit,
    );
    if (!limitCheck.allowed) {
      global.alert(limitCheck.message);
      return;
    }

    const confirmResult = await kintone.showConfirmDialog({
      title: '一括ダウンロードの確認',
      body: `対象レコード数: ${totalCount}件\nこの内容でExcelファイルを一括生成し、1つのzipファイルとしてダウンロードします。よろしいですか?`,
    });
    if (confirmResult !== 'OK') {
      return;
    }

    global.addEventListener('beforeunload', preventUnload);
    kintone.showLoading('VISIBLE');
    try {
      const templateArrayBuffer = await TemplateSource.fetchTemplateArrayBuffer(
        config.templateSource,
      );
      const records = await RecordFetcher.fetchAllRecords(appId, query);

      const files = [];
      const allWarnings = [];
      for (const record of records) {
        // ExcelJSはロード時にArrayBufferの中身を読み取って内部状態を構築するため、
        // レコードごとに独立したコピーを渡す(同一バッファの使い回しによる副作用を避ける)。
        const { arrayBuffer, warnings } = await WorkbookBuilder.buildWorkbook(
          templateArrayBuffer.slice(0),
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
        files.push({ name: fileName, data: arrayBuffer });
        if (warnings.length > 0) {
          allWarnings.push(
            `レコード($id=${record.$id.value}): ${warnings.join(' / ')}`,
          );
        }
      }

      const dedupedNames = FileNameTemplate.dedupeFileNames(
        files.map((f) => f.name),
      );
      const zipEntries = files.map((f, i) => ({
        name: dedupedNames[i],
        data: f.data,
      }));
      const zipBytes = ZipBundle.buildZip(zipEntries);

      DownloadFile.triggerDownload(
        zipBytes,
        buildZipFileName(),
        DownloadFile.ZIP_MIME_TYPE,
      );

      if (allWarnings.length > 0) {
        global.alert(
          `zipファイルを出力しました。ただし以下のレコードで注意点があります。\n\n${allWarnings.join('\n')}`,
        );
      }
    } finally {
      kintone.showLoading('HIDDEN');
      global.removeEventListener('beforeunload', preventUnload);
    }
  };

  NS.BulkExport = { exportBulk };
})(window, kintone);
