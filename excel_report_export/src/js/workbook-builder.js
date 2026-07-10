(function (global) {
  'use strict';

  // Excelテンプレート(ArrayBuffer)を読み込み、セルマッピング+サブテーブル設定+レコードの値から
  // 「書き込むべきセル」を求め(js/lib/cell-mapping.js, js/lib/subtable-layout.jsの純粋関数)、
  // ExcelJSで実際にセルへ値を書き込んでバイト列を返す。
  //
  // ExcelJS自体の読み書きは(ライブラリの都合上)結合的にならざるを得ないが、
  // 「マッピング定義→書き込み命令リスト」への変換はjs/lib配下の純粋関数に切り出し済みで、
  // ここではその命令リストをそのままExcelJSのAPIへ適用するだけにとどめている。

  const NS = global.ExcelReportExport;
  const { CellMapping, SubtableLayout } = NS;

  const applyWrites = (workbook, writes) => {
    const failures = [];
    writes.forEach(({ sheetName, cellAddress, value }) => {
      const sheet = workbook.getWorksheet(sheetName);
      if (!sheet) {
        failures.push(
          `シート「${sheetName}」が見つかりません(セル${cellAddress})。`,
        );
        return;
      }
      try {
        sheet.getCell(cellAddress).value = value === undefined ? '' : value;
      } catch (err) {
        // 結合セルの非マスターセルへの書き込みなど、テンプレートのレイアウトに起因するエラー。
        failures.push(
          `シート「${sheetName}」のセル${cellAddress}への書き込みに失敗しました: ${err.message}`,
        );
      }
    });
    return failures;
  };

  // config: { mappings, subtables } / record: kintoneのレコードオブジェクト
  // 戻り値: { arrayBuffer, warnings } (warningsは空配列なら問題なし)
  const buildWorkbook = async (
    templateArrayBuffer,
    config,
    record,
    options,
  ) => {
    const ExcelJSLib = global.ExcelJS;
    const workbook = new ExcelJSLib.Workbook();
    await workbook.xlsx.load(templateArrayBuffer);

    const warnings = [];

    const cellWrites = CellMapping.buildCellWrites(
      config.mappings || [],
      record,
      options,
    );
    warnings.push(...applyWrites(workbook, cellWrites));

    (config.subtables || []).forEach((subtable) => {
      const tableField = record && record[subtable.tableFieldCode];
      const tableRows =
        tableField && tableField.type === 'SUBTABLE' ? tableField.value : [];
      const result = SubtableLayout.expandSubtableRows(
        {
          sheetName: subtable.sheetName,
          startRow: subtable.startRow,
          maxRows: subtable.maxRows,
          columns: subtable.columns,
        },
        tableRows,
        options,
      );
      warnings.push(...applyWrites(workbook, result.writes));
      if (result.truncated) {
        warnings.push(
          `テーブル「${subtable.tableFieldCode}」の行数(${
            result.writtenRowCount + result.truncatedCount
          }行)がシート「${subtable.sheetName}」の行範囲(${
            subtable.maxRows
          }行)を超えたため、${result.truncatedCount}行を出力していません。`,
        );
      }
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return { arrayBuffer, warnings };
  };

  NS.WorkbookBuilder = { buildWorkbook };
})(window);
