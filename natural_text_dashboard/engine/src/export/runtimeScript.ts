/**
 * エクスポートHTMLに埋め込む実行時スクリプト（プレーンJS）。
 * ページ内レンダラ(src/render/*)と同じ変換ルール・同じ配色トークンを、
 * ESMではなくグローバル(Chart/L)前提の自己完結スクリプトとして再実装したもの。
 * AI由来の文字列は必ず textContent / DOM要素で挿入し、innerHTML には一切渡さない（P2）。
 */
export const EXPORT_RUNTIME_JS = String.raw`
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("kdm-data").textContent);

  // 配色は render/theme.ts から exportHtml.ts が window.KDM_PALETTE として埋め込んだものを使う
  // （2箇所で手書きするとパレットが食い違う恐れがあるため、ここでは値を持たない）。
  var CATEGORICAL_LIGHT = window.KDM_PALETTE.light;
  var CATEGORICAL_DARK = window.KDM_PALETTE.dark;
  function isDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function seriesColor(i) {
    var p = isDark() ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
    return p[i % p.length];
  }

  function formatNumber(n, opts) {
    if (n === null || n === undefined) return "-";
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : (Number.isInteger(n) ? 0 : 2);
    var rounded = Number(n.toFixed(decimals));
    return rounded.toLocaleString("ja-JP", { maximumFractionDigits: decimals, minimumFractionDigits: decimals > 0 ? decimals : 0 });
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function appendNotes(container, w) {
    if (w.overlapping) container.appendChild(el("div", "kdm-note", "※ 多値項目を含むため、合計はレコード数と一致しません。"));
    if (w.truncated) container.appendChild(el("div", "kdm-note", "※ グループ数が上限を超えたため、上位のみ表示し残りは「その他」に集約しています。"));
  }

  function renderKpi(w) {
    var wrap = document.createElement("div");
    var cell = w.cells[0];
    wrap.appendChild(el("div", "kdm-kpi-value", cell ? formatNumber(cell.measures[0], { thousandSeparator: true }) : "-"));
    wrap.appendChild(el("div", "kdm-note", w.measureLabels[0] || ""));
    return wrap;
  }

  function renderTable(w) {
    var wrap = document.createElement("div");
    if (w.cells.length === 0) {
      wrap.appendChild(el("div", "kdm-empty", "データがありません。"));
      return wrap;
    }
    var table = el("table", "kdm-table");
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    w.rowFieldLabels.forEach(function (label) {
      headRow.appendChild(el("th", null, label));
    });
    w.measureLabels.forEach(function (label) {
      headRow.appendChild(el("th", null, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    w.cells.forEach(function (cell) {
      var tr = document.createElement("tr");
      cell.rowLabel.forEach(function (label) {
        tr.appendChild(el("td", null, label));
      });
      cell.measures.forEach(function (m) {
        tr.appendChild(el("td", null, formatNumber(m, { thousandSeparator: true })));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    appendNotes(wrap, w);
    return wrap;
  }

  function renderCrosstab(w) {
    var wrap = document.createElement("div");
    if (w.cells.length === 0) {
      wrap.appendChild(el("div", "kdm-empty", "データがありません。"));
      return wrap;
    }
    wrap.appendChild(el("div", "kdm-note", w.measureLabels[0] || ""));

    var rowOrder = [], rowLabelOf = {}, colOrder = [], colLabelOf = {}, valueOf = {};
    w.cells.forEach(function (cell) {
      var rk = cell.rowKey.join("␟");
      var ck = cell.colKey.join("␟");
      if (!(rk in rowLabelOf)) { rowOrder.push(rk); rowLabelOf[rk] = cell.rowLabel; }
      if (!(ck in colLabelOf)) { colOrder.push(ck); colLabelOf[ck] = cell.colLabel.join(" / "); }
      valueOf[rk + "|" + ck] = cell.measures[0];
    });

    var table = el("table", "kdm-table");
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    w.rowFieldLabels.forEach(function (label) { headRow.appendChild(el("th", null, label)); });
    colOrder.forEach(function (ck) { headRow.appendChild(el("th", null, colLabelOf[ck])); });
    headRow.appendChild(el("th", null, "総計"));
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    var colTotals = colOrder.map(function () { return 0; });
    var grandTotal = 0;
    rowOrder.forEach(function (rk) {
      var tr = document.createElement("tr");
      rowLabelOf[rk].forEach(function (label) { tr.appendChild(el("td", null, label)); });
      var rowTotal = 0;
      colOrder.forEach(function (ck, i) {
        var v = valueOf[rk + "|" + ck];
        v = v === undefined ? null : v;
        tr.appendChild(el("td", null, formatNumber(v, { thousandSeparator: true })));
        if (v !== null) { rowTotal += v; colTotals[i] += v; }
      });
      tr.appendChild(el("td", null, formatNumber(rowTotal, { thousandSeparator: true })));
      grandTotal += rowTotal;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var tfoot = document.createElement("tfoot");
    var footRow = document.createElement("tr");
    var footLabel = el("td", null, "総計");
    footLabel.colSpan = w.rowFieldLabels.length;
    footRow.appendChild(footLabel);
    colTotals.forEach(function (t) { footRow.appendChild(el("td", null, formatNumber(t, { thousandSeparator: true }))); });
    footRow.appendChild(el("td", null, formatNumber(grandTotal, { thousandSeparator: true })));
    tfoot.appendChild(footRow);
    table.appendChild(tfoot);

    wrap.appendChild(table);
    appendNotes(wrap, w);
    return wrap;
  }

  function buildSeries(w) {
    var rowOrder = [], rowLabelOf = {};
    w.cells.forEach(function (cell) {
      var rk = cell.rowKey.join("␟");
      if (!(rk in rowLabelOf)) { rowOrder.push(rk); rowLabelOf[rk] = cell.rowLabel.join(" / "); }
    });
    var labels = rowOrder.map(function (rk) { return rowLabelOf[rk]; });

    if (w.colFieldLabel) {
      var colOrder = [], colLabelOf = {}, valueOf = {};
      w.cells.forEach(function (cell) {
        var rk = cell.rowKey.join("␟");
        var ck = cell.colKey.join("␟");
        if (!(ck in colLabelOf)) { colOrder.push(ck); colLabelOf[ck] = cell.colLabel.join(" / "); }
        valueOf[rk + "|" + ck] = cell.measures;
      });
      // 列軸ありでも measures は1個とは限らないため、列×指標の組み合わせを別系列にする。
      var datasets = [];
      var seriesIndex = 0;
      colOrder.forEach(function (ck) {
        w.measureLabels.forEach(function (measureLabel, mi) {
          var label = w.measureLabels.length > 1 ? (colLabelOf[ck] + " / " + measureLabel) : colLabelOf[ck];
          datasets.push({
            label: label,
            data: rowOrder.map(function (rk) {
              var m = valueOf[rk + "|" + ck];
              return m && m[mi] !== undefined ? m[mi] : null;
            }),
            backgroundColor: seriesColor(seriesIndex),
            borderColor: seriesColor(seriesIndex),
          });
          seriesIndex++;
        });
      });
      return { labels: labels, datasets: datasets };
    }

    var byRow = {};
    w.cells.forEach(function (cell) { byRow[cell.rowKey.join("␟")] = cell.measures; });
    var datasets2 = w.measureLabels.map(function (label, i) {
      return {
        label: label,
        data: rowOrder.map(function (rk) { var m = byRow[rk]; return m ? (m[i] === undefined ? null : m[i]) : null; }),
        backgroundColor: seriesColor(i),
        borderColor: seriesColor(i),
      };
    });
    return { labels: labels, datasets: datasets2 };
  }

  // 円グラフ用: 各スライスから外側へ引き出し線を伸ばし「ラベル 割合%」を表示するプラグイン。
  // render/renderChart.ts の pieCalloutLabels と同じロジック（プレーンJS移植）。
  var pieCalloutLabels = {
    id: "pieCalloutLabels",
    afterDraw: function (chart) {
      var meta = chart.getDatasetMeta(0);
      var dataset = chart.data.datasets[0];
      if (!dataset) return;
      var values = dataset.data;
      var total = values.reduce(function (s, v) { return s + (v || 0); }, 0);
      if (total <= 0) return;

      var style = getComputedStyle(chart.canvas);
      var textColor = style.getPropertyValue("--kdm-text-primary").trim() || "#0b0b0b";
      var lineColor = style.getPropertyValue("--kdm-muted").trim() || "#898781";

      var ELBOW = 10, STUB = 16, MIN_GAP = 15;
      var rightSide = [], leftSide = [];

      meta.data.forEach(function (el, i) {
        var mid = (el.startAngle + el.endAngle) / 2;
        var cos = Math.cos(mid), sin = Math.sin(mid);
        var edgeX = el.x + el.outerRadius * cos;
        var edgeY = el.y + el.outerRadius * sin;
        var elbowX = el.x + (el.outerRadius + ELBOW) * cos;
        var elbowY = el.y + (el.outerRadius + ELBOW) * sin;
        var isRight = cos >= 0;
        var pct = Math.round((values[i] / total) * 100);
        var label = chart.data.labels[i] || "";
        var item = {
          edgeX: edgeX, edgeY: edgeY, elbowX: elbowX, elbowY: elbowY, y: elbowY,
          isRight: isRight, text: label + " " + pct + "%", color: dataset.backgroundColor[i] || lineColor,
        };
        (isRight ? rightSide : leftSide).push(item);
      });

      function declutter(items) {
        items.sort(function (a, b) { return a.y - b.y; });
        for (var i = 1; i < items.length; i++) {
          if (items[i].y < items[i - 1].y + MIN_GAP) items[i].y = items[i - 1].y + MIN_GAP;
        }
      }
      declutter(rightSide);
      declutter(leftSide);

      var ctx = chart.ctx;
      ctx.save();
      ctx.font = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = lineColor;
      ctx.textBaseline = "middle";

      rightSide.concat(leftSide).forEach(function (item) {
        var stubX = item.elbowX + (item.isRight ? STUB : -STUB);
        ctx.beginPath();
        ctx.moveTo(item.edgeX, item.edgeY);
        ctx.lineTo(item.elbowX, item.elbowY);
        ctx.lineTo(stubX, item.y);
        ctx.stroke();

        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.edgeX, item.edgeY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.textAlign = item.isRight ? "left" : "right";
        ctx.fillText(item.text, stubX + (item.isRight ? 4 : -4), item.y);
      });
      ctx.restore();
    },
  };

  function renderChart(w) {
    var wrap = document.createElement("div");
    if (w.cells.length === 0) {
      wrap.appendChild(el("div", "kdm-empty", "データがありません。"));
      return wrap;
    }
    var canvasWrap = el("div", "kdm-canvas-wrap");
    var canvas = document.createElement("canvas");
    canvasWrap.appendChild(canvas);
    wrap.appendChild(canvasWrap);

    if (w.type === "pie") {
      var series = buildSeries(w);
      var values = series.datasets[0] ? series.datasets[0].data : [];
      var pairs = series.labels.map(function (l, i) { return { label: l, value: values[i] || 0 }; });
      var pieLabels, pieValues;
      if (pairs.length <= 12) {
        pieLabels = pairs.map(function (p) { return p.label; });
        pieValues = pairs.map(function (p) { return p.value; });
      } else {
        var sorted = pairs.slice().sort(function (a, b) { return b.value - a.value; });
        var kept = sorted.slice(0, 11);
        var rest = sorted.slice(11);
        var otherTotal = rest.reduce(function (s, p) { return s + p.value; }, 0);
        pieLabels = kept.map(function (p) { return p.label; }).concat(["その他"]);
        pieValues = kept.map(function (p) { return p.value; }).concat([otherTotal]);
      }
      new Chart(canvas, {
        type: "pie",
        data: { labels: pieLabels, datasets: [{ data: pieValues, backgroundColor: pieLabels.map(function (_, i) { return seriesColor(i); }) }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          radius: "60%",
          plugins: { legend: { display: (w.options && w.options.showLegend) === true } },
        },
        plugins: [pieCalloutLabels],
      });
    } else {
      var s = buildSeries(w);
      var stacked = !!(w.options && w.options.stacked);
      new Chart(canvas, {
        type: w.type,
        data: { labels: s.labels, datasets: s.datasets.map(function (d) { return Object.assign({}, d, { fill: false, stack: stacked ? "stack0" : undefined }); }) },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: (w.options && w.options.showLegend) !== false && s.datasets.length > 1 } },
          scales: { x: { stacked: stacked }, y: { stacked: stacked, beginAtZero: !(w.options && w.options.beginAtZero === false) } },
        },
      });
    }
    appendNotes(wrap, w);
    return wrap;
  }

  var GSI_TILES = {
    pale: { url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", maxZoom: 18 },
    std: { url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", maxZoom: 18 },
    blank: { url: "https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png", maxZoom: 18 },
    seamlessphoto: { url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", maxZoom: 18 },
  };
  var GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';

  function divIcon(color) {
    var svg = '<svg width="20" height="26" viewBox="0 0 20 26" xmlns="http://www.w3.org/2000/svg"><path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 16 10 16s10-8.5 10-16C20 4.48 15.52 0 10 0z" fill="' + color + '" stroke="white" stroke-width="1.5"/><circle cx="10" cy="10" r="3.5" fill="white"/></svg>';
    return L.divIcon({ html: svg, className: "kdm-map-marker", iconSize: [20, 26], iconAnchor: [10, 26], popupAnchor: [0, -24] });
  }

  function renderMap(w) {
    var wrap = document.createElement("div");
    if (!w.points || w.points.length === 0) {
      wrap.appendChild(el("div", "kdm-empty", "表示できる座標がありません（除外 " + (w.excludedCount || 0) + "件）。"));
      return wrap;
    }
    var mapEl = el("div", "kdm-map");
    wrap.appendChild(mapEl);
    var tile = GSI_TILES[(w.options && w.options.mapStyle) || "pale"];
    var map = L.map(mapEl, { attributionControl: true });
    L.tileLayer(tile.url, { maxZoom: tile.maxZoom, attribution: GSI_ATTRIBUTION }).addTo(map);
    var cluster = L.markerClusterGroup();
    var colorKeys = [];
    w.points.forEach(function (p) { if (p.colorKey && colorKeys.indexOf(p.colorKey) === -1) colorKeys.push(p.colorKey); });
    var markers = w.points.map(function (p) {
      var color = seriesColor(p.colorKey ? colorKeys.indexOf(p.colorKey) : 0);
      var marker = L.marker([p.lat, p.lng], { icon: divIcon(color) });
      if (p.label || p.colorKey) {
        var popup = document.createElement("div");
        if (p.label) { var strong = document.createElement("strong"); strong.textContent = p.label; popup.appendChild(strong); }
        if (p.colorKey) popup.appendChild(el("div", null, p.colorKey));
        marker.bindPopup(popup);
      }
      return marker;
    });
    cluster.addLayers(markers);
    map.addLayer(cluster);
    requestAnimationFrame(function () {
      map.invalidateSize();
      map.fitBounds(cluster.getBounds(), { padding: [20, 20] });
    });

    var notes = [];
    if (w.excludedCount) notes.push("※ 座標が不正なため " + w.excludedCount + "件を除外しました。");
    if (w.truncated) notes.push("※ マーカー数が上限を超えたため一部のみ表示しています。");
    if (notes.length) wrap.appendChild(el("div", "kdm-note", notes.join(" ")));
    return wrap;
  }

  function renderWidget(w) {
    var card = el("div", "kdm-widget");
    card.style.gridColumn = (w.position.x + 1) + " / span " + w.position.w;
    card.style.gridRow = (w.position.y + 1) + " / span " + w.position.h;
    card.appendChild(el("h3", null, w.title));
    var body;
    if (w.kind === "error") {
      body = el("div", "kdm-empty", "集計エラーのため表示できません: " + w.message);
    } else if (w.kind === "map") body = renderMap(w);
    else if (w.type === "kpi") body = renderKpi(w);
    else if (w.type === "table") body = renderTable(w);
    else if (w.type === "crosstab") body = renderCrosstab(w);
    else body = renderChart(w);
    card.appendChild(body);
    return card;
  }

  function main() {
    var root = document.getElementById("kdm-root");
    var meta = document.getElementById("kdm-meta");
    meta.appendChild(el("div", null, "アプリ: " + DATA.appName + " / エクスポート日時: " + DATA.exportedAt));
    if (DATA.filters.length) meta.appendChild(el("div", null, "適用フィルタ: " + DATA.filters.join(", ")));
    meta.appendChild(el("div", null, "対象レコード件数: " + (DATA.recordCount != null ? DATA.recordCount : "-") + "件"));
    meta.appendChild(el("div", "kdm-note", "このファイルはスナップショットです。開き直しても更新されません。"));

    var grid = document.getElementById("kdm-grid");
    DATA.widgets.forEach(function (w) {
      grid.appendChild(renderWidget(w));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main);
  else main();
})();
`;
