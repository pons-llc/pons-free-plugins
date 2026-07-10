(function (root) {
  'use strict';

  // 本文テンプレート文字列+コンテキストオブジェクトから、{key}形式のプレースホルダーを置換した
  // 文字列を返す。未知のキーはそのまま残す(idea.mdの「プロセス管理アクションのプレースホルダー」参照)。
  // kintoneに依存しない純粋関数。
  const renderTemplate = (template, context) => {
    if (!template) {
      return '';
    }
    const ctx = context || {};
    return template.replace(/\{(\w+)\}/g, (match, key) =>
      key in ctx ? String(ctx[key]) : match,
    );
  };

  const Template = { renderTemplate };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Template;
  } else {
    root.ConfirmModal = root.ConfirmModal || {};
    root.ConfirmModal.Template = Template;
  }
})(typeof window !== 'undefined' ? window : globalThis);
