(function (root) {
  'use strict';

  // Excelのセル番地(例: "B2", "AA100")の検証・分解・組み立てを行う純粋関数群。
  // シート内の行・列を扱うすべてのロジック(セルマッピング検証・サブテーブル行展開)から
  // 共通で利用する。

  const ADDRESS_PATTERN = /^([A-Z]{1,3})([1-9][0-9]*)$/;

  const isValid = (addr) => {
    if (typeof addr !== 'string') {
      return false;
    }
    return ADDRESS_PATTERN.test(addr);
  };

  const parse = (addr) => {
    const match = typeof addr === 'string' ? addr.match(ADDRESS_PATTERN) : null;
    if (!match) {
      throw new Error(`不正なセル番地です: ${addr}`);
    }
    return { column: match[1], row: Number(match[2]) };
  };

  const build = (column, row) => {
    if (typeof column !== 'string' || !/^[A-Za-z]{1,3}$/.test(column)) {
      throw new Error(`不正な列指定です: ${column}`);
    }
    if (!Number.isInteger(row) || row <= 0) {
      throw new Error(`行番号は1以上の整数である必要があります: ${row}`);
    }
    return `${column.toUpperCase()}${row}`;
  };

  const CellAddress = { isValid, parse, build };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CellAddress;
  } else {
    root.ExcelReportExport = root.ExcelReportExport || {};
    root.ExcelReportExport.CellAddress = CellAddress;
  }
})(typeof window !== 'undefined' ? window : globalThis);
