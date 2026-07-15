(function (root) {
  'use strict';

  // フィールド追加(POST /k/v1/preview/app/form/fields.json)後のアプリ設定デプロイ
  // (POST /k/v1/preview/app/deploy.json)は非同期APIのため、完了(SUCCESS)まで
  // GET /k/v1/preview/app/deploy.json をポーリングして待つ。getStatus/waitを依存性注入し、
  // setTimeout等の実時間待機なしにテストできるようにしている(time_band_aggregatorと同じ実装)。
  const DEFAULT_INTERVAL_MS = 2000;
  const DEFAULT_TIMEOUT_MS = 60000;

  // getStatus(): Promise<[{ app, status }]> … GET /k/v1/preview/app/deploy.json の apps
  // wait(ms): Promise<void>                 … 待機処理(実運用ではsetTimeoutベースのPromise)
  const waitForDeploy = async (
    appId,
    {
      getStatus,
      wait,
      intervalMs = DEFAULT_INTERVAL_MS,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    },
  ) => {
    const startedAt = Date.now();
    for (;;) {
      const statuses = await getStatus();
      const target = statuses.find((s) => String(s.app) === String(appId));
      if (target && target.status === 'SUCCESS') {
        return;
      }
      if (target && (target.status === 'FAIL' || target.status === 'CANCEL')) {
        throw new Error(
          `アプリ設定の反映に失敗しました(status: ${target.status})`,
        );
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('アプリ設定の反映がタイムアウトしました。');
      }
      await wait(intervalMs);
    }
  };

  const DeployPoller = {
    DEFAULT_INTERVAL_MS,
    DEFAULT_TIMEOUT_MS,
    waitForDeploy,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeployPoller;
  } else {
    root.ApprovalHistory = root.ApprovalHistory || {};
    root.ApprovalHistory.DeployPoller = DeployPoller;
  }
})(typeof window !== 'undefined' ? window : globalThis);
