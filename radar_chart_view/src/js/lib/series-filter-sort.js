(function (root) {
  'use strict';

  // 生成HTML内での系列の絞り込み(表示/非表示チェックボックス)・並べ替え(プルダウン)ロジック。
  // 入力はjs/lib/radar-stats.jsのtoDisplayValues()が返す { label, values, count, displayValues } の配列。

  const SORT_MODES = ['original', 'label-asc', 'total-desc', 'total-asc'];

  const filterVisibleSeries = (series, hiddenLabels) => {
    const hidden = new Set(hiddenLabels || []);
    return (series || []).filter((s) => !hidden.has(s.label));
  };

  const totalOf = (series) =>
    (series.displayValues || []).reduce((sum, v) => sum + v, 0);

  const sortSeries = (series, sortMode) => {
    const list = (series || []).slice();
    switch (sortMode) {
      case 'label-asc':
        return list.sort((a, b) => a.label.localeCompare(b.label, 'ja'));
      case 'total-desc':
        return list.sort((a, b) => totalOf(b) - totalOf(a));
      case 'total-asc':
        return list.sort((a, b) => totalOf(a) - totalOf(b));
      case 'original':
      default:
        return list;
    }
  };

  const SeriesFilterSort = {
    SORT_MODES,
    filterVisibleSeries,
    sortSeries,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeriesFilterSort;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.SeriesFilterSort = SeriesFilterSort;
  }
})(typeof window !== 'undefined' ? window : globalThis);
