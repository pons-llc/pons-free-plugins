(function (root) {
  'use strict';

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(タブグループの配列)の構造的な不正を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validateLayouts = (layouts) => {
    const errors = [];

    if (!Array.isArray(layouts)) {
      return { valid: false, errors: ['設定(layouts)が配列ではありません。'] };
    }

    layouts.forEach((layout, index) => {
      const label = `${index + 1}件目`;

      if (!layout || !isNonEmptyString(layout.spaceElementId)) {
        errors.push(
          `${label}: アンカーとなるスペースフィールドが選択されていません。`,
        );
      }

      const tabs = layout && Array.isArray(layout.tabs) ? layout.tabs : [];
      if (tabs.length === 0) {
        errors.push(`${label}: タブが1つも設定されていません。`);
      }
      tabs.forEach((tab, tabIndex) => {
        const tabLabel = `${label}のタブ${tabIndex + 1}件目`;
        if (!tab || !isNonEmptyString(tab.label)) {
          errors.push(`${tabLabel}: タブのラベルが入力されていません。`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateLayouts };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.TabLayout = root.TabLayout || {};
    root.TabLayout.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
