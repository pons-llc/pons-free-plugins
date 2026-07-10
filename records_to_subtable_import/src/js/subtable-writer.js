(function (global) {
  'use strict';

  // サブテーブルへの書き込みは、kintone.app.record.get()/set()(またはモバイル版)のみで完結させ、
  // 対象アプリ自身へのREST書き込みは行わない(既存行の扱いは全置換=確定仕様)。
  // 保存(サーバーへの反映)はユーザーが画面で【保存】を押すまで行われない。

  const NS = global.RecordsToSubtable;

  // recordApiは kintone.app.record または kintone.mobile.app.record を呼び出し側から渡してもらう
  // (desktop.js/mobile.jsで共通のロジックを再利用するため)。
  const replaceSubtableRows = (recordApi, subtableFieldCode, rows) => {
    recordApi.set({
      record: {
        [subtableFieldCode]: { value: rows },
      },
    });
  };

  NS.SubtableWriter = { replaceSubtableRows };
})(window);
