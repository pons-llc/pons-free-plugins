(function (root) {
  'use strict';

  // POST /k/v1/preview/app/deploy.json 実行後、GET /k/v1/preview/app/deploy.json の
  // status(PROCESSING/SUCCESS/FAIL/CANCEL)をポーリングする。取得関数(getStatus)・待機関数(wait)を
  // 注入し、オーケストレーションだけを確定的にテストできるようにする(resolve-org-info.jsと同じ設計)。
  const TERMINAL_STATUSES = new Set(['SUCCESS', 'FAIL', 'CANCEL']);

  const pollUntilDeployed = async ({
    getStatus,
    wait,
    intervalMs = 1000,
    maxAttempts = 60,
  }) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await getStatus();
      if (status === 'SUCCESS') {
        return { success: true, status };
      }
      if (TERMINAL_STATUSES.has(status)) {
        return { success: false, status };
      }
      if (attempt < maxAttempts - 1 && wait) {
        await wait(intervalMs);
      }
    }
    return { success: false, status: 'TIMEOUT' };
  };

  const DeployPoller = { pollUntilDeployed, TERMINAL_STATUSES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeployPoller;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.DeployPoller = DeployPoller;
  }
})(typeof window !== 'undefined' ? window : globalThis);
