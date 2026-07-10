(function (root) {
  'use strict';

  // グループ分けロジック。作業者/組織/ユーザー/ドロップダウン/ラジオボタンの各フィールドでグルーピングできる。
  // 開始日未設定(未仕訳)の行は、グループ分け設定によらず常に最下部の「未仕訳」グループへ振り分ける。

  // RecordModel.UNSCHEDULED_GROUP_KEY と同じ値。モジュール間の読み込み順に依存しないよう、
  // 値そのものをここでも定義する(record-model.js を変更する場合はこちらも合わせて変更すること)。
  const UNSCHEDULED_GROUP_KEY = '__unscheduled__';
  const UNSCHEDULED_GROUP_LABEL = '未仕訳';
  const UNSET_GROUP_LABEL = '(未設定)';

  const ALLOWED_GROUP_FIELD_TYPES = [
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'DROP_DOWN',
    'RADIO_BUTTON',
  ];

  const isGroupableField = (field) =>
    Boolean(field) && ALLOWED_GROUP_FIELD_TYPES.includes(field.type);

  // ユーザー/組織/グループ選択系フィールドは配列 [{code, name}, ...]、
  // ドロップダウン/ラジオボタンは文字列そのものが value になる。
  const resolveGroupKey = (record, fieldCode) => {
    if (!fieldCode || !record[fieldCode]) {
      return { key: '', label: UNSET_GROUP_LABEL };
    }
    const value = record[fieldCode].value;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { key: '', label: UNSET_GROUP_LABEL };
      }
      const first = value[0];
      if (first && typeof first === 'object') {
        return { key: first.code, label: first.name || first.code };
      }
      return { key: String(first), label: String(first) };
    }

    if (value === null || value === undefined || value === '') {
      return { key: '', label: UNSET_GROUP_LABEL };
    }
    return { key: String(value), label: String(value) };
  };

  // rows: RecordModel.buildRows() の戻り値
  // groupFieldCode: '' の場合はグループ分けなし(単一グループ)
  const groupRows = (rows, groupFieldCode) => {
    const scheduled = rows.filter((row) => !row.isUnscheduled);
    const unscheduled = rows.filter((row) => row.isUnscheduled);

    const order = [];
    const byKey = new Map();

    scheduled.forEach((row) => {
      const { key, label } = groupFieldCode
        ? resolveGroupKey(row.record, groupFieldCode)
        : { key: '', label: '' };
      if (!byKey.has(key)) {
        byKey.set(key, { key, label, rows: [] });
        order.push(key);
      }
      byKey.get(key).rows.push(row);
    });

    const groups = order.map((key) => byKey.get(key));

    if (unscheduled.length > 0) {
      groups.push({
        key: UNSCHEDULED_GROUP_KEY,
        label: UNSCHEDULED_GROUP_LABEL,
        rows: unscheduled,
      });
    }

    return groups;
  };

  const validateGroupConfig = (
    defaultGroupFieldCode,
    allowedGroupFieldCodes,
    formFields,
  ) => {
    const errors = [];
    (allowedGroupFieldCodes || []).forEach((code) => {
      const field = formFields ? formFields[code] : undefined;
      if (!isGroupableField(field)) {
        errors.push(`${code} はグループ分けに使用できないフィールドです。`);
      }
    });
    if (
      defaultGroupFieldCode &&
      !(allowedGroupFieldCodes || []).includes(defaultGroupFieldCode)
    ) {
      errors.push(
        '既定のグループ分けフィールドは、利用可能なグループ分けフィールドに含まれている必要があります。',
      );
    }
    return { valid: errors.length === 0, errors };
  };

  const Grouping = {
    ALLOWED_GROUP_FIELD_TYPES,
    isGroupableField,
    resolveGroupKey,
    groupRows,
    validateGroupConfig,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Grouping;
  } else {
    root.GanttChartView = root.GanttChartView || {};
    root.GanttChartView.Grouping = Grouping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
