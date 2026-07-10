(function (global, kintone) {
  'use strict';

  // 一括ダウンロード用の複数レコード取得(REST API必須。JavaScript APIには複数レコード取得が
  // 存在しないため)。CLAUDE.md/plugin_idea_plan.mdの共通前提どおり、offset・カーソルAPIは使わず
  // $id(レコード番号ではなくレコードID)昇順 + `$id > 直前取得分の最大$id` で500件ずつページングする。

  const NS = global.ExcelReportExport;
  const PAGE_SIZE = 500;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);

  const withIdCondition = (baseQuery, lastId) => {
    const idCondition = lastId ? `$id > ${lastId}` : '';
    const parts = [baseQuery, idCondition].filter(Boolean);
    // ユーザーが指定/一覧の絞り込みで得たqueryにはorder byが含まれないことを前提とする
    // (kintone.app.getQueryCondition()はorder by/limit/offsetを含まない絞り込み条件のみを返す)。
    return `${parts.join(' and ')} order by $id asc limit ${PAGE_SIZE}`;
  };

  // queryに一致する件数のみを軽量に取得する(一括ダウンロードの上限チェック用。
  // limit 1 + totalCount:true で、実際のレコード内容は取得せずに済ませる)。
  const fetchTotalCount = async (appId, query) => {
    const resp = await kintone.api(recordsUrl(), 'GET', {
      app: appId,
      query: query ? `${query} limit 1` : 'limit 1',
      totalCount: true,
      fields: ['$id'],
    });
    return Number(resp.totalCount);
  };

  // queryに一致する全レコードを$id昇順でページングしながら取得する。
  const fetchAllRecords = async (appId, query) => {
    const records = [];
    let lastId = null;
    for (;;) {
      const resp = await kintone.api(recordsUrl(), 'GET', {
        app: appId,
        query: withIdCondition(query, lastId),
      });
      records.push(...resp.records);
      if (resp.records.length < PAGE_SIZE) {
        break;
      }
      lastId = resp.records[resp.records.length - 1].$id.value;
    }
    return records;
  };

  NS.RecordFetcher = { fetchTotalCount, fetchAllRecords };
})(window, kintone);
