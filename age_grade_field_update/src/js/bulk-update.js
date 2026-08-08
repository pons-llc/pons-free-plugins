(function (global, kintone) {
  'use strict';

  // 一覧画面からの一括更新の orchestration ロジック。PC・モバイル共通で使う
  // (kintone.showConfirmDialog/kintone.mobile.showConfirmBottomSheet、
  // kintone.showLoading/kintone.mobile.showLoadingはPC専用/モバイル専用APIのため、
  // platform引数として呼び出し元(desktop.js/mobile.js)から注入する)。
  const NS = global.AgeGradeFieldUpdate;

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
  // 「短時間で大量のリクエスト送信を避ける」を踏まえた最低限の実装、related_record_summaryと同じ)。
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

  // 確認ダイアログの本文Elementを組み立てる。書き込む値は編集可能な入力欄
  // (DATE型は<input type="date">、DATETIME型は<input type="datetime-local">)として表示し、
  // 既定値は「今日」(defaultValue)だが確定前に変更できる(idea.md「確認ダイアログ・実行」参照)。
  // createDialog/createBottomSheetのconfig.bodyはそのままダイアログへ組み込まれる仕様のため、
  // ユーザー入力をHTML文字列として組み立てず、createElement/textContentのみで構築する
  // (secureCodingGuideline「外部からの入力値を使用した要素の生成を避ける」)。
  const buildConfirmDialogBody = (message, inputType, defaultValue) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'agfu-confirm-body';

    const messageEl = document.createElement('p');
    messageEl.className = 'agfu-confirm-message';
    messageEl.textContent = message;
    wrapper.appendChild(messageEl);

    const labelEl = document.createElement('label');
    labelEl.className = 'agfu-value-label';
    labelEl.textContent = '書き込む値';

    const inputEl = document.createElement('input');
    inputEl.type = inputType;
    inputEl.className = 'agfu-value-input';
    inputEl.value = defaultValue;
    labelEl.appendChild(inputEl);
    wrapper.appendChild(labelEl);

    const errorEl = document.createElement('p');
    errorEl.className = 'agfu-value-error';
    errorEl.textContent = '値を入力してください。';
    errorEl.hidden = true;
    wrapper.appendChild(errorEl);

    return { wrapper, inputEl, errorEl };
  };

  // config: { targetFieldCode, query, groupCodes }
  // targetField: kintone.app.getFormFields()の対象フィールド定義({type, label, ...})
  // platform: { createDialog(config): Promise<{show, close}>(kintone.createDialog/
  //   kintone.mobile.createBottomSheetと同一シグネチャ), showLoading(): void, hideLoading(): void }
  const runBulk = async (config, appId, targetField, platform) => {
    const formFields = await kintone.app.getFormFields();
    const recordNumberFieldCode = findRecordNumberFieldCode(formFields);
    const fields = ['$id', '$revision', config.targetFieldCode];
    if (recordNumberFieldCode) {
      fields.push(recordNumberFieldCode);
    }

    // カーソル作成(POST)はここで1回だけ行う。totalCountは作成時点のレスポンスで
    // 得られるため、確認ダイアログの表示にはこれで十分で、レコード本体の列挙(GET)は
    // 確認後まで行わない(idea.md「確認ダイアログ・実行」参照)。createCursorOnceで
    // Promiseをメモ化し、CursorEnumerator.enumerateAllに渡しても再作成されないようにする。
    let cursorPromise = null;
    const createCursorOnce = () => {
      if (!cursorPromise) {
        cursorPromise = createCursor(appId, config.query, fields);
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

    const inputType = targetField.type === 'DATE' ? 'date' : 'datetime-local';
    const defaultValue = NS.CurrentValueFormatter.defaultInputValue(
      new Date(),
      targetField.type,
    );
    const message = NS.BuildConfirmMessage.buildConfirmMessage({
      targetCount: totalCount,
      fieldLabel: targetField.label,
    });
    const { wrapper, inputEl, errorEl } = buildConfirmDialogBody(
      message,
      inputType,
      defaultValue,
    );

    const dialog = await platform.createDialog({
      title: `${targetField.label}を更新`,
      body: wrapper,
      showOkButton: true,
      okButtonText: '実行',
      showCancelButton: true,
      cancelButtonText: 'キャンセル',
      showCloseButton: true,
      beforeClose: (action) => {
        if (action === 'OK' && !inputEl.value) {
          errorEl.hidden = false;
          return false;
        }
        return true;
      },
    });
    const dialogResult = await dialog.show();
    if (dialogResult !== 'OK') {
      return;
    }

    // beforeCloseでOK確定時の未入力は弾いているため、finalValueがnullになることは
    // 通常ないが、呼び出し順序への依存を減らすため念のためガードする。
    const finalValue = NS.CurrentValueFormatter.valueFromInput(
      inputEl.value,
      targetField.type,
    );
    if (finalValue === null) {
      return;
    }

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
        record: { [config.targetFieldCode]: { value: finalValue } },
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
  // idea.md「実行可能グループによる表示制御」・security-checklist.md参照)。
  const renderButtonIfAuthorized = async (
    headerEl,
    config,
    appId,
    platform,
  ) => {
    if (!headerEl || headerEl.dataset.agfuButtonRendered) {
      return;
    }
    if (
      !config.targetFieldCode ||
      !config.groupCodes ||
      config.groupCodes.length === 0
    ) {
      return;
    }

    const formFields = await kintone.app.getFormFields();
    const targetField = formFields[config.targetFieldCode];
    // 対象フィールドがフォームから削除された、またはDATE/DATETIME以外に変更された場合は
    // ボタン自体を表示しない(idea.md「エッジケース」参照)。
    if (
      !targetField ||
      (targetField.type !== 'DATE' && targetField.type !== 'DATETIME')
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
    headerEl.dataset.agfuButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal agfu-bulk-button';
    button.textContent = `${targetField.label}を更新`;
    button.addEventListener('click', () => {
      button.disabled = true;
      runBulk(config, appId, targetField, platform).finally(() => {
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
