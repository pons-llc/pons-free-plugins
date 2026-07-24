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
    .radar-controls-bar {
      display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
      margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e3e7e8;
    }
    .radar-controls-bar label { font-size: 0.9rem; }
    #radar-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .radar-card {
      display: flex; flex-direction: column; gap: 8px;
      border: 1px solid #e3e7e8; border-radius: 8px; padding: 12px;
      transition: opacity 0.15s ease;
    }
    .radar-card.is-hidden-series { opacity: 0.35; }
    .radar-card-header { display: flex; align-items: flex-start; gap: 8px; }
    .radar-card-header input[type="checkbox"] { margin-top: 4px; flex-shrink: 0; }
    .radar-card-title-area { min-width: 0; }
    .radar-card-title { font-weight: bold; font-size: 0.9rem; word-break: break-word; }
    .radar-card-badges { display: flex; flex-wrap: wrap; gap: 4px; }
    .radar-badge-chip {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      background: #eef1f2; font-size: 0.75rem; white-space: nowrap;
    }
    .radar-card-chart { width: 100%; }
    .radar-card-chart svg { width: 100%; height: auto; display: block; }
    .radar-card-total { font-size: 0.8rem; color: #57606a; }
    .radar-axis-label { font-size: 10px; fill: #1f2328; }
    @media (prefers-color-scheme: dark) {
      body { background: #16191d; color: #e6e8ea; }
      #radar-status { color: #9aa4ad; }
      .radar-controls-bar { border-bottom-color: #3a3f45; }
      .radar-card { border-color: #3a3f45; }
      .radar-badge-chip { background: #262b31; }
      .radar-card-total { color: #9aa4ad; }
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
<div class="radar-controls-bar">
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
</div>
<div id="radar-card-grid"></div>
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
