(function (global, kintone) {
  'use strict';

  // 取得元アプリ(別アプリ)からのレコード取得。別アプリのレコード読み書きにJS APIは存在しないため、
  // REST APIを`kintone.api()`(内部向けラッパー、生のfetch/XHRは使わない)経由で呼び出す
  // (共通の前提・訂正事項、CLAUDE.md開発方針3)。
  // ページングは$id昇順(共通の前提・訂正事項の全件取得方針)で、offset・カーソルAPIは使わない。

  const NS = global.RecordsToSubtable;
  const PAGE_SIZE = NS.IdPaging.DEFAULT_PAGE_SIZE;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const formFieldsUrl = () =>
    kintone.api.url('/k/v1/app/form/fields.json', true);

  const fetchFormFields = (appId) =>
    kintone.api(formFieldsUrl(), 'GET', { app: appId });

  // 1ページ分($idページングの1回分)を取得する。
  const fetchPage = (appId, pagedQuery, fields) =>
    kintone.api(recordsUrl(), 'GET', { app: appId, query: pagedQuery, fields });

  // baseQuery(検索条件から合成したクエリ、order by等は含まない)を元に、
  // $id昇順ページングで上限件数(+1ページ分、打ち切り検知のため)まで取得する。
  // sourceFieldCodesは取得元レコードの必要フィールド(フィールドマッピングのsourceFieldCode一覧)。
  const fetchAllRecords = async (
    appId,
    baseQuery,
    sourceFieldCodes,
    maxRecords,
  ) => {
    // $idは自レコードへの取り込み後もページング判定に使うため、明示的にfieldsへ含める。
    const fields = Array.from(new Set(['$id', ...(sourceFieldCodes || [])]));
    let lastMaxId = null;
    let all = [];

    for (;;) {
      const pagedQuery = NS.IdPaging.buildPagedQuery(
        baseQuery,
        lastMaxId,
        PAGE_SIZE,
      );

      const resp = await fetchPage(appId, pagedQuery, fields);
      all = all.concat(resp.records);

      const last = NS.IdPaging.isLastPage(resp.records, PAGE_SIZE);
      if (last) {
        break;
      }
      if (NS.LimitGuard.hasReachedLimit(all.length, maxRecords)) {
        break;
      }
      lastMaxId = NS.IdPaging.nextMaxId(resp.records);
    }

    return all;
  };

  NS.RecordsClient = { fetchAllRecords, fetchFormFields };
})(window, kintone);
