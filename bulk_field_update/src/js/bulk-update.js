(function (global, kintone) {
  'use strict';

  // 一覧画面からの一括更新の orchestration ロジック。PC・モバイル共通で使う
  // (kintone.createDialog/kintone.mobile.createBottomSheet、kintone.showLoading/
  // kintone.mobile.showLoading、kintone.app.getQueryCondition/
  // kintone.mobile.app.getQueryConditionはそれぞれPC専用/モバイル専用APIのため、
  // platform引数として呼び出し元(desktop.js/mobile.js)から注入する)。
  const NS = global.BulkFieldUpdate;

  const cursorUrl = () => kintone.api.url('/k/v1/records/cursor.json', true);
  const recordsUrl = () => kintone.api.url('/k/v1/records.json', true);
  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const createCursor = (appId, query, fields) =>
    kintone.api(cursorUrl(), 'POST', { app: appId, query, fields, size: 500 });
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

  // formFields内からRECORD_NUMBER型のフィールドコードを探す(結果表示にレコード番号を出すため)。
  const findRecordNumberFieldCode = (formFields) => {
    const entry = Object.values(formFields).find(
      (f) => f.type === 'RECORD_NUMBER',
    );
    return entry ? entry.code : null;
  };

  // 保存前に画面遷移・タブを閉じられて処理が中断されるのを防ぐ(secureCodingGuideline
  // 「短時間で大量のリクエスト送信を避ける」を踏まえた最低限の実装、age_grade_field_updateと同じ)。
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

  const sortedOptionEntries = (field) =>
    Object.entries(field.options || {}).sort(
      (a, b) => Number(a[1].index) - Number(b[1].index),
    );

  // 確認ダイアログの入力欄を型ごとに組み立てる。書き込む値は保存済みの初期値ではなく、
  // 実行のたびにここで都度入力する(idea.md「任意の値を都度入力する」参照)。
  // 選択肢の値はoptionsのオブジェクトキー(表示ラベルではなくAPIでの登録・更新に使う識別子)を使う。
  const buildSingleChoiceControl = (field) => {
    const selectEl = document.createElement('select');
    selectEl.className = 'kintoneplugin-select bfu-value-input';
    const blankOptionEl = document.createElement('option');
    blankOptionEl.value = '';
    blankOptionEl.textContent = '(選択してください)';
    selectEl.appendChild(blankOptionEl);
    sortedOptionEntries(field).forEach(([key, opt]) => {
      const optionEl = document.createElement('option');
      optionEl.value = key;
      optionEl.textContent = opt.label;
      selectEl.appendChild(optionEl);
    });
    return { el: selectEl, read: () => selectEl.value };
  };

  const buildMultiChoiceControl = (field) => {
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'bfu-checkbox-group';
    const checkboxEls = [];
    sortedOptionEntries(field).forEach(([key, opt]) => {
      const labelEl = document.createElement('label');
      labelEl.className = 'bfu-checkbox-label';
      const checkboxEl = document.createElement('input');
      checkboxEl.type = 'checkbox';
      checkboxEl.value = key;
      checkboxEls.push(checkboxEl);
      labelEl.appendChild(checkboxEl);
      labelEl.appendChild(document.createTextNode(opt.label));
      wrapperEl.appendChild(labelEl);
    });
    return {
      el: wrapperEl,
      read: () => checkboxEls.filter((c) => c.checked).map((c) => c.value),
    };
  };

  const buildTextareaControl = () => {
    const textareaEl = document.createElement('textarea');
    textareaEl.className = 'kintoneplugin-input-text bfu-value-input';
    textareaEl.rows = 2;
    return { el: textareaEl, read: () => textareaEl.value };
  };

  const buildDateOrTimeControl = (kind) => {
    const inputEl = document.createElement('input');
    inputEl.type = kind === 'DATE' ? 'date' : 'time';
    inputEl.className = 'bfu-value-input';
    return { el: inputEl, read: () => inputEl.value };
  };

  const buildDatetimeControl = () => {
    const inputEl = document.createElement('input');
    inputEl.type = 'datetime-local';
    inputEl.className = 'bfu-value-input';
    return {
      el: inputEl,
      read: () => NS.DatetimeLocalCodec.encodeDatetimeLocal(inputEl.value),
    };
  };

  const buildTextControl = () => {
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'kintoneplugin-input-text bfu-value-input';
    return { el: inputEl, read: () => inputEl.value };
  };

  const CONTROL_BUILDERS = {
    SINGLE_CHOICE: buildSingleChoiceControl,
    MULTI_CHOICE: buildMultiChoiceControl,
    TEXTAREA: buildTextareaControl,
    DATE: () => buildDateOrTimeControl('DATE'),
    TIME: () => buildDateOrTimeControl('TIME'),
    DATETIME: buildDatetimeControl,
  };

  const buildValueControl = (field) => {
    const kind = NS.FieldEligibility.inputKindOf(field.type);
    const builder = CONTROL_BUILDERS[kind] || buildTextControl;
    return builder(field);
  };

  // 確認ダイアログの本文Elementを組み立てる。対象フィールドごとに値の入力欄を1行ずつ配置する。
  // createDialog/createBottomSheetのconfig.bodyはそのままダイアログへ組み込まれる仕様のため、
  // ユーザー入力をHTML文字列として組み立てず、createElement/textContentのみで構築する
  // (secureCodingGuideline「外部からの入力値を使用した要素の生成を避ける」)。
  const buildConfirmDialogBody = (message, targetFields) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bfu-confirm-body';

    const messageEl = document.createElement('p');
    messageEl.className = 'bfu-confirm-message';
    messageEl.textContent = message;
    wrapper.appendChild(messageEl);

    const readers = {};
    targetFields.forEach((field) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'bfu-confirm-row';

      const labelEl = document.createElement('label');
      labelEl.className = 'bfu-value-label';
      labelEl.textContent = field.required
        ? `${field.label}(必須)`
        : field.label;

      const { el, read } = buildValueControl(field);
      labelEl.appendChild(el);
      readers[field.code] = read;

      rowEl.appendChild(labelEl);
      wrapper.appendChild(rowEl);
    });

    const errorEl = document.createElement('p');
    errorEl.className = 'bfu-value-error';
    errorEl.hidden = true;
    wrapper.appendChild(errorEl);

    return { wrapper, readers, errorEl };
  };

  // config: { targetFieldCodes: [fieldCode], groupCodes }
  // platform: {
  //   createDialog(config): Promise<{show, close}>
  //     (kintone.createDialog/kintone.mobile.createBottomSheetと同一シグネチャ),
  //   showLoading(): void, hideLoading(): void,
  //   getQueryCondition(): string,
  // }
  const runBulk = async (config, appId, platform) => {
    const formFields = await kintone.app.getFormFields();

    // 対象フィールドがフォームから削除された、または対象外の型に変更された場合は除外する
    // (idea.md「エッジケース」参照)。
    const targetFields = config.targetFieldCodes
      .map((code) => formFields[code])
      .filter((field) => field && NS.FieldEligibility.isEligibleField(field));

    if (targetFields.length === 0) {
      global.alert(
        '対象フィールドがすべてフォームから削除されているため、実行できません。プラグインの設定を見直してください。',
      );
      return;
    }

    const query = platform.getQueryCondition();
    const recordNumberFieldCode = findRecordNumberFieldCode(formFields);
    // 書き戻す値はダイアログで都度入力するため、カーソルのfieldsには$id・$revision・
    // (あれば)レコード番号フィールドのみ指定し、対象フィールド自体の現在値は取得しない。
    const fields = ['$id', '$revision'];
    if (recordNumberFieldCode) {
      fields.push(recordNumberFieldCode);
    }

    // カーソル作成(POST)はここで1回だけ行う。totalCountは作成時点のレスポンスで
    // 得られるため、確認ダイアログの表示にはこれで十分で、レコード本体の列挙(GET)は
    // 確認後まで行わない。
    let cursorPromise = null;
    const createCursorOnce = () => {
      if (!cursorPromise) {
        cursorPromise = createCursor(appId, query, fields);
      }
      return cursorPromise;
    };

    let totalCount;
    try {
      ({ totalCount } = await createCursorOnce());
    } catch (err) {
      global.alert(`対象レコードの検索に失敗しました: ${err.message}`);
      return;
    }

    if (Number(totalCount) === 0) {
      global.alert('対象レコードがありません。');
      return;
    }

    const message = NS.BuildConfirmMessage.buildConfirmMessage({
      targetCount: totalCount,
      query,
    });
    const { wrapper, readers, errorEl } = buildConfirmDialogBody(
      message,
      targetFields,
    );

    let pendingTargets = null;
    const dialog = await platform.createDialog({
      title: '一括更新の実行確認',
      body: wrapper,
      showOkButton: true,
      okButtonText: '実行',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
      beforeClose: (action) => {
        if (action !== 'OK') {
          return true;
        }
        const targets = targetFields.map((field) => ({
          fieldCode: field.code,
          value: readers[field.code](),
        }));
        const { valid, errors } = NS.ExecutionValidation.validateTargetValues(
          targets,
          formFields,
        );
        if (!valid) {
          errorEl.textContent = errors.join('\n');
          errorEl.hidden = false;
          return false;
        }
        pendingTargets = targets;
        return true;
      },
    });
    const dialogResult = await dialog.show();
    if (dialogResult !== 'OK' || !pendingTargets) {
      return;
    }

    const { patch } = NS.RecordPatchBuilder.buildPatch(
      pendingTargets,
      formFields,
    );

    enableUnloadGuard();
    platform.showLoading();
    try {
      const { records: targetRecords } = await NS.CursorEnumerator.enumerateAll(
        {
          createCursor: createCursorOnce,
          getCursor: (id) => getCursorPage(id),
          deleteCursor: (id) => deleteCursor(id),
        },
      );

      const writeRecords = targetRecords.map((record) => ({
        id: record.$id.value,
        recordNumber: recordNumberFieldCode
          ? record[recordNumberFieldCode].value
          : record.$id.value,
        revision: record.$revision.value,
        record: patch,
      }));

      const writeResult = await NS.BatchWriter.runAll(writeRecords, {
        putBatch: (chunk) => putBatch(appId, chunk),
        putSingle: (record) => putSingle(appId, record),
      });

      const summary = NS.BatchWriter.buildResultSummary({
        totalTarget: writeRecords.length,
        updatedCount: writeResult.updatedCount,
        skipped: writeResult.skipped,
      });
      global.alert(summary);
    } catch (err) {
      global.alert(`更新を中止しました: ${err.message}`);
    } finally {
      platform.hideLoading();
      disableUnloadGuard();
    }
  };

  // 一覧画面ヘッダーに、対象グループのメンバーにだけボタンを表示する。
  // kintone.user.getGroups()はクライアント側の表示ゲートに過ぎず、真の権限境界ではない
  // (真の境界は対象アプリ・対象フィールド自体のkintoneレコード/フィールドアクセス権。
  // security-checklist.md参照)。
  const renderButtonIfAuthorized = async (
    headerEl,
    config,
    appId,
    platform,
  ) => {
    if (!headerEl || headerEl.dataset.bfuButtonRendered) {
      return;
    }
    if (
      !config.targetFieldCodes ||
      config.targetFieldCodes.length === 0 ||
      !config.groupCodes ||
      config.groupCodes.length === 0
    ) {
      return;
    }

    const groups = await kintone.user.getGroups();
    const isAuthorized = groups.some((g) => config.groupCodes.includes(g.code));
    if (!isAuthorized) {
      return;
    }

    // headerElはconstパラメーターであり、await後に再代入され得ないためrequire-atomic-updatesは誤検知。
    // eslint-disable-next-line require-atomic-updates
    headerEl.dataset.bfuButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal bfu-bulk-button';
    button.textContent = 'フィールドを一括更新';
    button.addEventListener('click', () => {
      button.disabled = true;
      runBulk(config, appId, platform).finally(() => {
        button.disabled = false;
      });
    });
    headerEl.appendChild(button);
  };

  NS.BulkUpdate = {
    runBulk,
    renderButtonIfAuthorized,
    findRecordNumberFieldCode,
  };
})(window, kintone);
