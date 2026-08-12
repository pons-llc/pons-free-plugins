(function (global, kintone) {
  'use strict';

  // 一覧画面からの一括承認の orchestration ロジック。PC・モバイル共通で使う
  // (kintone.createDialog/kintone.mobile.createBottomSheet、kintone.showLoading/
  // kintone.mobile.showLoading、kintone.app.getQueryCondition/
  // kintone.mobile.app.getQueryConditionはそれぞれPC専用/モバイル専用APIのため、
  // platform引数として呼び出し元(desktop.js/mobile.js)から注入する。idea.md参照)。
  const NS = global.BulkApproval;

  const MAX_RECORDS = 500;

  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const statusBatchUrl = () =>
    kintone.api.url('/k/v1/records/status.json', true);
  const statusSingleUrl = () =>
    kintone.api.url('/k/v1/record/status.json', true);

  const getRecords = (appId, query, fields) =>
    kintone.api(recordsUrl(), 'GET', {
      app: appId,
      query,
      fields,
      totalCount: true,
    });

  const putStatusBatch = (appId, records) =>
    kintone.api(statusBatchUrl(), 'PUT', {
      app: appId,
      records: records.map((r) => ({
        id: r.id,
        action: r.action,
        revision: r.revision,
      })),
    });
  const putStatusSingle = (appId, record) =>
    kintone.api(statusSingleUrl(), 'PUT', {
      app: appId,
      id: record.id,
      action: record.action,
      revision: record.revision,
    });

  // formFields: kintone.app.getFormFields()の戻り値。ステータスは「フィールド名」で参照する型
  // (kintoneドキュメントMCP「フィールド形式」参照)のため、type === 'STATUS' で探す
  // (通常のフィールドコードのようにコンフィグへ保存する必要が無い)。
  const findStatusFieldCode = (formFields) => {
    const entry = Object.values(formFields).find((f) => f.type === 'STATUS');
    return entry ? entry.code : null;
  };

  const INELIGIBLE_REASON_LABEL = {
    STATUS_MISMATCH: '現在のステータスでは実行できません',
    ASSIGNEE_REQUIRED: '次の作業者の選択が必要なため対象外です',
  };

  // config.displayFieldCodesのうち、現在のフォームに実在するフィールドだけを残す
  // (idea.md「エッジケース: コンフィグ削除後にフォームから消えたフィールドコード」参照)。
  const resolveDisplayFields = (config, formFields) =>
    (config.displayFieldCodes || [])
      .map((code) => formFields[code])
      .filter(Boolean);

  // レコード一覧のチェックボックス付きテーブルを構築する。
  // 戻り値のcheckboxesは record.id -> checkbox要素 のMap。
  const buildRecordTable = (records, statusFieldCode, displayFields) => {
    const table = document.createElement('table');
    table.className = 'bap-record-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const selectAllTh = document.createElement('th');
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.checked = true;
    selectAllTh.appendChild(selectAllCheckbox);
    headRow.appendChild(selectAllTh);

    const statusTh = document.createElement('th');
    statusTh.textContent = 'ステータス';
    headRow.appendChild(statusTh);

    displayFields.forEach((field) => {
      const th = document.createElement('th');
      th.textContent = field.label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const checkboxes = new Map();
    records.forEach((record) => {
      const tr = document.createElement('tr');

      const checkboxTd = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkboxTd.appendChild(checkbox);
      tr.appendChild(checkboxTd);
      checkboxes.set(record.id, checkbox);

      const statusTd = document.createElement('td');
      statusTd.textContent = record[statusFieldCode]
        ? record[statusFieldCode].value
        : '';
      tr.appendChild(statusTd);

      displayFields.forEach((field) => {
        const td = document.createElement('td');
        td.textContent = NS.FieldValueFormatter.formatFieldValue(
          record[field.code],
        );
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    selectAllCheckbox.addEventListener('change', () => {
      checkboxes.forEach((cb) => {
        cb.checked = selectAllCheckbox.checked;
        cb.dispatchEvent(new Event('change'));
      });
    });

    return { table, checkboxes };
  };

  // 選択中(チェック済み)のレコードを取得する。
  const getCheckedRecords = (records, checkboxes) =>
    records.filter((record) => checkboxes.get(record.id).checked);

  // アクション選択肢を、現在チェックされているレコードから再計算する。
  // それまでの選択値が新しい候補に含まれていれば維持し、含まれなくなった場合は選択解除する。
  const refreshActionOptions = (
    selectEl,
    records,
    checkboxes,
    statusFieldCode,
    statusSettings,
  ) => {
    const checked = getCheckedRecords(records, checkboxes);
    const names = NS.SelectionPartitioner.collectAvailableActionNames(
      checked,
      statusFieldCode,
      statusSettings,
    );
    const previousValue = selectEl.value;
    selectEl.textContent = '';

    const blankOption = document.createElement('option');
    blankOption.value = '';
    blankOption.textContent =
      checked.length === 0
        ? '(レコードを選択してください)'
        : '(選択してください)';
    selectEl.appendChild(blankOption);

    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      selectEl.appendChild(option);
    });
    selectEl.value = names.includes(previousValue) ? previousValue : '';
    selectEl.disabled = names.length === 0;
  };

  // 1つ目のダイアログ「対象レコードを選択」の本文を組み立てる。
  const buildSelectionDialogBody = (
    records,
    statusFieldCode,
    displayFields,
    statusSettings,
    headerMessage,
  ) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bap-selection-body';

    const messageEl = document.createElement('p');
    messageEl.className = 'bap-message';
    messageEl.textContent = headerMessage;
    wrapper.appendChild(messageEl);

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'bap-table-scroll';
    const { table, checkboxes } = buildRecordTable(
      records,
      statusFieldCode,
      displayFields,
    );
    tableWrapper.appendChild(table);
    wrapper.appendChild(tableWrapper);

    const actionRow = document.createElement('p');
    actionRow.className = 'bap-action-row';
    const actionLabel = document.createElement('label');
    actionLabel.textContent = '実行するアクション';
    const actionSelect = document.createElement('select');
    actionSelect.className = 'bap-action-select';
    actionLabel.appendChild(actionSelect);
    actionRow.appendChild(actionLabel);
    wrapper.appendChild(actionRow);

    const errorEl = document.createElement('p');
    errorEl.className = 'bap-error';
    errorEl.hidden = true;
    wrapper.appendChild(errorEl);

    const refresh = () =>
      refreshActionOptions(
        actionSelect,
        records,
        checkboxes,
        statusFieldCode,
        statusSettings,
      );
    checkboxes.forEach((cb) => cb.addEventListener('change', refresh));
    refresh();

    return { wrapper, checkboxes, actionSelect, errorEl };
  };

  // 2つ目のダイアログ「最終確認」の本文を組み立てる。
  const buildFinalConfirmBody = (actionName, eligible, ineligible) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bap-confirm-body';

    const summaryEl = document.createElement('p');
    summaryEl.className = 'bap-message';
    summaryEl.textContent = `「${actionName}」を ${eligible.length}件のレコードに対して実行します。`;
    wrapper.appendChild(summaryEl);

    if (ineligible.length > 0) {
      const noteEl = document.createElement('p');
      noteEl.className = 'bap-ineligible-note';
      noteEl.textContent = `選択されていたレコードのうち${ineligible.length}件は対象外のため実行されません。`;
      wrapper.appendChild(noteEl);

      const list = document.createElement('ul');
      list.className = 'bap-ineligible-list';
      ineligible.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `レコードID ${item.id}: ${INELIGIBLE_REASON_LABEL[item.reason] || item.reason}`;
        list.appendChild(li);
      });
      wrapper.appendChild(list);
    }

    return wrapper;
  };

  // config: { displayFieldCodes, groupCodes }
  // platform: {
  //   createDialog(config): Promise<{show, close}>
  //     (kintone.createDialog/kintone.mobile.createBottomSheetと同一シグネチャ),
  //   showLoading(): void, hideLoading(): void,
  //   getQueryCondition(): string,
  // }
  const runBulkApproval = async (config, appId, platform) => {
    // kintone.app.getStatus()はレコード一覧画面でも利用できる非同期API。戻り値はREST API
    // 「プロセス管理の設定を取得する」のrevisionを除いたものと同様の値がそのまま返る
    // ({ states, actions } のようにプロパティ名でラップされない。CLAUDE.md「既知の落とし穴」・
    // idea.md参照、確認済み)。
    const [formFields, statusSettings] = await Promise.all([
      kintone.app.getFormFields(),
      kintone.app.getStatus(),
    ]);

    const statusFieldCode = findStatusFieldCode(formFields);
    if (!statusFieldCode || !statusSettings.enable) {
      global.alert('このアプリはプロセス管理が有効になっていません。');
      return;
    }

    const displayFields = resolveDisplayFields(config, formFields);
    const query = `${platform.getQueryCondition()} limit ${MAX_RECORDS}`.trim();
    const fields = [
      '$id',
      '$revision',
      statusFieldCode,
      ...displayFields.map((f) => f.code),
    ];

    let response;
    try {
      response = await getRecords(appId, query, fields);
    } catch (err) {
      global.alert(`対象レコードの検索に失敗しました: ${err.message}`);
      return;
    }

    if (response.records.length === 0) {
      global.alert('対象レコードがありません。');
      return;
    }

    const records = response.records.map((record) => ({
      id: record.$id.value,
      revision: record.$revision.value,
      ...record,
    }));

    const totalCount = Number(response.totalCount);
    const headerMessage =
      totalCount > MAX_RECORDS
        ? `絞り込み条件に一致する${totalCount}件のうち、先頭${MAX_RECORDS}件を表示しています。対象レコードを選択してください。`
        : `絞り込み条件に一致する${records.length}件のレコードです。対象レコードを選択してください。`;

    const { wrapper, checkboxes, actionSelect, errorEl } =
      buildSelectionDialogBody(
        records,
        statusFieldCode,
        displayFields,
        statusSettings,
        headerMessage,
      );

    const selectionDialog = await platform.createDialog({
      title: '一括承認: 対象レコードを選択',
      body: wrapper,
      showOkButton: true,
      okButtonText: '次へ',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
      beforeClose: (action) => {
        if (action !== 'OK') {
          return true;
        }
        const checked = getCheckedRecords(records, checkboxes);
        if (checked.length === 0) {
          errorEl.textContent = '対象レコードを1件以上選択してください。';
          errorEl.hidden = false;
          return false;
        }
        if (!actionSelect.value) {
          errorEl.textContent = '実行するアクションを選択してください。';
          errorEl.hidden = false;
          return false;
        }
        return true;
      },
    });
    const selectionResult = await selectionDialog.show();
    if (selectionResult !== 'OK') {
      return;
    }

    const checkedRecords = getCheckedRecords(records, checkboxes);
    const actionName = actionSelect.value;
    const { eligible, ineligible } = NS.SelectionPartitioner.partitionForAction(
      checkedRecords,
      statusFieldCode,
      actionName,
      statusSettings,
    );

    const confirmDialog = await platform.createDialog({
      title: '一括承認: 最終確認',
      body: buildFinalConfirmBody(actionName, eligible, ineligible),
      showOkButton: true,
      okButtonText: '実行する',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
    });
    const confirmResult = await confirmDialog.show();
    if (confirmResult !== 'OK') {
      return;
    }

    platform.showLoading();
    try {
      const writeResult = await NS.BatchWriter.runAll(eligible, {
        putBatch: (chunk) => putStatusBatch(appId, chunk),
        putSingle: (record) => putStatusSingle(appId, record),
      });
      const summary = NS.BatchWriter.buildResultSummary({
        totalTarget: eligible.length,
        updatedCount: writeResult.updatedCount,
        skipped: writeResult.skipped,
        ineligibleCount: ineligible.length,
      });
      global.alert(summary);
    } catch (err) {
      global.alert(`実行を中止しました: ${err.message}`);
    } finally {
      platform.hideLoading();
    }
  };

  // 一覧画面ヘッダーに、対象グループのメンバーにだけボタンを表示する。
  // kintone.user.getGroups()はクライアント側の表示ゲートに過ぎず、真の権限境界ではない
  // (真の境界は対象アプリのプロセス管理の設定自体。idea.md「実行可能グループによる表示制御」・
  // security-checklist.md参照)。
  const renderButtonIfAuthorized = async (
    headerEl,
    config,
    appId,
    platform,
    viewType,
  ) => {
    if (!headerEl || headerEl.dataset.bapButtonRendered) {
      return;
    }
    // kintone.app.getQueryCondition()が意味を持つ表形式の一覧のみ対応する(idea.md「対象レコードの取得」参照)。
    if (viewType && viewType !== 'list') {
      return;
    }
    if (!config.groupCodes || config.groupCodes.length === 0) {
      return;
    }

    const statusSettings = await kintone.app.getStatus();
    if (!statusSettings.enable) {
      return;
    }

    const groups = await kintone.user.getGroups();
    const isAuthorized = groups.some((g) => config.groupCodes.includes(g.code));
    if (!isAuthorized) {
      return;
    }

    // headerElはconstパラメーターであり、await後に再代入され得ないためrequire-atomic-updatesは誤検知。
    // eslint-disable-next-line require-atomic-updates
    headerEl.dataset.bapButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal bap-bulk-button';
    button.textContent = '一括承認';
    button.addEventListener('click', () => {
      button.disabled = true;
      runBulkApproval(config, appId, platform).finally(() => {
        button.disabled = false;
      });
    });
    headerEl.appendChild(button);
  };

  NS.BulkApprovalMain = {
    runBulkApproval,
    renderButtonIfAuthorized,
    findStatusFieldCode,
    resolveDisplayFields,
  };
})(window, kintone);
