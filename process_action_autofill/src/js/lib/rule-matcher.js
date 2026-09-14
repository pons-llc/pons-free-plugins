(function (root) {
  'use strict';

  // process.proceedイベントの action.value / status.value / nextStatus.value と、
  // ルールのフィルター条件(actionName/fromStatus/toStatus)を照合する純粋関数。
  // フィルターの各項目はnull/undefined/空文字列なら「いずれでも」として扱う(ワイルドカード)。
  // 指定した項目のみをAND条件で一致判定する。
  const isWildcard = (v) => v === undefined || v === null || v === '';

  const matchesFilter = (filter, eventContext) => {
    const f = filter || {};
    const ctx = eventContext || {};
    if (!isWildcard(f.actionName) && f.actionName !== ctx.actionName) {
      return false;
    }
    if (!isWildcard(f.fromStatus) && f.fromStatus !== ctx.fromStatus) {
      return false;
    }
    if (!isWildcard(f.toStatus) && f.toStatus !== ctx.toStatus) {
      return false;
    }
    return true;
  };

  // 設定順のまま、条件に一致したルールだけを返す(date_offset_autofillと同様、複数ルールが
  // 一致した場合は設定順に処理され、同じ対象フィールドへの書き込みは後続ルールが上書きする)。
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
