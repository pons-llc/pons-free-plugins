(function (global, kintone) {
  'use strict';

  const NS = global.TimeBandAggregator;

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

  const findRecordNumberFieldCode = (formFields) => {
    const entry = Object.values(formFields).find(
      (f) => f.type === 'RECORD_NUMBER',
    );
    return entry ? entry.code : null;
  };

  // 設定行ごとの時間帯を算出し、レコードのパッチ({フィールドコード: {value}})を組み立てる。
  // 値が空・不正な場合(TimeBand.computeTimeBandがnullを返す場合)は出力先2フィールドを空にする。
  const buildRecordPatch = (config, record, timeZone) => {
    const patch = {};
    config.rows.forEach((row) => {
      const sourceField = record[row.sourceFieldCode];
      const result = NS.TimeBand.computeTimeBand({
        value: sourceField ? sourceField.value : null,
        fieldType: sourceField ? sourceField.type : undefined,
        bandWidthMinutes: row.bandWidthMinutes,
        timeZone,
      });
      patch[row.dropdownFieldCode] = { value: result ? result.label : '' };
      patch[row.numberFieldCode] = {
        value: result ? String(result.number) : '',
      };
    });
    return patch;
  };

  // 一覧画面で現在表示されている絞り込み条件を対象に、一括実行する。
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

    const message = NS.ApiEstimate.buildMessage(targetCount);
    const dialogResult = await kintone.showConfirmDialog({
      title: '一括実行の確認',
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

    // idea.md「時間帯の算出方法」: DATETIMEフィールドの変換は実行ユーザーのタイムゾーンに依存する。
    // 一括実行時は「実行した人」のタイムゾーンで算出される(security-checklist.md参照)。
    const loginUser = await kintone.getLoginUser();
    const timeZone = loginUser.timezone;

    enableUnloadGuard();
    await kintone.showLoading('VISIBLE');
    try {
      const writeRecords = targetRecords.map((record) => ({
        id: record.$id.value,
        recordNumber: recordNumberFieldCode
          ? record[recordNumberFieldCode].value
          : record.$id.value,
        revision: record.$revision.value,
        record: buildRecordPatch(config, record, timeZone),
      }));

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
      global.alert(`一括実行を中止しました: ${err.message}`);
    } finally {
      kintone.showLoading('HIDDEN');
      disableUnloadGuard();
    }
  };

  // 一覧画面ヘッダーに、対象グループのメンバーにだけ一括実行ボタンを表示する。
  // kintone.user.getGroups() はクライアント側の表示ゲートに過ぎず、真の権限境界ではない
  // (真の境界は自アプリ自体のkintoneレコード編集権限設定)。security-checklist.md参照。
  const renderButtonIfAuthorized = async (headerEl, config, appId) => {
    if (
      !headerEl ||
      config.rows.length === 0 ||
      !config.bulkEnabled ||
      !config.bulkGroupCodes ||
      config.bulkGroupCodes.length === 0 ||
      headerEl.dataset.tbaBulkButtonRendered
    ) {
      return;
    }
    const groups = await kintone.user.getGroups();
    const userGroupCodes = groups.map((g) => g.code);
    if (
      !NS.GroupPermission.isAuthorized(userGroupCodes, config.bulkGroupCodes)
    ) {
      return;
    }
    // headerElはconstパラメーターであり、await後に再代入され得ないためrequire-atomic-updatesは誤検知。
    // eslint-disable-next-line require-atomic-updates
    headerEl.dataset.tbaBulkButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal tba-bulk-button';
    button.textContent = '時間帯を一括算出';
    button.addEventListener('click', () => {
      button.disabled = true;
      runBulk(config, appId).finally(() => {
        button.disabled = false;
      });
    });
    headerEl.appendChild(button);
  };

  NS.BulkRunner = {
    runBulk,
    renderButtonIfAuthorized,
    findRecordNumberFieldCode,
    buildRecordPatch,
  };
})(window, kintone);
