(function (global) {
  'use strict';

  const NS = global.FiscalYearNumbering;
  const PAGE_LIMIT = 500;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const searchUnnumbered = (appId, numberFieldCode, offset) => {
    const query = `${numberFieldCode} is empty order by $id asc limit ${PAGE_LIMIT} offset ${offset}`;
    return kintone.api(recordsUrl(), 'GET', { app: appId, query });
  };

  const persistNumber = (appId, recordId, revision, numberFieldCode, number) =>
    kintone.api(recordUrl(), 'PUT', {
      app: appId,
      id: recordId,
      revision,
      record: { [numberFieldCode]: { value: number } },
    });

  // アプリ全体を対象に、未採番レコードすべてに採番する。並列実行はせず逐次処理する
  // (secureCodingGuidelineの「短時間で大量のリクエスト送信を避ける」「並列実行をなるべく避ける」に対応)。
  //
  // NOTE: プロセス管理が有効なアプリでは、採番タイミングを「ステータス変化時」に設定していても、
  // 一括採番はステータスに関わらずアプリ全体の未採番レコードを対象にする(検索クエリ自体は変更しない)。
  // 意図しないタイミングでの一括採番を避けられるよう、確認ダイアログでその旨を警告する。
  const runFullScan = async (config, appId) => {
    const status = await kintone.app.getStatus();
    const processWarning =
      status && status.enable
        ? '\n\n※このアプリはプロセス管理が有効です。一括採番はステータスに関わらず未採番のレコードすべてを対象とします。'
        : '';
    // eslint-disable-next-line no-alert
    if (
      !global.confirm(
        `このアプリ内の未採番レコードすべてに番号を採番します。よろしいですか？${processWarning}`
      )
    ) {
      return;
    }
    let offset = 0;
    let processed = 0;
    for (;;) {
      const { records } = await searchUnnumbered(appId, config.numberFieldCode, offset);
      if (records.length === 0) {
        break;
      }
      for (const record of records) {
        const number = await NS.NumberingService.computeNext(config, record, appId);
        await persistNumber(
          appId,
          record.$id.value,
          record.$revision.value,
          config.numberFieldCode,
          number
        );
        processed += 1;
      }
      offset += records.length;
      if (records.length < PAGE_LIMIT) {
        break;
      }
    }
    // eslint-disable-next-line no-alert
    global.alert(`${processed}件を採番しました。`);
  };

  // 一覧画面ヘッダーに、対象グループのメンバーにだけ一括採番ボタンを表示する。
  // kintone.user.getGroups() はクライアント側の表示ゲートであり、真の権限境界ではない
  // (真の境界は対象アプリ自体のレコード編集権限)。security-checklist.md参照。
  const renderButtonIfAuthorized = async (headerEl, config, appId) => {
    if (!headerEl || !config.bulkNumberingGroupCode || headerEl.dataset.fynBulkButtonRendered) {
      return;
    }
    const groups = await kintone.user.getGroups();
    if (!groups.some((g) => g.code === config.bulkNumberingGroupCode)) {
      return;
    }
    headerEl.dataset.fynBulkButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal fyn-bulk-button';
    button.textContent = '未採番レコードを一括採番';
    button.addEventListener('click', () => {
      runFullScan(config, appId).catch((err) => {
        // eslint-disable-next-line no-alert
        global.alert(`一括採番に失敗しました: ${err.message}`);
      });
    });
    headerEl.appendChild(button);
  };

  NS.BulkNumbering = { runFullScan, renderButtonIfAuthorized };
})(window);
