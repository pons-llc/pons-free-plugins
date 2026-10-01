(function (root) {
  'use strict';

  // 指摘履歴サブテーブルのフィールド仕様(idea.md「サブテーブルの構成」)を組み立てる。
  // 既存フィールド(getFormFields()相当の平坦なオブジェクト)と照合し、
  // - 既定コードが空いていれば新規作成
  // - 既定コードに完全一致するテーブル(型・内包フィールドの型・ドロップダウンの選択肢)があれば再利用(冪等)
  // - 既定コードが別内容で使われていれば、既存フィールドは書き換えず末尾に連番を付けて新規作成する
  //   (approval_historyのApprovalTableSpecと同じ、安全側に倒す方針)。

  const TABLE_CODE = 'review_comment_table';
  const TABLE_LABEL = '指摘履歴';
  const STATUS_UNRESOLVED = '未解決';
  const STATUS_RESOLVED = '解決済み';

  // key は config.fieldCodes のプロパティ名
  const INNER_FIELDS = [
    {
      key: 'targetCode',
      code: 'rr_target_code',
      label: '対象フィールドコード',
      type: 'SINGLE_LINE_TEXT',
    },
    {
      key: 'targetLabel',
      code: 'rr_target_label',
      label: '対象項目',
      type: 'SINGLE_LINE_TEXT',
    },
    {
      key: 'pointedAt',
      code: 'rr_pointed_at',
      label: '指摘日時',
      type: 'DATETIME',
    },
    {
      key: 'pointedBy',
      code: 'rr_pointed_by',
      label: '指摘者',
      type: 'USER_SELECT',
    },
    {
      key: 'comment',
      code: 'rr_comment',
      label: '指摘内容',
      type: 'MULTI_LINE_TEXT',
    },
    { key: 'status', code: 'rr_status', label: '解決状況', type: 'DROP_DOWN' },
    {
      key: 'resolution',
      code: 'rr_resolution',
      label: '解決内容',
      type: 'MULTI_LINE_TEXT',
    },
    {
      key: 'resolvedBy',
      code: 'rr_resolved_by',
      label: '対応者',
      type: 'USER_SELECT',
    },
    {
      key: 'resolvedAt',
      code: 'rr_resolved_at',
      label: '解決日時',
      type: 'DATETIME',
    },
  ];

  const base = (field) => ({
    type: field.type,
    code: field.code,
    label: field.label,
    noLabel: false,
    required: false,
  });

  const buildInnerFieldProperty = (field) => {
    switch (field.type) {
      case 'USER_SELECT':
        return { ...base(field), entities: [], defaultValue: [] };
      case 'DATETIME':
        return {
          ...base(field),
          unique: false,
          defaultValue: '',
          defaultNowValue: false,
        };
      case 'MULTI_LINE_TEXT':
        return { ...base(field), defaultValue: '' };
      case 'DROP_DOWN':
        return {
          ...base(field),
          options: {
            [STATUS_UNRESOLVED]: { label: STATUS_UNRESOLVED, index: '0' },
            [STATUS_RESOLVED]: { label: STATUS_RESOLVED, index: '1' },
          },
          defaultValue: STATUS_UNRESOLVED,
        };
      default:
        // SINGLE_LINE_TEXT
        return {
          ...base(field),
          unique: false,
          minLength: '',
          maxLength: '',
          defaultValue: '',
        };
    }
  };

  const fieldCodesFor = (tableCode) => {
    const codes = { table: tableCode };
    INNER_FIELDS.forEach((field) => {
      codes[field.key] = field.code;
    });
    return codes;
  };

  const hasAllInnerFields = (existingTableField) => {
    if (!existingTableField || existingTableField.type !== 'SUBTABLE') {
      return false;
    }
    const innerFields = existingTableField.fields || {};
    return INNER_FIELDS.every((field) => {
      const existing = innerFields[field.code];
      if (!existing || existing.type !== field.type) {
        return false;
      }
      if (field.type === 'DROP_DOWN') {
        const options = existing.options || {};
        return !!(options[STATUS_UNRESOLVED] && options[STATUS_RESOLVED]);
      }
      return true;
    });
  };

  const buildReviewTableSpec = (existingFields = {}) => {
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
      while (existingFields[`${TABLE_CODE}_${n}`]) {
        n += 1;
      }
      tableCode = `${TABLE_CODE}_${n}`;
      warnings.push(
        `フィールドコード「${TABLE_CODE}」は既に別の内容で使われているため、代わりに「${tableCode}」で指摘履歴テーブルを作成します。`,
      );
    }

    const fields = {};
    INNER_FIELDS.forEach((field) => {
      fields[field.code] = buildInnerFieldProperty(field);
    });

    return {
      tableCode,
      needsCreate: true,
      propertiesToAdd: {
        [tableCode]: {
          type: 'SUBTABLE',
          code: tableCode,
          label: TABLE_LABEL,
          noLabel: false,
          fields,
        },
      },
      fieldCodes: fieldCodesFor(tableCode),
      warnings,
    };
  };

  // 保存済みのフィールドコード一式が、現在のアプリでもまだ有効かを判定する(設定画面の「作成済み」表示用)。
  const currentFieldCodes = (existingFields, savedFieldCodes) => {
    if (!savedFieldCodes || !savedFieldCodes.table) {
      return null;
    }
    return hasAllInnerFields(existingFields[savedFieldCodes.table])
      ? savedFieldCodes
      : null;
  };

  const ReviewTableSpec = {
    TABLE_CODE,
    TABLE_LABEL,
    STATUS_UNRESOLVED,
    STATUS_RESOLVED,
    INNER_FIELDS,
    buildReviewTableSpec,
    currentFieldCodes,
    hasAllInnerFields,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReviewTableSpec;
  } else {
    root.RecordReview = root.RecordReview || {};
    root.RecordReview.ReviewTableSpec = ReviewTableSpec;
  }
})(typeof window !== 'undefined' ? window : globalThis);
