(function (root) {
  'use strict';

  // GET /v1/groups.json (User API、必要なアクセス権なし、org_lookupのOrganization APIと同系統)は
  // 1回最大100件までしか返らないため、offsetページングで全件取得する。fetchPageを注入することで
  // kintone.api()呼び出しから分離し、オーケストレーションだけを確定的にテストする
  // (resolve-org-info.jsと同じ設計)。
  const PAGE_SIZE = 100;

  const fetchAllGroups = async (fetchPage, pageSize = PAGE_SIZE) => {
    const groups = [];
    let offset = 0;
    for (;;) {
      const page = await fetchPage({ size: pageSize, offset });
      groups.push(...page);
      if (page.length < pageSize) {
        break;
      }
      offset += pageSize;
    }
    return groups;
  };

  const GroupDirectory = { PAGE_SIZE, fetchAllGroups };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GroupDirectory;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.GroupDirectory = GroupDirectory;
  }
})(typeof window !== 'undefined' ? window : globalThis);
