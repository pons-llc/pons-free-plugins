(function (global, kintone) {
  'use strict';

  // ドラッグ&ドロップでの日時変更を反映する、唯一のREST API利用箇所。
  // 任意のレコード(現在編集画面を開いていないレコード)を更新するJavaScript APIは
  // 存在しないため、kintone.api()経由でPUT /k/v1/record.jsonを呼び出す(idea.md参照)。
  // 生のfetch/XMLHttpRequestは使用しない。

  const updateRecord = (appId, recordId, revision, record) => {
    const body = { app: appId, id: recordId, record };
    if (revision !== null && revision !== undefined && revision !== '') {
      body.revision = revision;
    }
    return kintone.api(kintone.api.url('/k/v1/record.json', true), 'PUT', body);
  };

  global.CalendarView = global.CalendarView || {};
  global.CalendarView.RecordUpdate = { updateRecord };
})(window, kintone);
