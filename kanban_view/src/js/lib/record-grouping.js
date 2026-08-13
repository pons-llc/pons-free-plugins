(function (root) {
  'use strict';

  // レコードをカンバンボードの列(グループ)ごとに分割する純粋ロジック。
  // idea.md「グループ分け(ボードの列)」参照。
  //
  // どちらのグループ分け方法でも、あらかじめ定義済みの列(選択肢/プロセスステータス)は
  // 該当レコードが0件でも列として残す(「未着手」等、レコードが無い列もボードの構造として
  // 見えている方がタスクボードとして自然なため)。定義に無い値・空値だけは、レコードが
  // 実際に存在する場合にのみ「その他」「未設定」列として末尾に追加する。

  const currentValueOf = (record, fieldCode) => {
    const field = record[fieldCode];
    return field ? field.value : undefined;
  };

  const isBlank = (value) =>
    value === undefined || value === null || value === '';

  // options: [{ code, label }]  (js/lib/field-lookup.js の optionsOf() の戻り値、index順)
  const groupRecordsByField = (records, fieldCode, options) => {
    const byOption = new Map(
      (options || []).map((opt) => [
        opt.code,
        { key: opt.code, label: opt.label, records: [] },
      ]),
    );
    const otherRecords = [];
    const unsetRecords = [];

    (records || []).forEach((record) => {
      const value = currentValueOf(record, fieldCode);
      if (isBlank(value)) {
        unsetRecords.push(record);
      } else if (byOption.has(value)) {
        byOption.get(value).records.push(record);
      } else {
        otherRecords.push(record);
      }
    });

    const columns = (options || []).map((opt) => byOption.get(opt.code));
    if (otherRecords.length > 0) {
      columns.push({
        key: '__OTHER__',
        label: 'その他',
        records: otherRecords,
      });
    }
    if (unsetRecords.length > 0) {
      columns.push({
        key: '__UNSET__',
        label: '未設定',
        records: unsetRecords,
      });
    }
    return columns;
  };

  // statusSettings: kintone.app.getStatus()の戻り値そのもの({ enable, states, actions })
  const groupRecordsByStatus = (records, statusFieldCode, statusSettings) => {
    const states = (statusSettings && statusSettings.states) || {};
    const stateNames = Object.keys(states).sort(
      (a, b) => Number(states[a].index) - Number(states[b].index),
    );

    const byStatus = new Map(stateNames.map((name) => [name, []]));
    const otherRecords = [];
    (records || []).forEach((record) => {
      const status = currentValueOf(record, statusFieldCode);
      if (byStatus.has(status)) {
        byStatus.get(status).push(record);
      } else {
        otherRecords.push(record);
      }
    });

    const columns = stateNames.map((name) => ({
      key: name,
      label: name,
      records: byStatus.get(name),
    }));
    if (otherRecords.length > 0) {
      columns.push({
        key: '__OTHER__',
        label: 'その他',
        records: otherRecords,
      });
    }
    return columns;
  };

  const RecordGrouping = { groupRecordsByField, groupRecordsByStatus };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordGrouping;
  } else {
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.RecordGrouping = RecordGrouping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
