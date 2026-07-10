// AI検索(トップページのみ)。完全フロントエンドでベクトル検索する: multilingual-e5-smallを
// ブラウザ上にダウンロードし、モデルのロードもコーパス(公開プラグイン一覧)の埋め込み計算も検索処理も
// すべてブラウザ内で完結させる(サーバー通信はモデル取得先のCDN以外へは一切行わない)。
// コーパスはindex.htmlがwindow.__PLUGIN_CORPUS__として埋め込んだ静的データを使う。
// ~/Documents/govapps/site/ai-search.js と同じ方式(コーパスの型のみプラグイン向けに変更)。

(function () {
  "use strict";

  const MODEL_ID = "Xenova/multilingual-e5-small";
  const TRANSFORMERS_CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm";
  const MODEL_CACHE_KEY = "govapps_plugin_ai_search_model_cached_at";
  const MODEL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const TOP_K = 15;

  let extractorPromise = null;
  let corpusEmbeddingsPromise = null;

  function isModelCacheFresh() {
    let raw = null;
    try {
      raw = localStorage.getItem(MODEL_CACHE_KEY);
    } catch (_) {
      return false;
    }
    const cachedAt = Number(raw);
    return Number.isFinite(cachedAt) && Date.now() - cachedAt < MODEL_CACHE_TTL_MS;
  }

  function markModelCached() {
    try {
      localStorage.setItem(MODEL_CACHE_KEY, String(Date.now()));
    } catch (_) {
      /* localStorageが使えない環境ではUI上の確認省略だけ諦める */
    }
  }

  function cosineSimilarity(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

  async function loadExtractor(onProgress) {
    if (extractorPromise) return extractorPromise;
    extractorPromise = (async () => {
      const { pipeline } = await import(TRANSFORMERS_CDN_URL);
      const extractor = await pipeline("feature-extraction", MODEL_ID, {
        dtype: "q8",
        progress_callback: (data) => {
          if (onProgress && typeof data.progress === "number") onProgress(data.progress);
        },
      });
      markModelCached();
      return extractor;
    })();
    return extractorPromise;
  }

  async function getCorpusEmbeddings(extractor) {
    if (corpusEmbeddingsPromise) return corpusEmbeddingsPromise;
    corpusEmbeddingsPromise = (async () => {
      const corpus = window.__PLUGIN_CORPUS__ || [];
      const texts = corpus.map((p) => `passage: ${p.text}`);
      const output = await extractor(texts, { pooling: "mean", normalize: true });
      const vectors = output.tolist();
      return corpus.map((p, i) => ({ plugin: p, vector: vectors[i] }));
    })();
    return corpusEmbeddingsPromise;
  }

  async function search(query) {
    const extractor = await loadExtractor();
    const [entries, queryOutput] = await Promise.all([
      getCorpusEmbeddings(extractor),
      extractor([`query: ${query}`], { pooling: "mean", normalize: true }),
    ]);
    const queryVector = queryOutput.tolist()[0];
    return entries
      .map(({ plugin, vector }) => ({ plugin, score: cosineSimilarity(queryVector, vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K)
      .map((r) => r.plugin);
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  function renderResults(plugins) {
    if (plugins.length === 0) {
      return '<p class="ai-search-empty">該当するプラグインが見つかりませんでした。</p>';
    }
    const items = plugins
      .map(
        (p) => `<a class="ai-search-result-item" href="plugins/${esc(p.key)}/index.html">
      <div class="plugin-name">${esc(p.name)}</div>
      <div class="plugin-desc">${esc(p.description)}</div>
      <div>${(p.tags || []).map((t) => `<span class="badge badge-tag">#${esc(t)}</span>`).join("")}</div>
    </a>`,
      )
      .join("\n");
    return `<div class="ai-search-results">${items}</div>`;
  }

  function initAiSearch() {
    const openBtn = document.getElementById("ai-search-open");
    const overlay = document.getElementById("ai-search-overlay");
    const closeBtn = document.getElementById("ai-search-close");
    const body = document.getElementById("ai-search-body");
    if (!openBtn || !overlay || !body) return;

    const defaultBodyHtml = body.innerHTML;
    let started = false;

    function renderLoadingView() {
      body.innerHTML = `<p>検索モデルを読み込んでいます…初回は数十秒〜数分かかることがあります。</p>
        <div class="ai-search-progress-track"><div class="ai-search-progress-bar" id="ai-search-progress-bar"></div></div>`;
    }

    function updateProgress(percent) {
      const bar = document.getElementById("ai-search-progress-bar");
      if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent)).toFixed(0)}%`;
    }

    function renderSearchView() {
      body.innerHTML = `<div class="ai-search-form-row">
          <input type="search" class="search-input ai-search-query-input" id="ai-search-query" placeholder="例: 日付を和暦にしたい">
          <button type="button" class="kintoneplugin-button-normal" id="ai-search-submit">検索</button>
        </div>
        <div id="ai-search-result-area"></div>`;

      const input = document.getElementById("ai-search-query");
      const submitBtn = document.getElementById("ai-search-submit");
      const resultArea = document.getElementById("ai-search-result-area");

      async function runSearch() {
        const q = input.value.trim();
        if (!q) return;
        resultArea.innerHTML = '<p class="ai-search-loading">検索中…</p>';
        try {
          const results = await search(q);
          resultArea.innerHTML = renderResults(results);
        } catch (err) {
          resultArea.innerHTML = `<p class="ai-search-error">検索に失敗しました: ${esc(err.message)}</p>`;
        }
      }

      submitBtn.addEventListener("click", runSearch);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") runSearch();
      });
      input.focus();
    }

    function renderErrorView(message) {
      body.innerHTML = `<p class="ai-search-error">${esc(message)}</p>
        <div class="ai-search-consent">
          <button type="button" class="kintoneplugin-button-normal" id="ai-search-retry-btn">再試行</button>
        </div>`;
      document.getElementById("ai-search-retry-btn")?.addEventListener("click", startFlow);
    }

    async function startFlow() {
      renderLoadingView();
      try {
        await loadExtractor(updateProgress);
        renderSearchView();
      } catch (err) {
        renderErrorView(`AI検索の読み込みに失敗しました。通信環境をご確認のうえ再度お試しください。(${err.message})`);
      }
    }

    function attachConsentHandler() {
      document.getElementById("ai-search-consent-ok")?.addEventListener(
        "click",
        () => {
          startFlow();
        },
        { once: true },
      );
    }

    function openModal() {
      overlay.hidden = false;
      if (!started && isModelCacheFresh()) {
        started = true;
        startFlow();
      } else if (!started) {
        started = true;
        body.innerHTML = defaultBodyHtml;
        attachConsentHandler();
      }
    }

    function closeModal() {
      overlay.hidden = true;
    }

    openBtn.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) closeModal();
    });
  }

  document.addEventListener("DOMContentLoaded", initAiSearch);
})();
