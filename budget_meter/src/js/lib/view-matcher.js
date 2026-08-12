(function (root) {
  'use strict';

  // 予算設定行の配列から、現在表示中の一覧(viewId)に対応する行を抽出する。
  //
  // REST `views.json` のviewIdは文字列で返るが、`app.record.index.show`イベントの
  // `event.viewId`は数値で渡される。型が揃っていない前提で、常に文字列に正規化して比較する。
  const matchRowsForView = (rows, viewId) => {
    if (viewId === null || viewId === undefined) {
      return [];
    }
    const target = String(viewId);
    return (rows || []).filter((row) => String(row.viewId) === target);
  };

  const ViewMatcher = { matchRowsForView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewMatcher;
  } else {
    root.BudgetMeter = root.BudgetMeter || {};
    root.BudgetMeter.ViewMatcher = ViewMatcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
