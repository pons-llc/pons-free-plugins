(function (root) {
  'use strict';

  // レーダーチャートの頂点角度・座標・同心グリッド(目盛)座標を計算する純粋な三角関数ロジック。
  // 3〜8角形に対応する。角度は真上(-90度)を起点に時計回りに均等配置する。

  const TOP_ANGLE = -Math.PI / 2;

  // axisCount: 軸数(3〜8)。戻り値は真上から時計回りのラジアン角度の配列。
  const computeAxisAngles = (axisCount) => {
    const step = (2 * Math.PI) / axisCount;
    return Array.from({ length: axisCount }, (_, i) => TOP_ANGLE + step * i);
  };

  // center: { x, y }。angleはラジアン、radiusは中心からの距離。
  const pointAt = (angle, radius, center) => ({
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  });

  const clampRatio = (ratio) => Math.min(1, Math.max(0, ratio));

  // values: 軸の順番に対応した数値配列。maxValueが0以下の場合は全軸0(中心)として扱う。
  const computeSeriesPoints = (values, maxValue, axisAngles, radius, center) =>
    axisAngles.map((angle, i) => {
      const value = values[i] || 0;
      const ratio = maxValue > 0 ? clampRatio(value / maxValue) : 0;
      return pointAt(angle, radius * ratio, center);
    });

  const pointsToSvgString = (points) =>
    points.map((p) => `${p.x},${p.y}`).join(' ');

  // scaleDivisions: 目盛(同心多角形)の分割数。内側から外側へ scaleDivisions 個のリングを返す。
  // 戻り値の各要素は { ringIndex(1始まり), tickValue, points } で、tickValue は
  // maxValue * ringIndex / scaleDivisions。
  const computeGridRings = (
    scaleDivisions,
    axisAngles,
    radius,
    center,
    maxValue,
  ) =>
    Array.from({ length: scaleDivisions }, (_, i) => {
      const ringIndex = i + 1;
      const ringRadius = (radius * ringIndex) / scaleDivisions;
      return {
        ringIndex,
        tickValue: (maxValue * ringIndex) / scaleDivisions,
        points: axisAngles.map((angle) => pointAt(angle, ringRadius, center)),
      };
    });

  const RadarGeometry = {
    computeAxisAngles,
    pointAt,
    computeSeriesPoints,
    pointsToSvgString,
    computeGridRings,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RadarGeometry;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.RadarGeometry = RadarGeometry;
  }
})(typeof window !== 'undefined' ? window : globalThis);
