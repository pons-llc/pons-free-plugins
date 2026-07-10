(function (global, kintone) {
  'use strict';

  // 全件取得ボタン用: $id昇順ページング(js/lib/paging-query.jsのクエリ合成)で
  // GET /k/v1/records.json を500件ずつ呼び出し、maxRecordsに達するか取得件数が
  // 500件未満(=最終ページ)になるまで繰り返す。offset・カーソルAPIは使わない
  // (plugin_idea_plan.md 共通の全件取得方針)。

  const NS = global.GanttChartView;
  const PagingQuery = NS.PagingQuery;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);

  const fetchPage = (appId, query) =>
    kintone
      .api(recordsUrl(), 'GET', { app: appId, query })
      .then((resp) => resp.records);

  // baseCondition: kintone.app.getQueryCondition() の戻り値(絞り込み条件のみ。order by/limit/offsetは含まない)
  // maxRecords: 取得上限件数(設定画面で管理者が指定)。上限に達した場合は truncated: true を返す。
  const fetchAll = async (appId, baseCondition, maxRecords) => {
    const records = [];
    let query = PagingQuery.buildFirstPageQuery(baseCondition);
    let truncated = false;

    for (;;) {
      const page = await fetchPage(appId, query);
      records.push(...page);

      const isLastPage = page.length < PagingQuery.PAGE_SIZE;

      if (records.length >= maxRecords) {
        truncated = records.length > maxRecords || !isLastPage;
        break;
      }
      if (isLastPage) {
        break;
      }

      const lastMaxId = Number(page[page.length - 1].$id.value);
      query = PagingQuery.buildNextPageQuery(baseCondition, lastMaxId);
    }

    if (records.length > maxRecords) {
      records.length = maxRecords;
    }

    return { records, truncated };
  };

  const FullFetch = { fetchAll };

  global.GanttChartView = global.GanttChartView || {};
  global.GanttChartView.FullFetch = FullFetch;
})(window, kintone);
