(function (root) {
  'use strict';

  // グループキーごとに固定パレットから決定的に色を割り当てる(CSSインジェクション対策として、
  // フィールド値そのものをCSSへ埋め込まず、パレット配列のインデックス選択にのみ使う。
  // gantt_chart_view/src/js/lib/color-assignment.js と同じ考え方)。

  const DEFAULT_PALETTE = [
    '#3498db',
    '#e67e22',
    '#2ecc71',
    '#9b59b6',
    '#e74c3c',
    '#1abc9c',
    '#f1c40f',
    '#34495e',
  ];

  const hashKey = (key) => {
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return hash;
  };

  // groupKeys: 出現順のグループキー配列(''は「未設定」を表す)
  const assignColors = (groupKeys, palette) => {
    const usedPalette = palette && palette.length ? palette : DEFAULT_PALETTE;
    const map = {};
    groupKeys.forEach((key) => {
      if (key === '') {
        map[key] = '#bbbbbb';
        return;
      }
      map[key] = usedPalette[hashKey(key) % usedPalette.length];
    });
    return map;
  };

  const ColorAssignment = { DEFAULT_PALETTE, assignColors };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorAssignment;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.ColorAssignment = ColorAssignment;
  }
})(typeof window !== 'undefined' ? window : globalThis);
