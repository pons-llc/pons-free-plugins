(function (root) {
  'use strict';

  // 全件取得ボタン用の $id 昇順ページングクエリ合成と、対象一覧(view)の解決ロジック。
  //
  // 全件取得方針(CLAUDE.md/plugin_idea_plan.md 共通の前提): offset・カーソルAPIは使わず、
  // $id (レコード番号) 昇順 + limit 500 でページングする。1回目は現在の絞り込み条件のみ、
  // 2回目以降は「$id > 直前取得分の最大$id」を条件に追加する。
  //
  // 対象一覧の解決: GET /k/v1/app/views.json のレスポンスには、ビルトインの「すべて」一覧
  // (ユーザーが作成していないデフォルト一覧)が含まれない。そのため、event.viewId が
  // API取得済み一覧のどれにも一致しない場合は、固定の "ALL" (すべて(デフォルト)) 設定に
  // フォールバックする。

  const PAGE_SIZE = 500;
  const ALL_VIEW_ID = 'ALL';
  const ALL_VIEW_LABEL = 'すべて(デフォルト)';

  const buildFirstPageQuery = (baseCondition) => {
    const cond = (baseCondition || '').trim();
    const prefix = cond ? `${cond} ` : '';
    return `${prefix}order by $id asc limit ${PAGE_SIZE}`;
  };

  const buildNextPageQuery = (baseCondition, lastMaxId) => {
    const cond = (baseCondition || '').trim();
    const idCondition = `$id > ${lastMaxId}`;
    const combined = cond ? `(${cond}) and ${idCondition}` : idCondition;
    return `${combined} order by $id asc limit ${PAGE_SIZE}`;
  };

  // apiViews: GET /k/v1/app/views.json の views オブジェクトを配列化したもの
  // ({id, name, type, ...} の配列)。設定画面の「対象一覧」選択肢を組み立てる。
  const buildSelectableViews = (apiViews) => {
    const listViews = (apiViews || [])
      .filter((view) => view.type === 'LIST')
      .map((view) => ({ id: String(view.id), name: view.name }));
    return [{ id: ALL_VIEW_ID, name: ALL_VIEW_LABEL }, ...listViews];
  };

  // event.viewId (app.record.index.show) と、管理者が設定画面で作成した viewConfigs
  // (各要素は { viewId: 'ALL' | 一覧ID(文字列), ... } )から、適用すべき設定を1件解決する。
  const resolveViewConfig = (eventViewId, viewConfigs, apiViews) => {
    const eventViewIdStr = String(eventViewId);
    const apiViewIds = (apiViews || []).map((view) => String(view.id));
    const matchesKnownView = apiViewIds.includes(eventViewIdStr);
    const effectiveViewId = matchesKnownView ? eventViewIdStr : ALL_VIEW_ID;
    return (
      (viewConfigs || []).find(
        (config) => String(config.viewId) === effectiveViewId,
      ) || null
    );
  };

  const PagingQuery = {
    PAGE_SIZE,
    ALL_VIEW_ID,
    ALL_VIEW_LABEL,
    buildFirstPageQuery,
    buildNextPageQuery,
    buildSelectableViews,
    resolveViewConfig,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PagingQuery;
  } else {
    root.GanttChartView = root.GanttChartView || {};
    root.GanttChartView.PagingQuery = PagingQuery;
  }
})(typeof window !== 'undefined' ? window : globalThis);
