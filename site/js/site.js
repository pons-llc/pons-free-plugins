// 共有クライアントJS。ヘッダーのハンバーガーメニュー、トップページのカテゴリ/タグ/キーワード絞り込み、
// プラグイン個別ページのアコーディオン開閉を担当する。サーバー通信は行わない
// (すべて各ページに埋め込まれた静的データの上で完結する)。

(function () {
  "use strict";

  function initHeaderMenu() {
    const toggle = document.getElementById("header-menu-toggle");
    const menu = document.getElementById("header-menu");
    if (!toggle || !menu) return;

    const close = () => {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", (e) => {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== toggle) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // トップページのキーワード検索/カテゴリ/タグ絞り込み。カテゴリは単一選択、タグは複数選択でOR一致
  // (選択タグのいずれかを持つカードを表示)、キーワードはプラグイン名・説明・タグを連結した
  // data-search に対する部分一致(AND: 他の絞り込み条件とはすべて満たす必要がある)。
  function initFilters() {
    const filterBar = document.querySelector(".filter-bar");
    if (!filterBar) return;

    const cards = Array.from(document.querySelectorAll(".plugin-card"));
    const emptyState = document.querySelector(".empty-state");
    const searchInput = filterBar.querySelector(".search-input");
    const categoryChips = Array.from(filterBar.querySelectorAll(".chip[data-category]"));
    const tagChips = Array.from(filterBar.querySelectorAll(".chip[data-tag]"));

    let activeCategory = "all";
    const activeTags = new Set();

    function applyFilter() {
      const keyword = (searchInput?.value || "").trim().toLowerCase();
      let visibleCount = 0;
      cards.forEach((card) => {
        const category = card.getAttribute("data-category");
        const tags = (card.getAttribute("data-tags") || "").split(",").filter(Boolean);
        const search = card.getAttribute("data-search") || "";
        const categoryMatch = activeCategory === "all" || category === activeCategory;
        const tagMatch = activeTags.size === 0 || tags.some((t) => activeTags.has(t));
        const keywordMatch = keyword === "" || search.includes(keyword);
        const visible = categoryMatch && tagMatch && keywordMatch;
        card.classList.toggle("is-hidden", !visible);
        if (visible) visibleCount += 1;
      });
      if (emptyState) {
        emptyState.classList.toggle("is-hidden", visibleCount > 0);
      }
    }

    if (searchInput) {
      searchInput.addEventListener("input", applyFilter);
    }

    categoryChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        activeCategory = chip.getAttribute("data-category");
        categoryChips.forEach((c) => c.classList.toggle("is-active", c === chip));
        applyFilter();
      });
    });

    tagChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const tag = chip.getAttribute("data-tag");
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
          chip.classList.remove("is-active");
        } else {
          activeTags.add(tag);
          chip.classList.add("is-active");
        }
        applyFilter();
      });
    });
  }

  // プラグイン個別ページ: ユースケース・セキュリティレビューサマリ等のアコーディオン開閉。
  function initAccordions() {
    document.querySelectorAll(".accordion-header").forEach((header) => {
      header.addEventListener("click", () => {
        const panelId = header.getAttribute("aria-controls");
        const panel = panelId ? document.getElementById(panelId) : null;
        if (!panel) return;
        const expanded = header.getAttribute("aria-expanded") === "true";
        header.setAttribute("aria-expanded", String(!expanded));
        panel.hidden = expanded;
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHeaderMenu();
    initFilters();
    initAccordions();
  });
})();
