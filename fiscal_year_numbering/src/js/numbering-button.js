(function (global) {
  'use strict';

  const NS = global.FiscalYearNumbering;

  const recordUrl = () => kintone.api.url('/k/v1/record.json', true);

  const persistNumber = (appId, recordId, revision, numberFieldCode, number) =>
    kintone.api(recordUrl(), 'PUT', {
      app: appId,
      id: recordId,
      revision,
      record: { [numberFieldCode]: { value: number } },
    });

  // 採番タイミングが「ボタン押下時」のときに、詳細画面に「採番する」ボタンを1つだけ描画する。
  // record/setRecordFnはdesktop.js/mobile.jsから渡す(PC/モバイルでrecord.set()のAPIが異なるため)。
  // setRecordFn呼び出しはボタンのclickハンドラー(kintone.events.on()のイベントハンドラーではない)
  // からのみ行うため、record.set()の「イベントハンドラー内では実行できません」制限には抵触しない。
  const renderIfNeeded = (headerEl, config, appId, recordId, revision, record, setRecordFn) => {
    if (!headerEl || headerEl.dataset.fynNumberButtonRendered) {
      return;
    }
    headerEl.dataset.fynNumberButtonRendered = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kintoneplugin-button-normal fyn-number-button';
    button.textContent = '採番する';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const number = await NS.NumberingService.computeNext(config, record, appId);
        await persistNumber(appId, recordId, revision, config.numberFieldCode, number);
        setRecordFn({ record: { [config.numberFieldCode]: { value: number } } });
        button.remove();
      } catch (err) {
        button.disabled = false;
        // eslint-disable-next-line no-alert
        global.alert(`採番に失敗しました: ${err.message}`);
      }
    });
    headerEl.appendChild(button);
  };

  NS.NumberingButton = { renderIfNeeded };
})(window);
