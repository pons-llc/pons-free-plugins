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
    const kind = NS.FieldEligibility.inputKindOf(field);
    const builder = CONTROL_BUILDERS[kind] || buildTextControl;
    return builder(field);
  };

  const isLookupRefreshField = (field) =>
    NS.FieldEligibility.inputKindOf(field) === 'LOOKUP_REFRESH';

  // ルックアップフィールドの行には値の入力欄を出さない。現在の値をそのまま書き戻すことで
  // kintone側の自動転記(ルックアップの「ほかのフィールドのコピー」)が再実行され、関連レコードの
  // 最新情報にコピー先フィールドが更新される(idea.md「ルックアップフィールドの再取得」参照。
  // kintone公式Tips「ルックアップの更新を自動で行う」で、値を書き戻すだけで最新の関連情報が
  // 反映されることを確認済み)。
  const buildLookupRefreshNote = () => {
    const noteEl = document.createElement('p');
    noteEl.className = 'bfu-lookup-note';
    noteEl.textContent =
      '現在の値のまま更新します(値の入力はありません。関連レコードの情報を再取得します)。';
    return noteEl;
  };

  // 確認ダイアログの1フィールド分の行を組み立てる。「更新する」チェックボックスはフィールド名の
  // 横に置き、型を問わず共通。その下にフィールド種別に応じた本文(値の入力欄、またはルックアップの
  // 再取得を示す注記)を配置する。チェックを外したフィールドはrecordパッチに含めない
  // (kintoneのPUT APIはリクエストに含めたフィールドのみを更新するため、含めない=既存の値のまま
  // 変更しない、という挙動になる。idea.md「対象フィールドの一部を今回の実行から除外する」参照)。
  const buildConfirmRow = (field, readers) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'bfu-confirm-row';

    const headerEl = document.createElement('div');
    headerEl.className = 'bfu-row-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'bfu-field-name';
    nameEl.textContent = field.required ? `${field.label}(必須)` : field.label;
    headerEl.appendChild(nameEl);

    const includeLabelEl = document.createElement('label');
    includeLabelEl.className = 'bfu-row-include-label';
    const includeCheckboxEl = document.createElement('input');
    includeCheckboxEl.type = 'checkbox';
    includeCheckboxEl.className = 'bfu-row-include';
    includeCheckboxEl.checked = true;
    includeLabelEl.appendChild(includeCheckboxEl);
    includeLabelEl.appendChild(document.createTextNode('更新する'));
    headerEl.appendChild(includeLabelEl);

    rowEl.appendChild(headerEl);

    if (isLookupRefreshField(field)) {
      rowEl.appendChild(buildLookupRefreshNote());

      includeCheckboxEl.addEventListener('change', () => {
        rowEl.classList.toggle('is-excluded', !includeCheckboxEl.checked);
      });
    } else {
      const { el, read } = buildValueControl(field);
      readers[field.code] = read;
      rowEl.appendChild(el);

      includeCheckboxEl.addEventListener('change', () => {
        const disabled = !includeCheckboxEl.checked;
        rowEl
          .querySelectorAll('.bfu-value-input, .bfu-checkbox-group input')
          .forEach((inputEl) => {
            inputEl.disabled = disabled;
          });
        rowEl.classList.toggle('is-excluded', disabled);
      });
    }

    return { rowEl, includeCheckboxEl };
  };

  // 確認ダイアログの本文Elementを組み立てる。createDialog/createBottomSheetのconfig.bodyは
  // そのままダイアログへ組み込まれる仕様のため、ユーザー入力をHTML文字列として組み立てず、
  // createElement/textContentのみで構築する(secureCodingGuideline「外部からの入力値を使用した
  // 要素の生成を避ける」)。
  const buildConfirmDialogBody = (message, targetFields) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bfu-confirm-body';

    const messageEl = document.createElement('p');
    messageEl.className = 'bfu-confirm-message';
    messageEl.textContent = message;
    wrapper.appendChild(messageEl);

    const readers = {};
    const includeCheckboxes = {};
    targetFields.forEach((field) => {
      const { rowEl, includeCheckboxEl } = buildConfirmRow(field, readers);
      includeCheckboxes[field.code] = includeCheckboxEl;
      wrapper.appendChild(rowEl);
    });

    const errorEl = document.createElement('p');
    errorEl.className = 'bfu-value-error';
    errorEl.hidden = true;
    wrapper.appendChild(errorEl);

    return { wrapper, readers, includeCheckboxes, errorEl };
  };

  // 最終確認ダイアログの本文Elementを組み立てる。1つ目のダイアログで確定した値をあらためて
  // 一覧表示し、対象件数・絞り込み条件とあわせて実行前に見直せるようにする(ユーザーからの
  // 要望: 最終確認のモーダルを追加してほしい)。
  const buildFinalConfirmBody = (message, summaries) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bfu-confirm-body';

    const messageEl = document.createElement('p');
    messageEl.className = 'bfu-confirm-message';
    messageEl.textContent = message;
    wrapper.appendChild(messageEl);

    const listEl = document.createElement('ul');
    listEl.className = 'bfu-final-summary-list';
    summaries.forEach((summary) => {
      const itemEl = document.createElement('li');
      itemEl.textContent = `${summary.label}: ${summary.valueLabel}`;
      listEl.appendChild(itemEl);
    });
    wrapper.appendChild(listEl);

    return wrapper;
  };

  // 1つ目のダイアログ(値の入力・対象フィールドの絞り込み)を表示し、OK確定時の内容
  // (フィールド未選択・必須未入力等のバリデーション込み)を返す。値を入力するフィールドは
  // { fieldCode, value }の配列(targets)、ルックアップフィールド(値の入力欄が無く、現在の値を
  // そのまま書き戻す)はフィールドコードの配列(lookupRefreshFieldCodes)として分けて返す。
  // キャンセル/クローズ、または未確定の場合はnullを返す。
  const showValueInputDialog = async (
    platform,
    message,
    targetFields,
    formFields,
  ) => {
    const { wrapper, readers, includeCheckboxes, errorEl } =
      buildConfirmDialogBody(message, targetFields);

    let pendingResult = null;
    const dialog = await platform.createDialog({
      title: '一括更新の実行確認',
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
        // チェックを外したフィールドは今回の実行対象から除外する(recordパッチに含めない
        // = 既存の値のまま変更しない。idea.md参照)。
        const includedFields = targetFields.filter(
          (field) => includeCheckboxes[field.code].checked,
        );
        if (includedFields.length === 0) {
          errorEl.textContent = '更新するフィールドを1つ以上選択してください。';
          errorEl.hidden = false;
          return false;
        }
        const valueFields = includedFields.filter(
          (field) => !isLookupRefreshField(field),
        );
        const lookupRefreshFieldCodes = includedFields
          .filter(isLookupRefreshField)
          .map((field) => field.code);
        const targets = valueFields.map((field) => ({
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
        pendingResult = { targets, lookupRefreshFieldCodes };
        return true;
      },
    });
    const dialogResult = await dialog.show();
    return dialogResult === 'OK' ? pendingResult : null;
  };

  // 最終確認ダイアログ(1つ目のダイアログで確定した値の見直し)を表示し、
  // 実行が確定したかどうかを返す。
  const showFinalConfirmDialog = async (
    platform,
    message,
    targets,
    lookupRefreshFieldCodes,
    formFields,
  ) => {
    const { summaries } = NS.ValueSummary.buildTargetSummaries(
      targets,
      formFields,
    );
    const lookupSummaries = lookupRefreshFieldCodes.map((code) => ({
      fieldCode: code,
      label: (formFields[code] || {}).label || code,
      valueLabel: '現在の値のまま更新(関連レコードを再取得)',
    }));
    const finalDialog = await platform.createDialog({
      title: '最終確認',
      body: buildFinalConfirmBody(message, [...summaries, ...lookupSummaries]),
      showOkButton: true,
      okButtonText: '実行',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
    });
    const finalDialogResult = await finalDialog.show();
    return finalDialogResult === 'OK';
  };

  // 対象フィールドがフォームから削除された、対象外の型に変更された、または新たに
  // ルックアップフィールドのコピー先に指定された場合は除外する(idea.md「エッジケース」参照)。
  // listEligibleFields()は設定画面と同じ基準(isEligibleField()に加えてルックアップの
  // コピー先フィールドの除外)で判定するため、config.targetFieldCodesの保存後にフォームが
  // 変更されていても実行時点の最新の状態で再判定できる。
  const resolveTargetFields = (config, formFields) => {
    const eligibleFieldsByCode = {};
    NS.FieldEligibility.listEligibleFields(formFields).forEach((field) => {
      eligibleFieldsByCode[field.code] = field;
    });
    return config.targetFieldCodes
      .map((code) => eligibleFieldsByCode[code])
      .filter(Boolean);
  };

  // config: { targetFieldCodes: [fieldCode], groupCodes }
  // platform: {
  //   createDialog(config): Promise<{show, close}>
  //     (kintone.createDialog/kintone.mobile.createBottomSheetと同一シグネチャ),
  //   showLoading(): void, hideLoading(): void,
  //   getQueryCondition(): string,
  // }
  // カーソルのfieldsパラメーターを組み立てる。書き戻す値はダイアログで都度入力するため、
  // カーソルのfieldsには対象フィールド自体の現在値は基本不要だが、ルックアップフィールド
  // (現在の値のままレコードごとに書き戻して再取得する)だけは例外的に現在値が必要になる。
  // ダイアログでどのフィールドを含めるかはこの時点ではまだ確定していない(カーソルはダイアログ
  // より前に作成する)ため、ルックアップの対象候補すべての現在値をあらかじめ取得しておく。
  const buildCursorFields = (targetFields, recordNumberFieldCode) => {
    const lookupRefreshCandidateCodes = targetFields
      .filter(isLookupRefreshField)
      .map((field) => field.code);
    const fields = ['$id', '$revision', ...lookupRefreshCandidateCodes];
    if (recordNumberFieldCode) {
      fields.push(recordNumberFieldCode);
    }
    return fields;
  };

  const runBulk = async (config, appId, platform) => {
    const formFields = await kintone.app.getFormFields();
    const targetFields = resolveTargetFields(config, formFields);

    if (targetFields.length === 0) {
      global.alert(
        '対象フィールドがすべてフォームから削除されているため、実行できません。プラグインの設定を見直してください。',
      );
      return;
    }

    const query = platform.getQueryCondition();
    const recordNumberFieldCode = findRecordNumberFieldCode(formFields);
    const fields = buildCursorFields(targetFields, recordNumberFieldCode);

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

    const inputResult = await showValueInputDialog(
      platform,
      message,
      targetFields,
      formFields,
    );
    if (!inputResult) {
      return;
    }
    const { targets: pendingTargets, lookupRefreshFieldCodes } = inputResult;

    // 最終確認ダイアログ: 確定した値を一覧であらためて見直してから実行できるようにする
    // (ユーザーからの要望: 最終確認のモーダルを追加してほしい)。
    const confirmed = await showFinalConfirmDialog(
      platform,
      message,
      pendingTargets,
      lookupRefreshFieldCodes,
      formFields,
    );
    if (!confirmed) {
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

      // ルックアップフィールドはレコードごとに現在の値をそのまま書き戻す(全レコード共通の
      // patchとは異なり、レコードごとに異なる値になり得るため個別に組み立てる)。
      const writeRecords = targetRecords.map((record) => {
        const recordPatch = { ...patch };
        lookupRefreshFieldCodes.forEach((code) => {
          recordPatch[code] = { value: record[code] ? record[code].value : '' };
        });
        return {
          id: record.$id.value,
          recordNumber: recordNumberFieldCode
            ? record[recordNumberFieldCode].value
            : record.$id.value,
          revision: record.$revision.value,
          record: recordPatch,
        };
      });

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
