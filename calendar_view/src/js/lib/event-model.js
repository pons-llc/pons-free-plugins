(function (root, deps) {
  'use strict';

  // レコード配列(最大100件に打ち切り済み)+ 一覧設定 + フォーム項目定義から、
  // カレンダー描画用のイベントオブジェクト配列へ変換する。
  //
  // 開始日時フィールドの型がDATEのみの場合は終日イベントとして扱う。
  // 終了日時フィールドが未設定/値なしの場合は、DATETIME起点なら1時間、DATE起点なら1日の
  // 既定幅を補う(gantt_chart_viewの「終了日未設定→開始日と同じ1日」と同じ考え方)。

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const parseDate = (field) => {
    if (
      !field ||
      field.value === null ||
      field.value === undefined ||
      field.value === ''
    ) {
      return null;
    }
    const date = new Date(field.value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  // グループの同一性判定に使うキー。ユーザー選択等の配列値は先頭要素のcodeを使う
  // (gantt_chart_viewのグループ分けは「作業者(先頭1名)」相当の扱いを踏襲)。
  const groupKeyOf = (field) => {
    if (!field || field.value === null || field.value === undefined) {
      return '';
    }
    const value = field.value;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '';
      }
      const first = value[0];
      return typeof first === 'object' ? first.code || '' : String(first);
    }
    return String(value);
  };

  const buildEvents = (records, config, formFields) => {
    const startField = formFields[config.startFieldCode];
    const allDay = startField && startField.type === 'DATE';
    const defaultDurationMs = allDay ? ONE_DAY_MS : ONE_HOUR_MS;

    const events = [];
    (records || []).forEach((record) => {
      const start = parseDate(record[config.startFieldCode]);
      if (!start) {
        // 開始日時が未入力のレコードは描画対象外(idea.mdの対象フィールド仕様)。
        return;
      }
      let end = config.endFieldCode
        ? parseDate(record[config.endFieldCode])
        : null;
      if (!end || end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + defaultDurationMs);
      }

      const groupField = config.groupFieldCode
        ? record[config.groupFieldCode]
        : null;
      const groupKey = groupField ? groupKeyOf(groupField) : '';
      const groupLabel = groupField ? deps.formatFieldValue(groupField) : '';

      // 色分けフィールド(STATUS/DROP_DOWN/RADIO_BUTTON、いずれもスカラー値)が設定されて
      // いればそれを色分けキーとして使う。未設定ならグループ分けキーにフォールバックする
      // (従来どおり、週表示でもグループごとに色分けされる)。
      const colorField = config.colorFieldCode
        ? record[config.colorFieldCode]
        : null;
      const colorKey = colorField ? groupKeyOf(colorField) : groupKey;
      const colorLabel = colorField
        ? deps.formatFieldValue(colorField)
        : groupLabel;

      events.push({
        recordId: record.$id ? record.$id.value : null,
        revision: record.$revision ? record.$revision.value : null,
        title: deps.formatFieldValue(record[config.titleFieldCode]),
        hoverLines: (config.hoverFieldCodes || []).map((code) => {
          const label = formFields[code] ? formFields[code].label : code;
          return `${label}: ${deps.formatFieldValue(record[code])}`;
        }),
        groupKey,
        groupLabel,
        colorKey,
        colorLabel,
        start,
        end,
        allDay: Boolean(allDay),
      });
    });
    return events;
  };

  const EventModel = { buildEvents, groupKeyOf };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventModel;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.EventModel = EventModel;
  }
})(
  typeof window !== 'undefined' ? window : globalThis,
  typeof module !== 'undefined' && module.exports
    ? { formatFieldValue: require('./format-field-value').formatFieldValue }
    : {
        formatFieldValue: (typeof window !== 'undefined' ? window : globalThis)
          .CalendarView.FormatFieldValue.formatFieldValue,
      },
);
