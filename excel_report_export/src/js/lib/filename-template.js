(function (root) {
  'use strict';

  // 出力ファイル名の組み立て。テンプレート文字列(「{フィールドコード}」を含む)へレコードの
  // 値を差し込み、OS上で使用できない文字を除去し、.xlsx拡張子を付与する。
  // 一括ダウンロード時は、複数レコードが同じファイル名になるケース(dedupeFileNames)にも対応する。

  const PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;
  const FORBIDDEN_CHARS_PATTERN = /[\\/:*?"<>|\x00-\x1f]/g; // eslint-disable-line no-control-regex
  const DEFAULT_MAX_LENGTH = 200;
  const DEFAULT_BASE_NAME = 'record';
  const EXTENSION_PATTERN = /\.xlsx$/i;

  const renderFileName = (template, valuesByFieldCode) => {
    const values = valuesByFieldCode || {};
    return String(template || '').replace(
      PLACEHOLDER_PATTERN,
      (match, fieldCode) => {
        const value = values[fieldCode];
        return value === undefined || value === null ? '' : String(value);
      },
    );
  };

  const sanitizeFileNameSegment = (name) =>
    String(name || '')
      .replace(FORBIDDEN_CHARS_PATTERN, '')
      .replace(/^[\s.]+/, '')
      .replace(/[\s.]+$/, '');

  const buildFileName = (template, valuesByFieldCode, options) => {
    const maxLength = (options && options.maxLength) || DEFAULT_MAX_LENGTH;

    let base = sanitizeFileNameSegment(
      renderFileName(template, valuesByFieldCode),
    );
    if (!base) {
      base = DEFAULT_BASE_NAME;
    }

    const hasExtension = EXTENSION_PATTERN.test(base);
    const ext = hasExtension ? base.slice(-5) : '.xlsx';
    let namePart = hasExtension ? base.slice(0, -5) : base;

    const maxNamePartLength = Math.max(1, maxLength - ext.length);
    if (namePart.length > maxNamePartLength) {
      namePart = namePart.slice(0, maxNamePartLength);
    }
    if (!namePart) {
      namePart = DEFAULT_BASE_NAME;
    }

    return `${namePart}${ext}`;
  };

  const splitExtension = (name) => {
    const idx = name.lastIndexOf('.');
    if (idx > 0) {
      return { base: name.slice(0, idx), ext: name.slice(idx) };
    }
    return { base: name, ext: '' };
  };

  // 一括ダウンロード時、複数レコードのファイル名テンプレート出力が同名になった場合に、
  // zipエントリ名が衝突しないよう "(2)" のような連番を付与する。
  const dedupeFileNames = (names) => {
    const counts = new Map();
    return (names || []).map((name) => {
      const count = (counts.get(name) || 0) + 1;
      counts.set(name, count);
      if (count === 1) {
        return name;
      }
      const { base, ext } = splitExtension(name);
      return `${base}(${count})${ext}`;
    });
  };

  const FileNameTemplate = {
    renderFileName,
    sanitizeFileNameSegment,
    buildFileName,
    dedupeFileNames,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileNameTemplate;
  } else {
    root.ExcelReportExport = root.ExcelReportExport || {};
    root.ExcelReportExport.FileNameTemplate = FileNameTemplate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
