(function (root) {
  'use strict';

  // 系列(js/lib/series-builder.jsが組み立てた { label, values, count } の配列)を、
  // 「合計」または「平均」表示用の値に変換する。フィールドごとグルーピング(count > 1が起こりうる)
  // でのみ意味を持つ切り替えで、レコードごとグルーピング(常にcount === 1)ではsum === avgになる。

  const AGGREGATION_MODES = ['sum', 'avg'];

  const toDisplayValues = (series, mode) =>
    (series || []).map((s) => ({
      label: s.label,
      count: s.count,
      values: s.values,
      displayValues:
        mode === 'avg' && s.count > 0
          ? s.values.map((v) => v / s.count)
          : s.values.slice(),
    }));

  // 目盛の最大値決定に使う、現在表示中の系列全体でのdisplayValuesの最大値。
  // 系列が空、またはすべて0の場合は1を返し、0除算(目盛が全て0になる)を避ける。
  const computeMaxValue = (seriesWithDisplayValues) => {
    let max = 0;
    (seriesWithDisplayValues || []).forEach((s) => {
      s.displayValues.forEach((v) => {
        if (v > max) {
          max = v;
        }
      });
    });
    return max > 0 ? max : 1;
  };

  // グルーピングが「フィールドごと」で、いずれかの系列がcount > 1を持つ場合のみ
  // 合計/平均トグルを意味のあるものとして表示する。
  const isAggregationToggleRelevant = (series) =>
    (series || []).some((s) => s.count > 1);

  const RadarStats = {
    AGGREGATION_MODES,
    toDisplayValues,
    computeMaxValue,
    isAggregationToggleRelevant,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RadarStats;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.RadarStats = RadarStats;
  }
})(typeof window !== 'undefined' ? window : globalThis);
