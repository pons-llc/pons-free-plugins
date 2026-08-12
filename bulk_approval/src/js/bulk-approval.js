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

  // config.displayFieldCodesのうち、現在のフォームに実在するフィールドだけを残す
  // (idea.md「エッジケース: コンフィグ削除後にフォームから消えたフィールドコード」参照)。
  const resolveDisplayFields = (config, formFields) =>
    (config.displayFieldCodes || [])
      .map((code) => formFields[code])
      .filter(Boolean);

  // 1ステータスグループ分のチェックボックス付きテーブルを構築する。
  // 戻り値のcheckboxesは record.id -> checkbox要素 のMap。
  const buildGroupTable = (records, displayFields) => {
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
      });
    });

    return { table, checkboxes };
  };

  // 1ステータスグループ分のセクション(見出し・テーブル・アクション選択)を構築する。
  // 実行できるアクションはグループのステータスだけで一意に決まるため、チェックボックスの
  // 選択状態が変わっても選択肢を再計算する必要はない(idea.md「対象レコードのグループ化」参照)。
  const buildGroupSection = (group, displayFields, statusSettings) => {
    const section = document.createElement('section');
    section.className = 'bap-status-group';

    const heading = document.createElement('h4');
    heading.className = 'bap-group-heading';
    heading.textContent = `${group.status}(${group.records.length}件)`;
    section.appendChild(heading);

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'bap-table-scroll';
    const { table, checkboxes } = buildGroupTable(group.records, displayFields);
    tableWrapper.appendChild(table);
    section.appendChild(tableWrapper);

    const actionNames = NS.StatusActions.listExecutableActionNames(
      statusSettings,
      group.status,
    );
    let actionSelect = null;
    if (actionNames.length === 0) {
      const noteEl = document.createElement('p');
      noteEl.className = 'bap-group-no-action-note';
      noteEl.textContent =
        'このステータスから実行できるアクションはありません(次の作業者の選択が必要なアクションは対象外です)。';
      section.appendChild(noteEl);
    } else {
      const actionRow = document.createElement('p');
      actionRow.className = 'bap-action-row';
      const actionLabel = document.createElement('label');
      actionLabel.textContent = '実行するアクション';
      actionSelect = document.createElement('select');
      actionSelect.className = 'bap-action-select';

      const blankOption = document.createElement('option');
      blankOption.value = '';
      blankOption.textContent = '(選択してください)';
      actionSelect.appendChild(blankOption);
      actionNames.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        actionSelect.appendChild(option);
      });

      actionLabel.appendChild(actionSelect);
      actionRow.appendChild(actionLabel);
      section.appendChild(actionRow);
    }

    return {
      section,
      status: group.status,
      records: group.records,
      checkboxes,
      actionSelect,
    };
  };

  // 現在のチェック状態・アクション選択から、実行対象(active)と、チェックはあるが
  // アクション未選択のため実行されないグループ(skipped)を仕分ける。
  const collectGroupSelections = (groupSections) => {
    const active = [];
    const skipped = [];
    groupSections.forEach((g) => {
      const checkedRecords = g.records.filter(
        (r) => g.checkboxes.get(r.id).checked,
      );
      if (checkedRecords.length === 0) {
        return;
      }
      const actionName = g.actionSelect ? g.actionSelect.value : '';
      if (actionName) {
        active.push({ status: g.status, actionName, records: checkedRecords });
      } else {
        skipped.push({ status: g.status, count: checkedRecords.length });
      }
    });
    return { active, skipped };
  };

  // 1つ目のダイアログ「対象レコードを選択」の本文を組み立てる。
  const buildSelectionDialogBody = (
    groups,
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

    const groupSections = groups.map((group) =>
      buildGroupSection(group, displayFields, statusSettings),
    );
    groupSections.forEach((g) => wrapper.appendChild(g.section));

    const errorEl = document.createElement('p');
    errorEl.className = 'bap-error';
    errorEl.hidden = true;
    wrapper.appendChild(errorEl);

    return { wrapper, groupSections, errorEl };
  };

  // 2つ目のダイアログ「最終確認」の本文を組み立てる。
  const buildFinalConfirmBody = (active, skipped) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bap-confirm-body';

    const totalCount = active.reduce((sum, s) => sum + s.records.length, 0);
    const summaryEl = document.createElement('p');
    summaryEl.className = 'bap-message';
    summaryEl.textContent = `合計${totalCount}件のレコードに対して、次のアクションを実行します。`;
    wrapper.appendChild(summaryEl);

    const list = document.createElement('ul');
    list.className = 'bap-plan-list';
    active.forEach((s) => {
      const li = document.createElement('li');
      li.textContent = `「${s.status}」の${s.records.length}件 → 「${s.actionName}」を実行`;
      list.appendChild(li);
    });
    wrapper.appendChild(list);

    if (skipped.length > 0) {
      const noteEl = document.createElement('p');
      noteEl.className = 'bap-skipped-note';
      noteEl.textContent =
        'アクションが選択されていないため、次のステータスのチェック済みレコードは実行されません。';
      wrapper.appendChild(noteEl);

      const skippedList = document.createElement('ul');
      skippedList.className = 'bap-plan-list';
      skipped.forEach((s) => {
        const li = document.createElement('li');
        li.textContent = `「${s.status}」の${s.count}件`;
        skippedList.appendChild(li);
      });
      wrapper.appendChild(skippedList);
    }

    return wrapper;
  };

  // config: { displayFieldCodes }
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
        ? `絞り込み条件に一致する${totalCount}件のうち、先頭${MAX_RECORDS}件を表示しています。ステータスごとに対象レコードを選択してください。`
        : `絞り込み条件に一致する${records.length}件のレコードです。ステータスごとに対象レコードを選択してください。`;

    const groups = NS.RecordGrouping.groupRecordsByStatus(
      records,
      statusFieldCode,
      statusSettings,
    );
    const { wrapper, groupSections, errorEl } = buildSelectionDialogBody(
      groups,
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
        const { active } = collectGroupSelections(groupSections);
        if (active.length === 0) {
          errorEl.textContent =
            '実行するレコードがありません。対象レコードを選択し、アクションを選んでください。';
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

    const { active, skipped } = collectGroupSelections(groupSections);

    const confirmDialog = await platform.createDialog({
      title: '一括承認: 最終確認',
      body: buildFinalConfirmBody(active, skipped),
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

    const writeRecords = NS.RecordGrouping.buildExecutionBatch(active);

    platform.showLoading();
    try {
      const writeResult = await NS.BatchWriter.runAll(writeRecords, {
        putBatch: (chunk) => putStatusBatch(appId, chunk),
        putSingle: (record) => putStatusSingle(appId, record),
      });
      const summary = NS.BatchWriter.buildResultSummary({
        totalTarget: writeRecords.length,
        updatedCount: writeResult.updatedCount,
        skipped: writeResult.skipped,
      });
      global.alert(summary);
    } catch (err) {
      global.alert(`実行を中止しました: ${err.message}`);
    } finally {
      platform.hideLoading();
    }
  };

  // 一覧画面ヘッダーに、対象アプリでプロセス管理が有効な場合のみボタンを表示する。
  // 実行できるユーザーの絞り込みは行わない(実際にアクションを実行できるかどうかは対象アプリの
  // プロセス管理の設定〈作業者・実行できるユーザー〉自体で決まるため、ボタンの表示可否を
  // 追加でクライアント側にゲートする必要はないと判断した。idea.md・security-checklist.md参照)。
  const renderButtonIfEligible = async (
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

    const statusSettings = await kintone.app.getStatus();
    if (!statusSettings.enable) {
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
    renderButtonIfEligible,
    findStatusFieldCode,
    resolveDisplayFields,
  };
})(window, kintone);
