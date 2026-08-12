(function (root) {
  'use strict';

  // GET /k/v1/app/views.json のレスポンスの`views`(一覧名をキーに持つオブジェクト)から、
  // viewId(文字列) → filterCond(文字列。未設定の一覧は空文字列)のインデックスを作る。
  //
  // 「すべての予算を確認」ボタンは複数の一覧を横断して集計するため、各予算設定行に紐づく一覧の
  // *保存済みの*絞り込み条件が必要になる(現在表示中の画面のライブな絞り込みではない。idea.md参照)。
  const indexFilterCondByViewId = (views) => {
    const index = {};
    Object.values(views || {}).forEach((view) => {
      if (view && view.id !== undefined && view.id !== null) {
        index[String(view.id)] = view.filterCond || '';
      }
    });
    return index;
  };

  const ViewFilterIndex = { indexFilterCondByViewId };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewFilterIndex;
  } else {
    root.BudgetMeter = root.BudgetMeter || {};
    root.BudgetMeter.ViewFilterIndex = ViewFilterIndex;
  }
})(typeof window !== 'undefined' ? window : globalThis);
