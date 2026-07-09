(function (root) {
  'use strict';

  // カウンター専用アプリのcombination_key/key_sequenceを組み立てる。
  // 表示用フォーマット(numberFormat.separator等)とは独立した内部形式で、
  // 表示フォーマットを変更してもキーの一意性・継続性が壊れないようにする。
  const INTERNAL_DELIMITER = '::';
  const SEGMENT_DELIMITER = '|';

  const build = (targetAppId, fiscalYear, segments) => {
    const sorted = [...segments].sort((a, b) => a.order - b.order);
    const segmentPart = sorted.map((s) => `${s.code}=${s.value}`).join(SEGMENT_DELIMITER);
    return [targetAppId, fiscalYear, segmentPart].join(INTERNAL_DELIMITER);
  };

  const withSequence = (combinationKey, sequence) =>
    `${combinationKey}${INTERNAL_DELIMITER}${sequence}`;

  const CounterKey = { build, withSequence };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CounterKey;
  } else {
    root.FiscalYearNumbering = root.FiscalYearNumbering || {};
    root.FiscalYearNumbering.CounterKey = CounterKey;
  }
})(typeof window !== 'undefined' ? window : globalThis);
