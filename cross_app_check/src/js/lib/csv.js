(function (root) {
  'use strict';

  // 突合結果をCSV文字列にする。Excelで開く前提なので改行はCRLF。
  const NEWLINE = '\r\n';

  // カンマ・ダブルクォート・改行を含む値はダブルクォートで囲み、
  // 値の中のダブルクォートは2つ重ねてエスケープする(RFC 4180)。
  //
  // 先頭が = + - @ の値はExcelが数式として解釈してしまう(CSVインジェクション)ため、
  // シングルクォートを前置して無害化する。
  const escapeCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    if (/[",\r\n]/.test(guarded)) {
      return `"${guarded.replace(/"/g, '""')}"`;
    }
    return guarded;
  };

  const buildHeader = (result) => {
    const header = ['突合キー', '氏名'];
    (result.targets || []).forEach((target) => {
      header.push(`${target.label}_状況`);
      header.push(`${target.label}_件数`);
      header.push(`${target.label}_最終提出日`);
    });
    return header;
  };

  const buildRow = (result, row) => {
    const labels = result.labels || {};
    const submittedLabel = labels.submitted || '提出済';
    const unsubmittedLabel = labels.unsubmitted || '未提出';

    const cells = [row.key, row.name];
    (result.targets || []).forEach((target, position) => {
      const cell = (row.targets || [])[position] || {};
      cells.push(cell.submitted ? submittedLabel : unsubmittedLabel);
      cells.push(cell.count === undefined ? 0 : cell.count);
      cells.push(cell.lastDate || '');
    });
    return cells;
  };

  // 表示中の行(絞り込み後)をCSVにする
  const buildCsv = (result, rows) => {
    const source = result || {};
    const targetRows = rows || source.rows || [];
    const lines = [buildHeader(source)].concat(
      targetRows.map((row) => buildRow(source, row)),
    );
    return lines.map((cells) => cells.map(escapeCell).join(',')).join(NEWLINE);
  };

  // ExcelがUTF-8と判別できるようBOMを付ける
  const withBom = (csvText) => `\ufeff${csvText}`;

  const buildFileName = (result) =>
    `cross-app-check_${(result && result.runId) || 'run'}.csv`;

  const Csv = {
    NEWLINE,
    escapeCell,
    buildCsv,
    withBom,
    buildFileName,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Csv;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.Csv = Csv;
  }
})(typeof window !== 'undefined' ? window : globalThis);
