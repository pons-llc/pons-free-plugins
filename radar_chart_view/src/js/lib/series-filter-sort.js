(function (root) {
  'use strict';

  // 生成HTML内での系列の並べ替え(プルダウン)ロジック。
  // 入力はjs/lib/radar-stats.jsのtoDisplayValues()が返す { label, values, count, displayValues } の配列。
  //
  // 表示/非表示の絞り込みは、系列を配列から取り除くのではなく、カードに`is-hidden-series`
  // クラスを付けてdimmed表示にする方式(js/lib/standalone-page-script.js参照)のため、
  // ここには含めない(スケール〈目盛の最大値〉を表示/非表示に関わらず全系列から算出し、
  // チェックのたびにスケールが変動しないようにするための設計)。

  const SORT_MODES = ['original', 'label-asc', 'total-desc', 'total-asc'];

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
    sortSeries,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeriesFilterSort;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.SeriesFilterSort = SeriesFilterSort;
  }
})(typeof window !== 'undefined' ? window : globalThis);
