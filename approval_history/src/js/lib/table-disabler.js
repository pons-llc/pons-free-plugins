(function (root) {
  'use strict';

  // kintoneのイベントオブジェクトの`disabled`プロパティは、テーブル自体ではなく個々のフィールド
  // (テーブルの行内のフィールドを含む)に対してのみ有効(kintoneドキュメント「イベントオブジェクトで
  // 実行できる操作」のサンプルコードもすべて行内フィールド単位)。`table.disabled = true`のように
  // SUBTABLEフィールド自体へ設定しても無視される(実機検証済み)ため、既存の全行の内包フィールドを
  // 1つずつdisabledにする。
  const disableAllRows = (table) => {
    if (!table || !Array.isArray(table.value)) {
      return;
    }
    table.value.forEach((row) => {
      Object.keys(row.value).forEach((code) => {
        row.value[code].disabled = true;
      });
    });
  };

  const TableDisabler = { disableAllRows };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TableDisabler;
  } else {
    root.ApprovalHistory = root.ApprovalHistory || {};
    root.ApprovalHistory.TableDisabler = TableDisabler;
  }
})(typeof window !== 'undefined' ? window : globalThis);
