(function (root) {
  'use strict';

  // 依頼アプリのプロセス管理の設定(PUT /k/v1/preview/app/status.json)。
  // statesを省略すると既存のステータスが削除される仕様のため、ONにするだけの場合も既存の
  // states/actionsをそのまま渡す(kintoneドキュメントMCPで確認済み)。
  const DRAFT = '未申請';
  const PENDING = '承認待ち';

  const assignee = (type, entities) => ({ type, entities });

  const buildDefaultProcess = ({
    completeStatus,
    creatorFieldCode,
    approverCode,
  }) => ({
    enable: true,
    states: {
      [DRAFT]: {
        name: DRAFT,
        index: '0',
        // 先頭のステータスの作業者の指定形式は常にONE(GETのレスポンス仕様)。
        assignee: assignee(
          'ONE',
          creatorFieldCode
            ? [{ entity: { type: 'FIELD_ENTITY', code: creatorFieldCode } }]
            : [],
        ),
      },
      [PENDING]: {
        name: PENDING,
        index: '1',
        // 作業者が未設定だとレコードを閲覧できる全員が「承認する」を実行できてしまうため、
        // 設定を保存したユーザー(依頼アプリの管理者)を仮の承認者にしておく。
        assignee: assignee(
          'ANY',
          approverCode
            ? [{ entity: { type: 'USER', code: approverCode } }]
            : [],
        ),
      },
      [completeStatus]: {
        name: completeStatus,
        index: '2',
        assignee: assignee('ONE', []),
      },
    },
    actions: [
      {
        name: '申請する',
        from: DRAFT,
        to: PENDING,
        filterCond: '',
        type: 'PRIMARY',
      },
      {
        name: '承認する',
        from: PENDING,
        to: completeStatus,
        filterCond: '',
        type: 'PRIMARY',
      },
      {
        name: '差し戻す',
        from: PENDING,
        to: DRAFT,
        filterCond: '',
        type: 'PRIMARY',
      },
    ],
  });

  const stateNames = (states) =>
    Object.keys(states || {}).map((key) => states[key].name || key);

  // GET /k/v1/preview/app/status.json のレスポンスから、保存時に行う処理を決める。
  const planProcessSetup = (statusResp, opts) => {
    const { completeStatus } = opts;
    const resp = statusResp || {};
    if (!resp.states || Object.keys(resp.states).length === 0) {
      if (completeStatus === DRAFT || completeStatus === PENDING) {
        return {
          action: 'error',
          error: `完了ステータス名に「${DRAFT}」「${PENDING}」は使えません(既定の承認フローのステータス名と重なるため)。`,
        };
      }
      return { action: 'create', body: buildDefaultProcess(opts) };
    }
    if (!stateNames(resp.states).includes(completeStatus)) {
      return {
        action: 'error',
        error:
          `プロセス管理に完了ステータス「${completeStatus}」がありません。` +
          'アプリの設定 → プロセス管理でステータスを追加するか、完了ステータス名を既存のステータス名に合わせてください。',
      };
    }
    if (!(resp.actions || []).some((a) => a.to === completeStatus)) {
      return {
        action: 'error',
        error: `プロセス管理に、完了ステータス「${completeStatus}」へ進むアクションがありません。`,
      };
    }
    if (resp.enable === true || resp.enable === 'true') {
      return { action: 'none' };
    }
    return {
      action: 'enable',
      body: { enable: true, states: resp.states, actions: resp.actions },
    };
  };

  // 複数人の承認が必要でステータスが変わらないアクションでもproceedイベントは発生する
  // (ドキュメントの補足)ため、ステータスが完了に「変わる」ときだけ反映する。
  const isCompletingAction = (event, completeStatus) => {
    const next = event && event.nextStatus && event.nextStatus.value;
    const current = event && event.status && event.status.value;
    return next === completeStatus && current !== completeStatus;
  };

  const ProcessSetup = {
    DRAFT,
    PENDING,
    buildDefaultProcess,
    planProcessSetup,
    isCompletingAction,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProcessSetup;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.ProcessSetup = ProcessSetup;
  }
})(typeof window !== 'undefined' ? window : globalThis);
