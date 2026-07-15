(function (root) {
  'use strict';

  // 決裁履歴サブテーブルのフィールド仕様(idea.md「サブテーブルの構成」)を組み立てる。
  // 既存フィールド(existingFields: getFormFields()相当の平坦なオブジェクト、
  // { フィールドコード: { type, fields? } })と照合し、
  // - 既定コードが空いていれば新規作成
  // - 既定コードに完全一致するテーブル(型・内包フィールドの型がすべて一致)があれば再利用(冪等)
  // - 既定コードが別内容で使われていれば、既存フィールドの構造は書き換えず、末尾に連番を付けた
  //   新しいコードで新規作成する(time_band_aggregatorのFieldSpecBuilderと同じ、安全側に倒す方針)。

  const TABLE_CODE = 'approval_history_table';
  const TABLE_LABEL = '決裁履歴';

  const INNER_FIELDS = [
    {
      code: 'status_before',
      label: '現在のステータス',
      type: 'SINGLE_LINE_TEXT',
    },
    { code: 'status_after', label: '次のステータス', type: 'SINGLE_LINE_TEXT' },
    { code: 'executed_by', label: '実行ユーザー', type: 'USER_SELECT' },
    { code: 'executed_by_title', label: '役職', type: 'SINGLE_LINE_TEXT' },
    { code: 'executed_at', label: '実行日時', type: 'DATETIME' },
  ];

  const buildInnerFieldProperty = (field) => {
    if (field.type === 'USER_SELECT') {
      return {
        type: field.type,
        code: field.code,
        label: field.label,
        noLabel: false,
        required: false,
        entities: [],
        defaultValue: [],
      };
    }
    if (field.type === 'DATETIME') {
      return {
        type: field.type,
        code: field.code,
        label: field.label,
        noLabel: false,
        required: false,
        unique: false,
        defaultValue: '',
        defaultNowValue: false,
      };
    }
    // SINGLE_LINE_TEXT
    return {
      type: field.type,
      code: field.code,
      label: field.label,
      noLabel: false,
      required: false,
      unique: false,
      minLength: '',
      maxLength: '',
      defaultValue: '',
    };
  };

  const buildInnerFieldProperties = () => {
    const fields = {};
    INNER_FIELDS.forEach((field) => {
      fields[field.code] = buildInnerFieldProperty(field);
    });
    return fields;
  };

  const fieldCodesFor = (tableCode) => ({
    table: tableCode,
    statusBefore: 'status_before',
    statusAfter: 'status_after',
    executedBy: 'executed_by',
    executedByTitle: 'executed_by_title',
    executedAt: 'executed_at',
  });

  // 既存のテーブルフィールドが、決裁履歴用の内包フィールドをすべて(型も含めて)満たしているか判定する。
  const hasAllInnerFields = (existingTableField) => {
    if (!existingTableField || existingTableField.type !== 'SUBTABLE') {
      return false;
    }
    const innerFields = existingTableField.fields || {};
    return INNER_FIELDS.every(
      (field) =>
        innerFields[field.code] && innerFields[field.code].type === field.type,
    );
  };

  const buildApprovalTableSpec = (existingFields = {}) => {
    const warnings = [];
    let tableCode = TABLE_CODE;
    const existingAtDefault = existingFields[TABLE_CODE];

    if (existingAtDefault) {
      if (hasAllInnerFields(existingAtDefault)) {
        return {
          tableCode,
          needsCreate: false,
          propertiesToAdd: {},
          fieldCodes: fieldCodesFor(tableCode),
          warnings,
        };
      }
      let n = 2;
      let candidate = `${TABLE_CODE}_${n}`;
      while (existingFields[candidate]) {
        n += 1;
        candidate = `${TABLE_CODE}_${n}`;
      }
      tableCode = candidate;
      warnings.push(
        `フィールドコード「${TABLE_CODE}」は既に別の内容で使われているため、代わりに「${tableCode}」で決裁履歴テーブルを作成します。`,
      );
    }

    const propertiesToAdd = {
      [tableCode]: {
        type: 'SUBTABLE',
        code: tableCode,
        label: TABLE_LABEL,
        noLabel: false,
        fields: buildInnerFieldProperties(),
      },
    };

    return {
      tableCode,
      needsCreate: true,
      propertiesToAdd,
      fieldCodes: fieldCodesFor(tableCode),
      warnings,
    };
  };

  // 保存済みのフィールドコード一式(config.fieldCodes)が、現在のアプリ設定でもまだ有効
  // (テーブルが存在し、内包フィールドをすべて満たす)かどうかを判定する。設定画面の
  // 「作成済み」表示に使う。
  const currentFieldCodes = (existingFields, savedFieldCodes) => {
    if (!savedFieldCodes || !savedFieldCodes.table) {
      return null;
    }
    const field = existingFields[savedFieldCodes.table];
    return hasAllInnerFields(field) ? savedFieldCodes : null;
  };

  const ApprovalTableSpec = {
    TABLE_CODE,
    TABLE_LABEL,
    INNER_FIELDS,
    buildApprovalTableSpec,
    currentFieldCodes,
    hasAllInnerFields,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApprovalTableSpec;
  } else {
    root.ApprovalHistory = root.ApprovalHistory || {};
    root.ApprovalHistory.ApprovalTableSpec = ApprovalTableSpec;
  }
})(typeof window !== 'undefined' ? window : globalThis);
