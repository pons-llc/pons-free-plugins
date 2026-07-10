(function (global, kintone) {
  'use strict';

  const NS = global.RelatedRecordSummary;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);

  // COUNT集計: totalCount:trueだけ取得し、レコード本体は取得しない
  // (「件数だけならtotalCount:trueで取得コストを抑えられる」)。
  const fetchCount = async (relatedAppId, query) => {
    const resp = await kintone.api(recordsUrl(), 'GET', {
      app: relatedAppId,
      query,
      fields: [],
      totalCount: true,
    });
    return Number(resp.totalCount);
  };

  // SUM/AVERAGE集計: 集計対象フィールドの値が必要なため、$idページングで全件取得する。
  const fetchRecordsForAggregation = (relatedAppId, query, targetFieldCode) =>
    NS.PagedFetch.fetchAllPages(query, (pagedQuery) =>
      kintone.api(recordsUrl(), 'GET', {
        app: relatedAppId,
        query: pagedQuery,
        fields: ['$id', targetFieldCode],
      }),
    );

  NS.RelatedRecordClient = { fetchCount, fetchRecordsForAggregation };
})(window, kintone);
