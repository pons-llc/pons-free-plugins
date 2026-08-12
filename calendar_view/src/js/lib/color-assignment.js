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

  // #rgb/#rrggbbのみ許可する(CSSインジェクション対策。管理者操作でのみ設定される値だが、
  // 保存済みJSONを直接書き換えられた場合の多層防御として、値をそのままCSSへ渡す前に検証する)。
  const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const isValidHexColor = (value) =>
    typeof value === 'string' && HEX_COLOR_PATTERN.test(value);

  // groupKeys: 出現順のグループキー配列(''は「未設定」を表す)
  // overrides: { キー: '#rrggbb' } の管理者による値ごとの色指定(任意)
  const assignColors = (groupKeys, palette, overrides) => {
    const usedPalette = palette && palette.length ? palette : DEFAULT_PALETTE;
    const usedOverrides = overrides || {};
    const map = {};
    groupKeys.forEach((key) => {
      if (isValidHexColor(usedOverrides[key])) {
        map[key] = usedOverrides[key];
        return;
      }
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
