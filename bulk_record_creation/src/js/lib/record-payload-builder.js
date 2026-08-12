(function (root) {
  'use strict';

  // テンプレート値×対象者×日付の直積から、POST /k/v1/records.json用のrecords配列を組み立てる
  // (純粋関数)。idea.md「生成されるレコード数(直積)」参照。

  const cloneJson = (value) => JSON.parse(JSON.stringify(value));

  // 対象者/日付のどちらか一方(または両方)が未指定の場合は、その次元を「1件だけの
  // プレースホルダー」として扱うことで、常に同じ二重ループで直積を表現できるようにする。
  const NO_DIMENSION = [undefined];

  // buildRecords({
  //   templatePatch: { フィールドコード: { value } , ... },  // 全レコード共通のテンプレート値
  //   assignee: { fieldCode, entries: [{ code, name }, ...] } | undefined,
  //     // USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECTいずれも書き込み値の形は同じ([{code}])
  //     // のため、対象者の種類(ユーザー/組織/グループ)はこの関数では区別しない。
  //   dates: {
  //     fieldCode, values: ['YYYY-MM-DD', ...],
  //     endFieldCode, endValues: [...],  // 任意。終了日時フィールド(idea.md「終了日時
  //       // フィールド」参照)。valuesと同じ添字で対になっており、対象者×日付のような
  //       // 独立した直積の次元にはしない(1つの日付枠に対して開始・終了の2フィールドへ
  //       // 書き込むだけ)。
  //   } | undefined,
  // }) => [{ フィールドコード: { value } , ... }, ...]
  const buildRecords = ({ templatePatch, assignee, dates } = {}) => {
    const assigneeEntries = assignee ? assignee.entries : NO_DIMENSION;
    const dateValues = dates ? dates.values : NO_DIMENSION;

    const records = [];
    assigneeEntries.forEach((assigneeEntry) => {
      dateValues.forEach((dateValue, dateIndex) => {
        const record = cloneJson(templatePatch || {});
        if (assignee && assigneeEntry) {
          record[assignee.fieldCode] = {
            value: [{ code: assigneeEntry.code }],
          };
        }
        if (dates && dateValue) {
          record[dates.fieldCode] = { value: dateValue };
          if (dates.endFieldCode) {
            record[dates.endFieldCode] = { value: dates.endValues[dateIndex] };
          }
        }
        records.push(record);
      });
    });
    return records;
  };

  const RecordPayloadBuilder = { buildRecords };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordPayloadBuilder;
  } else {
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.RecordPayloadBuilder = RecordPayloadBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
