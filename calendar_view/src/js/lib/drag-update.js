(function (root, deps) {
  'use strict';

  // ドラッグ&ドロップの移動量から、更新後の開始/終了日時・グループ値を計算し、
  // PUT /k/v1/record.json 用のリクエストボディ(record部分)を組み立てる。
  // 実際のkintone.api()呼び出しはjs/record-update.jsで行う(こちらは純粋計算のみ)。

  // 日表示: 時刻の移動量(分、既に15分スナップ済み) + グループの移動先(任意)。
  const applyDayDrag = (evt, deltaMinutes, newGroupKey) => {
    const durationMs = evt.end.getTime() - evt.start.getTime();
    const start = new Date(evt.start.getTime() + deltaMinutes * 60000);
    const end = new Date(start.getTime() + durationMs);
    return {
      start,
      end,
      groupKey: newGroupKey === undefined ? evt.groupKey : newGroupKey,
    };
  };

  // 週表示: 日数の移動量(曜日セルをまたいだ数)。時刻は保持する。
  const applyWeekDrag = (evt, deltaDays) => {
    const durationMs = evt.end.getTime() - evt.start.getTime();
    const start = new Date(
      evt.start.getTime() + deltaDays * 24 * 60 * 60 * 1000,
    );
    const end = new Date(start.getTime() + durationMs);
    return { start, end, groupKey: evt.groupKey };
  };

  // config: { startFieldCode, endFieldCode, groupFieldCode }
  // formFields: kintone.app.getFormFields()の戻り値
  // result: applyDayDrag/applyWeekDragの戻り値
  // newGroupValue: グループフィールドへ書き戻す実際の値(ドロップダウン等は文字列、
  //   ユーザー選択等は[{code}]形式。呼び出し側でフィールド型に応じて組み立てて渡す)
  const buildUpdateRecord = (config, formFields, result, newGroupValue) => {
    const record = {};
    const startType = formFields[config.startFieldCode].type;
    record[config.startFieldCode] = {
      value: deps.formatForFieldType(result.start, startType),
    };
    if (config.endFieldCode) {
      const endType = formFields[config.endFieldCode].type;
      record[config.endFieldCode] = {
        value: deps.formatForFieldType(result.end, endType),
      };
    }
    if (config.groupFieldCode && newGroupValue !== undefined) {
      record[config.groupFieldCode] = { value: newGroupValue };
    }
    return record;
  };

  // グループ軸の移動先(groupKey、文字列)を、フィールド型に応じたkintoneの書き込み値形式へ変換する。
  // USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECT は [{ code }] 形式の配列(nameは書き込み不要)、
  // DROP_DOWN/RADIO_BUTTON は文字列そのもの。
  const SELECT_ARRAY_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
  ];
  const formatGroupValue = (groupKey, fieldType) => {
    if (SELECT_ARRAY_TYPES.includes(fieldType)) {
      return groupKey ? [{ code: groupKey }] : [];
    }
    return groupKey || '';
  };

  const DragUpdate = {
    applyDayDrag,
    applyWeekDrag,
    buildUpdateRecord,
    formatGroupValue,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragUpdate;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.DragUpdate = DragUpdate;
  }
})(
  typeof window !== 'undefined' ? window : globalThis,
  typeof module !== 'undefined' && module.exports
    ? {
        formatForFieldType: require('./kintone-date-format').formatForFieldType,
      }
    : {
        formatForFieldType: (typeof window !== 'undefined'
          ? window
          : globalThis
        ).CalendarView.KintoneDateFormat.formatForFieldType,
      },
);
