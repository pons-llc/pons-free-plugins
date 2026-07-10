(function (root) {
  'use strict';

  // 参照先アプリからSUM/AVERAGE集計に必要なレコードを取得するためのページング。
  // 「共通の前提・訂正事項」の全件取得方針(確定)に従い、offsetではなく
  // $id昇順 + order by $id asc + "$id > 直前取得分の最大$id" で500件ずつ取得する。
  // (一覧画面からの一括集計の対象レコード列挙には使わない。あちらはレコードカーソルAPIを使う
  // → cursor-enumerator.js を参照)

  const PAGE_SIZE = 500;

  // baseQuery(除外条件等を合成済みのクエリ、空文字列可)に、ページング用の
  // $id条件とorder by/limitを付加する。
  const buildPagedQuery = (baseQuery, lastId, pageSize = PAGE_SIZE) => {
    const clauses = [baseQuery];
    if (lastId !== undefined && lastId !== null) {
      clauses.push(`$id > ${lastId}`);
    }
    const nonEmpty = clauses
      .map((c) => (c || '').trim())
      .filter((c) => c.length > 0);
    let condition = '';
    if (nonEmpty.length === 1) {
      condition = nonEmpty[0];
    } else if (nonEmpty.length > 1) {
      condition = nonEmpty.map((c) => `(${c})`).join(' and ');
    }
    const prefix = condition ? `${condition} ` : '';
    return `${prefix}order by $id asc limit ${pageSize}`;
  };

  // fetchPage(query) => Promise<{records: [...]}> を呼び出し、$idベースのページングで
  // レコードがpageSize未満になるまで(=最終ページまで)全件取得する。
  const fetchAllPages = async (baseQuery, fetchPage, pageSize = PAGE_SIZE) => {
    const all = [];
    let lastId;
    for (;;) {
      const query = buildPagedQuery(baseQuery, lastId, pageSize);

      const { records } = await fetchPage(query);
      all.push(...records);
      if (records.length < pageSize) {
        break;
      }
      lastId = records[records.length - 1].$id.value;
    }
    return all;
  };

  const PagedFetch = { PAGE_SIZE, buildPagedQuery, fetchAllPages };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PagedFetch;
  } else {
    root.RelatedRecordSummary = root.RelatedRecordSummary || {};
    root.RelatedRecordSummary.PagedFetch = PagedFetch;
  }
})(typeof window !== 'undefined' ? window : globalThis);
