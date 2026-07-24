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
  //
  // 表示形式: 系列(レコードまたはグループ)ごとに、小さなレーダーチャートを1枚のカードとして
  // グリッド状に並べる(カード形式)。バッジ(config.badgeFieldCodesの値)は各カードの見出しに
  // チップとして表示し、頂点や凡例の1行に詰め込んだラベルにはしない。

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
        badges: s.badges || [],
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

  // --- sort (js/lib/series-filter-sort.js と同等) ---
  // 表示/非表示はカードの絞り込み(is-hidden-seriesクラスでdimmedにする)で行うため、
  // series-filter-sort.jsのfilterVisibleSeries相当のロジック(配列から取り除く方式)は
  // ここでは使わない。全カードのスケール(目盛の最大値)も表示/非表示を問わず全系列から
  // 計算し、チェックのたびにスケールが変動して見た目のサイズ感が不安定にならないようにしている。
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

  // カード内の小さいレーダーチャート用のジオメトリ定数。
  var CARD_RADIUS = 85;
  var CARD_CENTER = { x: 130, y: 130 };
  var CARD_LABEL_OFFSET = 25;
  var CARD_VIEWBOX = '0 0 260 260';

  var gridEl = document.getElementById('radar-card-grid');
  var aggregationControlEl = document.getElementById('aggregation-control');
  var sortSelectEl = document.getElementById('sort-select');
  var statusEl = document.getElementById('radar-status');

  function buildCardSvg(s, axisAngles, gridRings, maxValue) {
    var svg = svgEl('svg', { viewBox: CARD_VIEWBOX });
    var color = colorByLabel[s.label] || '#3b7ddd';

    var gridGroup = svgEl('g', { class: 'radar-grid' });
    gridRings.forEach(function (ring) {
      gridGroup.appendChild(svgEl('polygon', {
        points: pointsToSvgString(ring.points),
        fill: 'none',
        stroke: '#c9ccd1',
      }));
    });
    svg.appendChild(gridGroup);

    var axisGroup = svgEl('g', { class: 'radar-axes' });
    axisAngles.forEach(function (angle, i) {
      var outer = pointAt(angle, CARD_RADIUS, CARD_CENTER);
      axisGroup.appendChild(svgEl('line', {
        x1: CARD_CENTER.x, y1: CARD_CENTER.y, x2: outer.x, y2: outer.y, stroke: '#c9ccd1',
      }));

      var labelPoint = pointAt(angle, CARD_RADIUS + CARD_LABEL_OFFSET, CARD_CENTER);
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

    var points = computeSeriesPoints(s.displayValues, maxValue, axisAngles, CARD_RADIUS, CARD_CENTER);
    var seriesGroup = svgEl('g', { class: 'radar-series' });
    seriesGroup.appendChild(svgEl('polygon', {
      points: pointsToSvgString(points),
      fill: color,
      'fill-opacity': '0.2',
      stroke: color,
      'stroke-width': '2',
    }));
    points.forEach(function (p) {
      seriesGroup.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 2.5, fill: color }));
    });
    svg.appendChild(seriesGroup);

    return svg;
  }

  // バッジ(config.badgeFieldCodesの値)はチャート〈カード〉自体に付ける情報であり、
  // 頂点や凡例の1行に押し込めたラベルではない、というidea.mdの方針をカードのヘッダー
  // (バッジチップの並び)として実装する。バッジが無いレコード、またはフィールドごと
  // グルーピング(badgesは常に空)のときは、素のテキスト見出し(s.label)にフォールバックする。
  function buildCardHeader(s) {
    var header = document.createElement('div');
    header.className = 'radar-card-header';

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
    header.appendChild(checkbox);

    var titleArea = document.createElement('div');
    titleArea.className = 'radar-card-title-area';

    if (s.badges && s.badges.length > 0) {
      var badgesEl = document.createElement('div');
      badgesEl.className = 'radar-card-badges';
      s.badges.forEach(function (badge) {
        var chip = document.createElement('span');
        chip.className = 'radar-badge-chip';
        chip.textContent = badge;
        badgesEl.appendChild(chip);
      });
      titleArea.appendChild(badgesEl);
    } else {
      var title = document.createElement('div');
      title.className = 'radar-card-title';
      title.textContent = s.label;
      titleArea.appendChild(title);
    }

    header.appendChild(titleArea);
    return header;
  }

  function buildCard(s, axisAngles, gridRings, maxValue) {
    var card = document.createElement('div');
    card.className = 'radar-card';
    if (state.hiddenLabels[s.label]) {
      card.classList.add('is-hidden-series');
    }

    card.appendChild(buildCardHeader(s));

    var chartWrap = document.createElement('div');
    chartWrap.className = 'radar-card-chart';
    chartWrap.appendChild(buildCardSvg(s, axisAngles, gridRings, maxValue));
    card.appendChild(chartWrap);

    var total = document.createElement('div');
    total.className = 'radar-card-total';
    total.textContent =
      (state.aggregationMode === 'avg' ? '平均: ' : '合計: ') + formatNumber(totalOf(s));
    card.appendChild(total);

    return card;
  }

  // 目盛の最大値(スケール)はチェックボックスでの表示/非表示に関わらず全系列から算出する。
  // 絞り込みのたびにスケールが変わってカードの見た目のサイズ感が不安定になるのを防ぐため。
  function render() {
    var allWithDisplay = toDisplayValues(data.series, state.aggregationMode);
    var maxValue = computeMaxValue(allWithDisplay);
    var axisAngles = computeAxisAngles(data.axisLabels.length);
    var gridRings = computeGridRings(data.scaleDivisions, axisAngles, CARD_RADIUS, CARD_CENTER, maxValue);
    var ordered = sortSeries(allWithDisplay, state.sortMode);

    clear(gridEl);
    ordered.forEach(function (s) {
      gridEl.appendChild(buildCard(s, axisAngles, gridRings, maxValue));
    });

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
