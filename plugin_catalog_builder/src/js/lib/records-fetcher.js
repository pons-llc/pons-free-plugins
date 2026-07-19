(function (root) {
  'use strict';

  // 台帳アプリの全レコードを$id昇順ページングで取得する共通ロジック(CLAUDE.md/plugin_idea_plan.mdの
  // 「全件取得方針」参照。offset・カーソルAPIは使わない)。fetchPage(lastId)は
  // 「$id > lastId」を条件に含めたGET /k/v1/records.jsonの呼び出しを呼び出し側(desktop.js)が
  // 組み立てて注入する。空配列が返るまで繰り返す。
  const fetchAllRecords = async (fetchPage) => {
    let records = [];
    let lastId = 0;
    for (;;) {
      const page = await fetchPage(lastId);
      if (!page || page.length === 0) {
        break;
      }
      records = records.concat(page);
      lastId = Number(page[page.length - 1].$id.value);
    }
    return records;
  };

  const RecordsFetcher = { fetchAllRecords };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordsFetcher;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.RecordsFetcher = RecordsFetcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
