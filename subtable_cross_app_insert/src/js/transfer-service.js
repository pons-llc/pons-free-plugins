(function (global) {
  'use strict';

  // 発動条件の判定・対象行の絞り込み・RestClientの呼び出しを束ねるオーケストレーション層。
  // kintoneオブジェクトには直接依存しない(依存するのはRestClient/ConditionEngine経由)ため
  // ユニットテストしやすい形にしているが、kintoneのレコード形式に依存するため
  // Puppeteerによる実環境テスト(CLAUDE.md項目6)で検証する対象とする。

  const NS = global.SubtableCrossAppInsert;

  const getRows = (config, sourceRecord) => {
    const field = sourceRecord[config.subtableCode];
    return field && Array.isArray(field.value) ? field.value : [];
  };

  const shouldTrigger = (config, sourceRecord) =>
    NS.ConditionEngine.evaluate(config.condition, sourceRecord);

  // 保存(submit)時の転送。呼び出し元(desktop.js)がevent.recordをsourceRecordとして渡す。
  // 転送成功時アクションが有効な場合、同一のsourceRecordオブジェクトを書き換えて返す
  // (submitイベント内でevent.recordを書き換えれば、追加のREST呼び出しなしで同一保存に含まれるため)。
  // 転送に失敗した場合は例外を投げる。呼び出し元はこれを捕捉してevent.errorをセットし、保存を中止すること。
  const runOnSubmit = async (config, sourceRecord) => {
    if (!shouldTrigger(config, sourceRecord)) {
      return { triggered: false, transferredRowCount: 0 };
    }
    const rows = getRows(config, sourceRecord);
    if (rows.length === 0) {
      return { triggered: true, transferredRowCount: 0 };
    }

    const result = await NS.RestClient.pushRows(config, sourceRecord, rows);

    if (config.successActionEnabled && config.successActionFieldCode) {
      sourceRecord[config.successActionFieldCode] = sourceRecord[
        config.successActionFieldCode
      ] || {
        value: '',
      };
      sourceRecord[config.successActionFieldCode].value =
        config.successActionValue;
    }

    return { triggered: true, transferredRowCount: result.transferredRowCount };
  };

  // 手動転送(kintone.createDialog経由)。selectedRowIds が渡されればその行のみ、
  // 渡されなければ(null/undefined)全行を対象にする。
  // 発動条件(condition)は保存時専用のゲートのため、手動転送では評価しない
  // (ユーザーが明示的にダイアログを開いて操作した時点で意思表示済みとみなす)。
  const runManual = async (config, sourceRecord, selectedRowIds) => {
    const allRows = getRows(config, sourceRecord);
    const rows = selectedRowIds
      ? allRows.filter((row) => selectedRowIds.includes(row.id))
      : allRows;
    if (rows.length === 0) {
      return { transferredRowCount: 0 };
    }
    const result = await NS.RestClient.pushRows(config, sourceRecord, rows);
    return { transferredRowCount: result.transferredRowCount };
  };

  NS.TransferService = { getRows, shouldTrigger, runOnSubmit, runManual };
})(window);
