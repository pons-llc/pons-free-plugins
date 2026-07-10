(function (root) {
  'use strict';

  // セルマッピング設定(シート名 + セル番地 + フィールドコード)のバリデーション。
  // 設定画面の保存前チェックと、書き込み実行前の防御的チェックの両方から呼び出す。
  // manifest.jsonでは本ファイルより前にcell-address.jsを読み込む(ブラウザ実行時の依存順)。

  const CellAddress =
    typeof module !== 'undefined' && module.exports
      ? require('./cell-address')
      : root.ExcelReportExport.CellAddress;
  const { formatFieldValue } =
    typeof module !== 'undefined' && module.exports
      ? require('./field-value-format')
      : root.ExcelReportExport.FieldValueFormat;

  const validateMapping = (mappingList) => {
    const errors = [];
    const seenBySheet = new Map();

    (mappingList || []).forEach((row, index) => {
      const sheetName = (row && row.sheetName) || '';
      const cellAddress = (row && row.cellAddress) || '';
      const fieldCode = (row && row.fieldCode) || '';

      if (!sheetName.trim()) {
        errors.push({ index, message: 'シート名を入力してください。' });
        return;
      }
      if (!CellAddress.isValid(cellAddress)) {
        errors.push({
          index,
          message: `セル番地の形式が不正です(例: B2): ${cellAddress}`,
        });
        return;
      }
      if (!fieldCode.trim()) {
        errors.push({ index, message: 'フィールドコードを入力してください。' });
        return;
      }

      const seenInSheet = seenBySheet.get(sheetName) || new Set();
      if (seenInSheet.has(cellAddress)) {
        errors.push({
          index,
          message: `シート「${sheetName}」のセル${cellAddress}は他の行と重複しています。`,
        });
        return;
      }
      seenInSheet.add(cellAddress);
      seenBySheet.set(sheetName, seenInSheet);
    });

    return { valid: errors.length === 0, errors };
  };

  // マッピング定義(シート名+セル番地+フィールドコード)とkintoneのレコードから、
  // Excelへ書き込むべき{sheetName, cellAddress, value}の命令リストを組み立てる純粋関数。
  // バリデーションで不正と判定された行(validateMappingが指摘するエラー行)は書き込み対象から除外する
  // (実行時に不正な設定へ静かにフォールバックするより、無視した方が安全なため)。
  const buildCellWrites = (mappingList, record, options) => {
    const { errors } = validateMapping(mappingList);
    const invalidIndexes = new Set(errors.map((e) => e.index));

    return (mappingList || [])
      .map((row, index) => ({ row, index }))
      .filter(({ index }) => !invalidIndexes.has(index))
      .map(({ row }) => {
        const field = record ? record[row.fieldCode] : undefined;
        const value = field ? formatFieldValue(field, options) : '';
        return {
          sheetName: row.sheetName,
          cellAddress: row.cellAddress,
          value: value === null ? '' : value,
        };
      });
  };

  const CellMapping = { validateMapping, buildCellWrites };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CellMapping;
  } else {
    root.ExcelReportExport = root.ExcelReportExport || {};
    root.ExcelReportExport.CellMapping = CellMapping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
