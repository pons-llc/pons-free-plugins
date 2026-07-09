(function (root) {
  'use strict';

  // ドロップダウン/ラジオボタンの選択値を、設定順に並んだ {code, order, value} の配列へ変換する。
  // 選択肢ごとの上書き文字列があればそれを、なければ選択肢の値そのものを使う。
  const resolve = (segments, record) => {
    const sorted = [...segments].sort((a, b) => a.order - b.order);
    return sorted.map((segment) => {
      const field = record[segment.fieldCode];
      const rawValue = field ? field.value : '';
      const override = (segment.optionOverrides || {})[rawValue];
      const value = override ? override : rawValue;
      return { code: segment.fieldCode, order: segment.order, value };
    });
  };

  const SegmentValue = { resolve };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SegmentValue;
  } else {
    root.FiscalYearNumbering = root.FiscalYearNumbering || {};
    root.FiscalYearNumbering.SegmentValue = SegmentValue;
  }
})(typeof window !== 'undefined' ? window : globalThis);
