(function (root) {
  'use strict';

  // 全件取得方針(共通の前提・訂正事項): offset・カーソルAPIは使わず、
  // $id(レコードID)昇順+`$id > 直前取得分の最大$id`でのページングを使う。
  // 1回のGET /k/v1/records.jsonで取得できる上限に合わせ、既定のページサイズは500件。
  const DEFAULT_PAGE_SIZE = 500;

  // 検索条件から組み立てたベースクエリ(order by等を含まない)に、
  // 前ページの最大$idによる絞り込みと order by $id asc limit を付与する。
  // lastMaxIdがnull/undefinedのときは1回目のページ(絞り込みなし)。
  const buildPagedQuery = (baseQuery, lastMaxId, pageSize) => {
    const size = pageSize || DEFAULT_PAGE_SIZE;
    const idClause =
      lastMaxId === null || lastMaxId === undefined
        ? ''
        : `$id > ${Number(lastMaxId)}`;
    const whereParts = [baseQuery, idClause].filter(
      (part) => part && String(part).trim(),
    );
    const wherePrefix =
      whereParts.length > 0 ? `${whereParts.join(' and ')} ` : '';
    return `${wherePrefix}order by $id asc limit ${size}`;
  };

  // 取得したレコード配列(REST APIのrecords)の中から、次ページの絞り込みに使う最大$idを求める。
  // 空配列ならnull(次ページなし、あるいは1件も無かった)を返す。
  const nextMaxId = (records) => {
    if (!records || records.length === 0) {
      return null;
    }
    return records.reduce((max, record) => {
      const id = Number(record.$id.value);
      return id > max ? id : max;
    }, -Infinity);
  };

  // 返ってきた件数がページサイズ未満であれば、そのページが最後のページだと判定できる
  // (kintone公式が推奨する$idページングの終了判定方法)。
  const isLastPage = (records, pageSize) => {
    const size = pageSize || DEFAULT_PAGE_SIZE;
    return !records || records.length < size;
  };

  const IdPaging = {
    DEFAULT_PAGE_SIZE,
    buildPagedQuery,
    nextMaxId,
    isLastPage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IdPaging;
  } else {
    root.RecordsToSubtable = root.RecordsToSubtable || {};
    root.RecordsToSubtable.IdPaging = IdPaging;
  }
})(typeof window !== 'undefined' ? window : globalThis);
