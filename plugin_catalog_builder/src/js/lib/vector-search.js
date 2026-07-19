(function (root) {
  'use strict';

  // site/js/ai-search.jsと同じコサイン類似度によるベクトル検索(正規化済みベクトル前提の内積)。
  // モデル呼び出し(CDN読み込み・埋め込み計算)はdesktop.js側が担い、ここではベクトル配列を受け取って
  // スコアリング・上位K件抽出だけを行う純粋ロジックとして切り出し、TDDできるようにする。
  const cosineSimilarity = (a, b) => {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  };

  // entries: [{ corpus, vector }]
  const topKByQuery = (queryVector, entries, k) =>
    entries
      .map(({ corpus, vector }) => ({
        corpus,
        score: cosineSimilarity(queryVector, vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((r) => r.corpus);

  const VectorSearch = { cosineSimilarity, topKByQuery };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VectorSearch;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.VectorSearch = VectorSearch;
  }
})(typeof window !== 'undefined' ? window : globalThis);
