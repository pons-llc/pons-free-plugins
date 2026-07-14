(function (root) {
  'use strict';

  // gBizINFO REST API v2のベースURL。実際のOpenAPI仕様(servers: "/hojin"、ホストは
  // api.info.gbiz.go.jp。idea.md参照)から確認済み。setProxyConfig()/proxy()はURL前方一致で
  // 判定されるため、詳細取得(末尾に/{corporate_number})・検索(末尾に?name=...)のどちらも
  // このBASE_URLで始まる1つの設定でカバーできる。
  const BASE_URL = 'https://api.info.gbiz.go.jp/hojin/v2/hojin';

  const buildDetailUrl = (corporateNumber) =>
    `${BASE_URL}/${encodeURIComponent(corporateNumber)}`;

  const buildSearchUrl = (name, limit) =>
    `${BASE_URL}?name=${encodeURIComponent(name)}&limit=${encodeURIComponent(limit)}`;

  const GBizApi = { BASE_URL, buildDetailUrl, buildSearchUrl };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GBizApi;
  } else {
    root.BizCodeSearch = root.BizCodeSearch || {};
    root.BizCodeSearch.GBizApi = GBizApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
