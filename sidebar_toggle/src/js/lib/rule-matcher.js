(function (root) {
  'use strict';

  const ConditionEngine =
    typeof module !== 'undefined' && module.exports
      ? require('./condition-engine')
      : root.SidebarToggle.ConditionEngine;

  // レコード+ルールの配列(常に一致するALWAYS/条件付きMATCHが混在)から、設定順で最初に一致した
  // ルールを返す(idea.mdの「ルールは設定順に評価し、最初に一致したルールの動作を適用する」参照)。
  // 一致するルールがなければnullを返す。
  const findMatchingRule = (record, rules) => {
    const list = Array.isArray(rules) ? rules : [];
    const found = list.find((rule) => {
      if (rule && rule.mode === 'ALWAYS') {
        return true;
      }
      return ConditionEngine.evaluateCondition(record, rule.condition);
    });
    return found || null;
  };

  const RuleMatcher = { findMatchingRule };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleMatcher;
  } else {
    root.SidebarToggle = root.SidebarToggle || {};
    root.SidebarToggle.RuleMatcher = RuleMatcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
