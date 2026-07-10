(function (root) {
  'use strict';

  const ConditionEngine =
    typeof module !== 'undefined' && module.exports
      ? require('./condition-engine')
      : root.ListHighlight.ConditionEngine;

  // レコード+ルールの配列から、設定順で最初に一致したルールを返す(idea.mdの「複数ルールに一致した
  // 場合の優先順位」参照)。一致するルールがなければnullを返す。
  const findMatchingRule = (record, rules) => {
    const list = Array.isArray(rules) ? rules : [];
    const found = list.find((rule) =>
      ConditionEngine.evaluateCondition(record, rule.condition),
    );
    return found || null;
  };

  const RuleMatcher = { findMatchingRule };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleMatcher;
  } else {
    root.ListHighlight = root.ListHighlight || {};
    root.ListHighlight.RuleMatcher = RuleMatcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
