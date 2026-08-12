(function (root) {
  'use strict';

  // REST APIを使わずJavaScript APIのみで実現する方針(idea.md参照)のため、レコードは
  // app.record.index.show の event.records(現在ページ分)のみを対象とする。
  // 一覧の1ページあたりの表示件数は最大500件まで管理者が設定できるため、本プラグインは
  // 描画対象を先頭MAX_RECORDS件に自主的に打ち切り、打ち切りの有無をUIに明示する。

  const MAX_RECORDS = 100;

  const capRecords = (records) => {
    const list = records || [];
    const total = list.length;
    return {
      records: list.slice(0, MAX_RECORDS),
      total,
      truncated: total > MAX_RECORDS,
      max: MAX_RECORDS,
    };
  };

  const RecordCap = { MAX_RECORDS, capRecords };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordCap;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.RecordCap = RecordCap;
  }
})(typeof window !== 'undefined' ? window : globalThis);
