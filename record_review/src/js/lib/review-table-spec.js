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
    // v2で追加: テーブルの行単位の指摘で、対象行のID(kintoneのテーブル行id)を保存する。
    // v1で作成済みのテーブルにはこの列が無いため、設定の再保存時に不足分だけ追加する(isUpgradable)。
    {
      key: 'targetRowId',
      code: 'rr_target_row_id',
      label: '対象行ID',
      type: 'SINGLE_LINE_TEXT',
      since: 2,
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

  const innerFieldMatches = (existing, field) => {
    if (!existing || existing.type !== field.type) {
      return false;
    }
    if (field.type === 'DROP_DOWN') {
      const options = existing.options || {};
      return !!(options[STATUS_UNRESOLVED] && options[STATUS_RESOLVED]);
    }
    return true;
  };

  const hasAllInnerFields = (existingTableField) => {
    if (!existingTableField || existingTableField.type !== 'SUBTABLE') {
      return false;
    }
    const innerFields = existingTableField.fields || {};
    return INNER_FIELDS.every((field) =>
      innerFieldMatches(innerFields[field.code], field),
    );
  };

  // 旧バージョンで作成されたテーブル: v1からある項目はすべて一致し、欠けているのが後から追加した項目
  // (since >= 2)だけで、かつ欠けている項目と同じコードの別フィールドがテーブル内に無い場合。
  const missingInnerFields = (existingTableField) => {
    const innerFields = (existingTableField && existingTableField.fields) || {};
    return INNER_FIELDS.filter((field) => !innerFields[field.code]);
  };

  const isUpgradable = (existingTableField) => {
    if (!existingTableField || existingTableField.type !== 'SUBTABLE') {
      return false;
    }
    const innerFields = existingTableField.fields || {};
    const missing = missingInnerFields(existingTableField);
    if (missing.length === 0 || missing.some((field) => !field.since)) {
      return false;
    }
    return INNER_FIELDS.filter((field) => innerFields[field.code]).every(
      (field) => innerFieldMatches(innerFields[field.code], field),
    );
  };

  const reuse = (tableCode, warnings) => ({
    tableCode,
    needsCreate: false,
    needsUpgrade: false,
    propertiesToAdd: {},
    fieldCodes: fieldCodesFor(tableCode),
    warnings,
  });

  // 既存テーブルへの内包フィールドの追加は、フィールド追加API(POST /k/v1/preview/app/form/fields.json)に
  // テーブルのコード・ラベルと、追加する内包フィールドだけを指定して行う(既存の内包フィールドは保持される。
  // 実機で確認済み)。フィールド設定変更API(PUT)は既存フィールドの変更専用で、新しい内包フィールドを
  // 指定すると「指定されたフィールドが見つかりません」になる(実機で確認済み)。
  // ラベルは必須項目のため、既存テーブルの現在のラベルをそのまま指定する(名前を変えない)。
  const upgrade = (tableCode, existingTableField, warnings) => {
    const fields = {};
    missingInnerFields(existingTableField).forEach((field) => {
      fields[field.code] = buildInnerFieldProperty(field);
    });
    return {
      ...reuse(tableCode, warnings),
      needsUpgrade: true,
      propertiesToAdd: {
        [tableCode]: {
          type: 'SUBTABLE',
          code: tableCode,
          label: existingTableField.label || TABLE_LABEL,
          fields,
        },
      },
    };
  };

  // savedTableCode: 前回保存したテーブルのコード(連番付きで作成した場合に、再保存で別テーブルを
  // 増やさないよう最優先で照合する)。
  const buildReviewTableSpec = (inputFields, savedTableCode) => {
    const existingFields = inputFields || {};
    const warnings = [];
    const candidates = [savedTableCode, TABLE_CODE].filter(
      (code, i, arr) => code && arr.indexOf(code) === i,
    );
    for (const code of candidates) {
      const existing = existingFields[code];
      if (hasAllInnerFields(existing)) {
        return reuse(code, warnings);
      }
      if (isUpgradable(existing)) {
        return upgrade(code, existing, warnings);
      }
    }

    let tableCode = TABLE_CODE;
    if (existingFields[TABLE_CODE]) {
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
      ...reuse(tableCode, warnings),
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
    isUpgradable,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReviewTableSpec;
  } else {
    root.RecordReview = root.RecordReview || {};
    root.RecordReview.ReviewTableSpec = ReviewTableSpec;
  }
})(typeof window !== 'undefined' ? window : globalThis);
