(function (global, kintone) {
  'use strict';

  const NS = global.RelatedRecordSummary;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);
  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const cursorUrl = () => kintone.api.url('/k/v1/records/cursor.json', true);

  const createCursor = (appId, query) =>
    kintone.api(cursorUrl(), 'POST', { app: appId, query, size: 500 });
  const getCursorPage = (cursorId) =>
    kintone.api(cursorUrl(), 'GET', { id: cursorId });
  const deleteCursor = (cursorId) =>
    kintone.api(cursorUrl(), 'DELETE', { id: cursorId });

  const putBatch = (appId, records) =>
    kintone.api(recordsUrl(), 'PUT', {
      app: appId,
      records: records.map((r) => ({
        id: r.id,
        revision: r.revision,
        record: r.record,
      })),
    });

  const putSingle = (appId, record) =>
    kintone.api(recordUrl(), 'PUT', {
      app: appId,
      id: record.id,
      revision: record.revision,
      record: record.record,
    });

  // 保存前に画面遷移・タブを閉じられて処理が中断されるのを防ぐ(secureCodingGuideline
  // 「短時間で大量のリクエスト送信を避ける」を踏まえ、処理中は離脱を止めるための最低限の実装)。
  let unloadGuard = null;
  const enableUnloadGuard = () => {
    unloadGuard = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    global.addEventListener('beforeunload', unloadGuard);
  };
  const disableUnloadGuard = () => {
    if (unloadGuard) {
      global.removeEventListener('beforeunload', unloadGuard);
      unloadGuard = null;
    }
  };

  // formFields内からRECORD_NUMBER型のフィールドコードを探す(結果表示にレコード番号を出すため)。
  // 見つからない場合は $id(レコードID)で代用する。
  const findRecordNumberFieldCode = (formFields) => {
    const entry = Object.values(formFields).find(
      (f) => f.type === 'RECORD_NUMBER',
    );
    return entry ? entry.code : null;
  };

  // 一覧画面で現在表示されている絞り込み条件を対象に、一括集計を実行する。
  // 対象レコードの列挙にはレコードカーソルAPIを使う(共通の前提・訂正事項の例外規定を参照。
  // $idページングは使わない)。
  const runBulk = async (config, appId) => {
    const formFields = await kintone.app.getFormFields();
    const recordNumberFieldCode = findRecordNumberFieldCode(formFields);
    const baseQuery = kintone.app.getQueryCondition() || '';

    const { records: targetRecords } = await NS.CursorEnumerator.enumerateAll({
      createCursor: () => createCursor(appId, baseQuery),
      getCursor: (id) => getCursorPage(id),
      deleteCursor: (id) => deleteCursor(id),
    });

    const targetCount = targetRecords.length;
    if (targetCount === 0) {
      global.alert('現在の絞り込み条件に該当するレコードがありません。');
      return;
    }

    const message = NS.ApiEstimate.buildMessage(
      targetCount,
      config.rows.length,
    );
    const dialogResult = await kintone.showConfirmDialog({
      title: '一括集計の実行確認',
      body: message,
      showOkButton: true,
      okButtonText: '実行',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
    });
    if (dialogResult !== 'OK') {
      return;
    }

    enableUnloadGuard();
    await kintone.showLoading('VISIBLE');
    try {
      const writeRecords = [];
      for (const record of targetRecords) {
        // 参照先アプリの閲覧権限がない等でここが失敗した場合、書き戻しは1件も行わずに
        // 例外をそのまま外側へ伝播させ、処理全体を中止する(idea.md「実行前提」を参照)。

        const updates = await NS.SummaryService.computeAll(
          config,
          formFields,
          record,
        );
        const recordPatch = {};
        Object.keys(updates).forEach((fieldCode) => {
          recordPatch[fieldCode] = { value: String(updates[fieldCode]) };
        });
        writeRecords.push({
          id: record.$id.value,
          recordNumber: recordNumberFieldCode
            ? record[recordNumberFieldCode].value
            : record.$id.value,
          revision: record.$revision.value,
          record: recordPatch,
        });
      }

      const writeResult = await NS.BatchWriter.runAll(writeRecords, {
        putBatch: (chunk) => putBatch(appId, chunk),
        putSingle: (record) => putSingle(appId, record),
      });

      const summary = NS.BatchWriter.buildResultSummary({
        totalTarget: targetCount,
        updatedCount: writeResult.updatedCount,
        skipped: writeResult.skipped,
      });

      global.alert(summary);
    } catch (err) {
      global.alert(`一括集計を中止しました: ${err.message}`);
    } finally {
      kintone.showLoading('HIDDEN');
      disableUnloadGuard();
    }
  };

  // 一覧画面ヘッダーに、対象グループのメンバーにだけ一括集計ボタンを表示する。
  // kintone.user.getGroups() はクライアント側の表示ゲートに過ぎず、真の権限境界ではない
  // (真の境界は参照先・自アプリ自体のkintoneレコード権限設定)。security-checklist.md参照。
  const renderButtonIfAuthorized = async (headerEl, config, appId) => {
    if (
      !headerEl ||
      config.rows.length === 0 ||
      !config.triggers.onIndexBulk ||
      !config.bulkGroupCodes ||
      config.bulkGroupCodes.length === 0 ||
      headerEl.dataset.rrsBulkButtonRendered
    ) {
      return;
    }
    const groups = await kintone.user.getGroups();
    const isAuthorized = groups.some((g) =>
      config.bulkGroupCodes.includes(g.code),
    );
    if (!isAuthorized) {
      return;
    }
    // headerElはconstパラメーターであり、await後に再代入され得ないためrequire-atomic-updatesは誤検知。
    // eslint-disable-next-line require-atomic-updates
    headerEl.dataset.rrsBulkButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal rrs-bulk-button';
    button.textContent = '関連レコードを一括集計';
    button.addEventListener('click', () => {
      button.disabled = true;
      runBulk(config, appId).finally(() => {
        button.disabled = false;
      });
    });
    headerEl.appendChild(button);
  };

  NS.BulkSummary = {
    runBulk,
    renderButtonIfAuthorized,
    findRecordNumberFieldCode,
  };
})(window, kintone);
