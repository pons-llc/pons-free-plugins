(function (root) {
  'use strict';

  // event.viewId(一覧ID)と設定配列から、対象の一覧設定を引き当てる。
  // REST API(GET /k/v1/app/views.json)を使わない方針のため、gantt_chart_viewのように
  // API取得済み一覧リストとの突き合わせは行わない。event.viewId をそのまま文字列化して
  // viewConfigs[].viewId と一致するものを探し、一致しなければ 'ALL'(すべて)設定にフォールバックする。

  const resolveViewConfig = (viewId, viewConfigs) => {
    const idStr =
      viewId === null || viewId === undefined ? 'ALL' : String(viewId);
    const list = viewConfigs || [];
    const exact = list.find((c) => c.viewId === idStr);
    if (exact) {
      return exact;
    }
    return list.find((c) => c.viewId === 'ALL') || null;
  };

  const ViewResolution = { resolveViewConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewResolution;
  } else {
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.ViewResolution = ViewResolution;
  }
})(typeof window !== 'undefined' ? window : globalThis);
