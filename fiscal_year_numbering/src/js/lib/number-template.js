(function (root) {
  'use strict';

  const padSequence = (sequence, digits) => {
    const str = String(sequence);
    return str.length >= digits ? str : '0'.repeat(digits - str.length) + str;
  };

  // 元号+元号年、セグメント文字列(設定順)、ゼロ埋め連番を、設定された区切り文字で連結する。
  const render = (config, era, eraYear, segments, sequence) => {
    const { separator, sequenceDigits } = config.numberFormat;
    const parts = [
      `${era.code}${eraYear}`,
      ...segments.map((segment) => segment.value),
      padSequence(sequence, sequenceDigits),
    ];
    return parts.join(separator);
  };

  const NumberTemplate = { render };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NumberTemplate;
  } else {
    root.FiscalYearNumbering = root.FiscalYearNumbering || {};
    root.FiscalYearNumbering.NumberTemplate = NumberTemplate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
