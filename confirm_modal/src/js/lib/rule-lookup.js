(function (root) {
  'use strict';

  // ルールの配列+対象イベントから、設定順で最初に一致するルールを返す(idea.mdの「同じ対象イベントに
  // 複数のルールがある場合」参照)。一致するルールがなければnullを返す。kintoneに依存しない純粋関数。
  const findRule = (rules, triggerEvent) => {
    const list = Array.isArray(rules) ? rules : [];
    const found = list.find((rule) => rule.triggerEvent === triggerEvent);
    return found || null;
  };

  const RuleLookup = { findRule };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleLookup;
  } else {
    root.ConfirmModal = root.ConfirmModal || {};
    root.ConfirmModal.RuleLookup = RuleLookup;
  }
})(typeof window !== 'undefined' ? window : globalThis);
