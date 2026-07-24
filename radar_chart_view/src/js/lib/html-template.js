(function (root) {
  'use strict';

  // 別タブに開く自己完結HTMLファイルの組み立て。
  //
  // セキュリティ方針(idea.md/security-checklist.md参照): HTMLの外殻(このファイルが返す文字列の
  // うち、動的データ以外の部分)は完全に固定文字列で、レコード由来の値を一切含まない。
  // 動的データは<script type="application/json" id="radar-data">の中に1箇所だけJSON文字列として
  // 埋め込む。JSON.stringify()は"</"をエスケープしないため、"</script>"によるタグ脱出を防ぐために
  // "</"を"<\/"に置換してから埋め込む。埋め込んだJSONは、js/lib/standalone-page-script.jsの
  // 静的スクリプトがJSON.parse()した上でDOM API(textContent/createElementNS)のみで描画する。

  const StandalonePageScript =
    typeof module !== 'undefined' && module.exports
      ? require('./standalone-page-script')
      : root.RadarChartView.StandalonePageScript;

  const escapeScriptClose = (json) => json.replace(/<\//g, '<\\/');

  const STATIC_CSS = `
    :root { color-scheme: light dark; }
    body {
      font-family: -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1f2328;
      background: #fff;
    }
    h1 { font-size: 1.4rem; margin: 0 0 4px; }
    #radar-status { color: #57606a; font-size: 0.85rem; margin-bottom: 16px; }
    .radar-layout { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
    #radar-chart { flex: 0 0 auto; width: 600px; max-width: 100%; }
    #radar-chart svg { width: 100%; height: auto; }
    .radar-tick-label { font-size: 10px; fill: #57606a; }
    .radar-axis-label { font-size: 13px; fill: #1f2328; }
    .radar-controls { display: flex; flex-direction: column; gap: 12px; min-width: 220px; }
    .radar-controls label { font-size: 0.9rem; }
    #radar-legend { display: flex; flex-direction: column; gap: 6px; max-height: 480px; overflow-y: auto; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer; }
    .legend-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
    @media (prefers-color-scheme: dark) {
      body { background: #16191d; color: #e6e8ea; }
      #radar-status { color: #9aa4ad; }
      .radar-tick-label { fill: #9aa4ad; }
      .radar-axis-label { fill: #e6e8ea; }
      .radar-grid polygon { stroke: #3a3f45; }
      .radar-axes line { stroke: #3a3f45; }
    }
  `;

  // payload: {
  //   title, axisLabels: [{code,label}], scaleDivisions,
  //   series: [{label, count, values}], sourceDescription, truncated, generatedAt,
  // }
  const buildRadarHtmlDocument = (payload) => {
    const json = escapeScriptClose(JSON.stringify(payload));

    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>レーダーチャート</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${STATIC_CSS}</style>
</head>
<body>
<h1 id="radar-title"></h1>
<div id="radar-status"></div>
<div class="radar-layout">
  <div id="radar-chart"></div>
  <div class="radar-controls">
    <div id="aggregation-control">
      <label><input type="radio" name="aggregation" value="sum" checked> 合計</label>
      <label><input type="radio" name="aggregation" value="avg"> 平均</label>
    </div>
    <label>並べ替え
      <select id="sort-select">
        <option value="original">元の順序</option>
        <option value="label-asc">ラベル昇順</option>
        <option value="total-desc">合計値(降順)</option>
        <option value="total-asc">合計値(昇順)</option>
      </select>
    </label>
    <div id="radar-legend"></div>
  </div>
</div>
<script type="application/json" id="radar-data">${json}</script>
<script>${StandalonePageScript.STANDALONE_SCRIPT}</script>
</body>
</html>`;
  };

  const HtmlTemplate = { buildRadarHtmlDocument, escapeScriptClose };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HtmlTemplate;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.HtmlTemplate = HtmlTemplate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
