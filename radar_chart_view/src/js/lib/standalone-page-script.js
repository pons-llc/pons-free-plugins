(function (root) {
  'use strict';

  // 生成する単体HTMLファイル(別タブで開くレーダーチャート画面)に埋め込む、完全に静的なJS文字列。
  // このプラグイン自身(desktop.js/config.js)からは実行されず、js/lib/html-template.jsが
  // <script>タグの中身としてそのまま埋め込む。文字列中にレコード値などの動的データは
  // 一切含まない(埋め込まれる動的データは<script type="application/json">側のJSONのみ)。
  //
  // js/lib/radar-geometry.js・radar-stats.js・series-filter-sort.jsと同等のロジックを、
  // 生成先の単体HTMLが他プラグインファイルを読み込めない(自己完結ファイルのため)ことから
  // 独立した静的スクリプトとして再実装している(意図的な重複。上記3ファイルはJestで、
  // こちらはPuppeteer E2Eで検証する。idea.md参照)。

  const STANDALONE_SCRIPT = `(function () {
  'use strict';

  var COLORS = [
    '#3b7ddd', '#e2725b', '#38a169', '#d69e2e', '#805ad5',
    '#dd6b9b', '#319795', '#a0522d',
  ];

  var dataEl = document.getElementById('radar-data');
  var data = JSON.parse(dataEl.textContent);

  var state = {
    aggregationMode: 'sum',
    sortMode: 'original',
    hiddenLabels: {},
  };

  var colorByLabel = {};
  data.series.forEach(function (s, i) {
    colorByLabel[s.label] = COLORS[i % COLORS.length];
  });

  // --- geometry (js/lib/radar-geometry.js と同等) ---
  var TOP_ANGLE = -Math.PI / 2;
  function computeAxisAngles(axisCount) {
    var step = (2 * Math.PI) / axisCount;
    var angles = [];
    for (var i = 0; i < axisCount; i++) {
      angles.push(TOP_ANGLE + step * i);
    }
    return angles;
  }
  function pointAt(angle, radius, center) {
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  }
  function clampRatio(ratio) {
    return Math.min(1, Math.max(0, ratio));
  }
  function computeSeriesPoints(values, maxValue, axisAngles, radius, center) {
    return axisAngles.map(function (angle, i) {
      var value = values[i] || 0;
      var ratio = maxValue > 0 ? clampRatio(value / maxValue) : 0;
      return pointAt(angle, radius * ratio, center);
    });
  }
  function pointsToSvgString(points) {
    return points.map(function (p) { return p.x + ',' + p.y; }).join(' ');
  }
  function computeGridRings(scaleDivisions, axisAngles, radius, center, maxValue) {
    var rings = [];
    for (var i = 0; i < scaleDivisions; i++) {
      var ringIndex = i + 1;
      var ringRadius = (radius * ringIndex) / scaleDivisions;
      rings.push({
        ringIndex: ringIndex,
        tickValue: (maxValue * ringIndex) / scaleDivisions,
        points: axisAngles.map(function (angle) {
          return pointAt(angle, ringRadius, center);
        }),
      });
    }
    return rings;
  }

  // --- stats (js/lib/radar-stats.js と同等) ---
  function toDisplayValues(series, mode) {
    return series.map(function (s) {
      return {
        label: s.label,
        count: s.count,
        values: s.values,
        displayValues:
          mode === 'avg' && s.count > 0
            ? s.values.map(function (v) { return v / s.count; })
            : s.values.slice(),
      };
    });
  }
  function computeMaxValue(seriesWithDisplayValues) {
    var max = 0;
    seriesWithDisplayValues.forEach(function (s) {
      s.displayValues.forEach(function (v) {
        if (v > max) { max = v; }
      });
    });
    return max > 0 ? max : 1;
  }
  function isAggregationToggleRelevant(series) {
    return series.some(function (s) { return s.count > 1; });
  }

  // --- filter/sort (js/lib/series-filter-sort.js と同等) ---
  function filterVisibleSeries(series, hiddenLabels) {
    return series.filter(function (s) { return !hiddenLabels[s.label]; });
  }
  function totalOf(s) {
    return s.displayValues.reduce(function (sum, v) { return sum + v; }, 0);
  }
  function sortSeries(series, sortMode) {
    var list = series.slice();
    if (sortMode === 'label-asc') {
      return list.sort(function (a, b) { return a.label.localeCompare(b.label, 'ja'); });
    }
    if (sortMode === 'total-desc') {
      return list.sort(function (a, b) { return totalOf(b) - totalOf(a); });
    }
    if (sortMode === 'total-asc') {
      return list.sort(function (a, b) { return totalOf(a) - totalOf(b); });
    }
    return list;
  }

  // --- number formatting ---
  function formatNumber(n) {
    var rounded = Math.round(n * 100) / 100;
    return rounded.toLocaleString('ja-JP');
  }

  // --- DOM helpers ---
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }
  function clear(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  var RADIUS = 240;
  var CENTER = { x: 300, y: 300 };
  var LABEL_OFFSET = 26;

  var chartEl = document.getElementById('radar-chart');
  var legendEl = document.getElementById('radar-legend');
  var aggregationControlEl = document.getElementById('aggregation-control');
  var sortSelectEl = document.getElementById('sort-select');
  var statusEl = document.getElementById('radar-status');

  function renderChart(axisAngles, gridRings, seriesToDraw) {
    var svg = svgEl('svg', {
      viewBox: '0 0 600 600',
      width: '100%',
      height: '100%',
    });

    var gridGroup = svgEl('g', { class: 'radar-grid' });
    gridRings.forEach(function (ring) {
      var polygon = svgEl('polygon', {
        points: pointsToSvgString(ring.points),
        fill: 'none',
        stroke: '#c9ccd1',
      });
      gridGroup.appendChild(polygon);

      var tickPoint = pointAt(axisAngles[0], (RADIUS * ring.ringIndex) / gridRings.length, CENTER);
      var tickText = svgEl('text', {
        x: tickPoint.x + 4,
        y: tickPoint.y - 2,
        class: 'radar-tick-label',
      });
      tickText.textContent = formatNumber(ring.tickValue);
      gridGroup.appendChild(tickText);
    });
    svg.appendChild(gridGroup);

    var axisGroup = svgEl('g', { class: 'radar-axes' });
    axisAngles.forEach(function (angle, i) {
      var outer = pointAt(angle, RADIUS, CENTER);
      var line = svgEl('line', {
        x1: CENTER.x, y1: CENTER.y, x2: outer.x, y2: outer.y, stroke: '#c9ccd1',
      });
      axisGroup.appendChild(line);

      var labelPoint = pointAt(angle, RADIUS + LABEL_OFFSET, CENTER);
      var labelText = svgEl('text', {
        x: labelPoint.x,
        y: labelPoint.y,
        class: 'radar-axis-label',
        'text-anchor': 'middle',
      });
      labelText.textContent = data.axisLabels[i].label;
      axisGroup.appendChild(labelText);
    });
    svg.appendChild(axisGroup);

    var seriesGroup = svgEl('g', { class: 'radar-series' });
    seriesToDraw.forEach(function (s) {
      var points = computeSeriesPoints(s.displayValues, gridRings.maxValueUsed, axisAngles, RADIUS, CENTER);
      var color = colorByLabel[s.label] || '#3b7ddd';
      var polygon = svgEl('polygon', {
        points: pointsToSvgString(points),
        fill: color,
        'fill-opacity': '0.15',
        stroke: color,
        'stroke-width': '2',
      });
      seriesGroup.appendChild(polygon);
      points.forEach(function (p) {
        var circle = svgEl('circle', { cx: p.x, cy: p.y, r: 3, fill: color });
        seriesGroup.appendChild(circle);
      });
    });
    svg.appendChild(seriesGroup);

    clear(chartEl);
    chartEl.appendChild(svg);
  }

  function renderLegend(allSeriesWithDisplay) {
    clear(legendEl);
    allSeriesWithDisplay.forEach(function (s) {
      var item = document.createElement('label');
      item.className = 'legend-item';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !state.hiddenLabels[s.label];
      checkbox.addEventListener('change', function () {
        if (checkbox.checked) {
          delete state.hiddenLabels[s.label];
        } else {
          state.hiddenLabels[s.label] = true;
        }
        render();
      });
      item.appendChild(checkbox);

      var swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.backgroundColor = colorByLabel[s.label] || '#3b7ddd';
      item.appendChild(swatch);

      var text = document.createElement('span');
      text.textContent = s.label + '(' + formatNumber(totalOf(s)) + ')';
      item.appendChild(text);

      legendEl.appendChild(item);
    });
  }

  function render() {
    var allWithDisplay = toDisplayValues(data.series, state.aggregationMode);
    var visible = filterVisibleSeries(allWithDisplay, state.hiddenLabels);
    var sorted = sortSeries(visible, state.sortMode);
    var maxValue = computeMaxValue(visible.length ? visible : allWithDisplay);

    var axisAngles = computeAxisAngles(data.axisLabels.length);
    var gridRings = computeGridRings(data.scaleDivisions, axisAngles, RADIUS, CENTER, maxValue);
    gridRings.maxValueUsed = maxValue;

    renderChart(axisAngles, gridRings, sorted);
    renderLegend(allWithDisplay);

    var statusParts = [data.sourceDescription];
    if (data.truncated) {
      statusParts.push('(件数上限に達したため取得を打ち切りました)');
    }
    statusParts.push('生成日時: ' + data.generatedAt);
    statusEl.textContent = statusParts.join(' ');
  }

  if (isAggregationToggleRelevant(data.series)) {
    aggregationControlEl.style.display = '';
    var radios = aggregationControlEl.querySelectorAll('input[name="aggregation"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) {
          state.aggregationMode = radio.value;
          render();
        }
      });
    });
  } else {
    aggregationControlEl.style.display = 'none';
  }

  sortSelectEl.addEventListener('change', function () {
    state.sortMode = sortSelectEl.value;
    render();
  });

  document.title = data.title;
  document.getElementById('radar-title').textContent = data.title;

  render();
})();`;

  const StandalonePageScript = { STANDALONE_SCRIPT };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StandalonePageScript;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.StandalonePageScript = StandalonePageScript;
  }
})(typeof window !== 'undefined' ? window : globalThis);
