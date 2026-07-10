(function (root) {
  'use strict';

  // 色分けフィールドの値ごとにバー色を割り当てる。ユーザー選択などの配列値は先頭要素のcodeを、
  // ドロップダウン/ラジオボタンなどの文字列値はそのまま色分けキーとして使う。

  const DEFAULT_PALETTE = [
    '#3498db',
    '#e74c3c',
    '#2ecc71',
    '#f39c12',
    '#9b59b6',
    '#1abc9c',
    '#34495e',
    '#e67e22',
    '#95a5a6',
    '#16a085',
  ];

  const resolveColorKey = (record, fieldCode) => {
    if (!fieldCode || !record[fieldCode]) {
      return '';
    }
    const value = record[fieldCode].value;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '';
      }
      const first = value[0];
      if (first && typeof first === 'object') {
        return first.code || first.name || '';
      }
      return String(first);
    }
    return value === null || value === undefined ? '' : String(value);
  };

  // rows: RecordModel.buildRows() の戻り値。値の昇順(文字列ソート)で色を割り当てるため、
  // 同じデータを与えれば行の並び順によらず常に同じ色マップになる(決定的)。
  const assignColors = (rows, colorFieldCode, palette) => {
    const usedPalette = palette && palette.length ? palette : DEFAULT_PALETTE;
    const uniqueKeys = Array.from(
      new Set(
        (rows || []).map((row) => resolveColorKey(row.record, colorFieldCode)),
      ),
    ).sort();
    const map = {};
    uniqueKeys.forEach((key, index) => {
      map[key] = usedPalette[index % usedPalette.length];
    });
    return map;
  };

  const getColorForRow = (colorMap, record, fieldCode, fallbackColor) => {
    const key = resolveColorKey(record, fieldCode);
    const fallback = fallbackColor || DEFAULT_PALETTE[0];
    return Object.prototype.hasOwnProperty.call(colorMap || {}, key)
      ? colorMap[key]
      : fallback;
  };

  const ColorAssignment = {
    DEFAULT_PALETTE,
    resolveColorKey,
    assignColors,
    getColorForRow,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorAssignment;
  } else {
    root.GanttChartView = root.GanttChartView || {};
    root.GanttChartView.ColorAssignment = ColorAssignment;
  }
})(typeof window !== 'undefined' ? window : globalThis);
