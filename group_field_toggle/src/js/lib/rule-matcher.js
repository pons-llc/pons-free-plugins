(function (root) {
  'use strict';

  const ConditionEngine =
    typeof module !== 'undefined' && module.exports
      ? require('./condition-engine')
      : root.GroupFieldToggle.ConditionEngine;

  // レコード+ルールの配列(常に一致するALWAYS/条件付きMATCHが混在)+対象グループフィールドコードから、
  // その対象フィールドを持つルールに絞り込んだうえで、設定順で最初に一致したルールを返す
  // (idea.mdの「ルールは設定順に評価し、最初に一致したルールの動作を適用する」参照。
  // sidebar_toggleとの違いは対象フィールドによる絞り込みが増える点)。
  // 一致するルールがなければnullを返す。
  const findMatchingRule = (record, rules, targetFieldCode) => {
    const list = Array.isArray(rules) ? rules : [];
    const found = list
      .filter((rule) => rule && rule.targetFieldCode === targetFieldCode)
      .find((rule) => {
        if (rule.mode === 'ALWAYS') {
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
    root.GroupFieldToggle = root.GroupFieldToggle || {};
    root.GroupFieldToggle.RuleMatcher = RuleMatcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
