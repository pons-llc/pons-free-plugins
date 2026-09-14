(function (root) {
  'use strict';

  // フィルター条件は3種類(アクション名/変更前ステータス/変更後ステータス)。それぞれ複数選択でき、
  // 同じ種類の中では「いずれかに一致(OR)」、異なる種類の間では「すべてに一致(AND)」という
  // 一般的な絞り込みUI(ファセット検索)の意味論にしている。空配列/未指定はその種類を判定に
  // 使わない(=いずれでも)。
  const isAnyMatch = (selectedValues, actualValue) => {
    if (!Array.isArray(selectedValues) || selectedValues.length === 0) {
      return true;
    }
    return selectedValues.includes(actualValue);
  };

  const matchesFilter = (filter, eventContext) => {
    const f = filter || {};
    const ctx = eventContext || {};
    if (!isAnyMatch(f.actionNames, ctx.actionName)) {
      return false;
    }
    if (!isAnyMatch(f.fromStatuses, ctx.fromStatus)) {
      return false;
    }
    if (!isAnyMatch(f.toStatuses, ctx.toStatus)) {
      return false;
    }
    return true;
  };

  // 設定順のまま、条件に一致したルールだけを返す(複数ルールが一致した場合は設定順に処理され、
  // 同じ対象フィールドへの書き込みは後続ルールが上書きする)。
  const matchRules = (rules, eventContext) =>
    (rules || []).filter((rule) =>
      matchesFilter(rule && rule.filter, eventContext),
    );

  const RuleMatcher = { matchesFilter, matchRules };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleMatcher;
  } else {
    root.ProcessActionAutofill = root.ProcessActionAutofill || {};
    root.ProcessActionAutofill.RuleMatcher = RuleMatcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
