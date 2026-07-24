(function (root) {
  'use strict';

  // 全件取得ボタン用の $id 昇順ページングクエリ合成(gantt_chart_viewから流用)。
  //
  // 全件取得方針(CLAUDE.md/plugin_idea_plan.md 共通の前提): offset・カーソルAPIは使わず、
  // $id (レコード番号) 昇順 + limit 500 でページングする。1回目は現在の絞り込み条件のみ、
  // 2回目以降は「$id > 直前取得分の最大$id」を条件に追加する。
  //
  // 本プラグインは一覧(view)ごとの設定を持たない(gantt_chart_viewと異なりアプリ全体で1設定)ため、
  // 対象一覧の解決ロジック(buildSelectableViews/resolveViewConfig)は移植していない。

  const PAGE_SIZE = 500;

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

  const PagingQuery = {
    PAGE_SIZE,
    buildFirstPageQuery,
    buildNextPageQuery,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PagingQuery;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.PagingQuery = PagingQuery;
  }
})(typeof window !== 'undefined' ? window : globalThis);
