(function (root) {
  'use strict';

  // サブテーブルの行データを、指定シートの「繰り返し開始行+行範囲(maxRows)+列マッピング」に
  // 従って展開し、書き込むべき{sheetName, cellAddress, value}の配列を組み立てる純粋関数。
  // manifest.jsonでは本ファイルより前にcell-address.js / field-value-format.jsを読み込む。

  const CellAddress =
    typeof module !== 'undefined' && module.exports
      ? require('./cell-address')
      : root.ExcelReportExport.CellAddress;
  const { formatFieldValue } =
    typeof module !== 'undefined' && module.exports
      ? require('./field-value-format')
      : root.ExcelReportExport.FieldValueFormat;

  const expandSubtableRows = (config, tableRows, options) => {
    const { sheetName, startRow, maxRows, columns } = config;

    if (!Number.isInteger(startRow) || startRow <= 0) {
      throw new Error(`startRowは1以上の整数である必要があります: ${startRow}`);
    }
    if (!Number.isInteger(maxRows) || maxRows <= 0) {
      throw new Error(`maxRowsは1以上の整数である必要があります: ${maxRows}`);
    }

    const rows = tableRows || [];
    const rowsToWrite = rows.slice(0, maxRows);
    const writes = [];

    rowsToWrite.forEach((tableRow, rowIndex) => {
      const targetRow = startRow + rowIndex;
      (columns || []).forEach((col) => {
        const cellAddress = CellAddress.build(col.column, targetRow);
        const field =
          tableRow && tableRow.value
            ? tableRow.value[col.fieldCode]
            : undefined;
        const value = field ? formatFieldValue(field, options) : '';
        writes.push({
          sheetName,
          cellAddress,
          value: value === null ? '' : value,
        });
      });
    });

    const truncatedCount = Math.max(0, rows.length - maxRows);

    return {
      writes,
      writtenRowCount: rowsToWrite.length,
      truncated: truncatedCount > 0,
      truncatedCount,
    };
  };

  const SubtableLayout = { expandSubtableRows };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubtableLayout;
  } else {
    root.ExcelReportExport = root.ExcelReportExport || {};
    root.ExcelReportExport.SubtableLayout = SubtableLayout;
  }
})(typeof window !== 'undefined' ? window : globalThis);
