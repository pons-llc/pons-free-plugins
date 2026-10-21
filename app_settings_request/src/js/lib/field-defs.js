(function (root) {
  'use strict';

  // 依頼アプリ(このプラグインを追加したアプリ)に作成するフィールドとスペースの定義。
  // フィールドコードは既存フィールドと衝突しにくいよう asr_ 接頭辞で統一する
  // (plugin_catalog_builderで汎用的なコード「テーブル」が既存フィールドと衝突した教訓)。
  const CODES = {
    appId: 'asr_app_id',
    appName: 'asr_app_name',
    fieldLabel: 'asr_field_label',
    operation: 'asr_operation',
    changeJson: 'asr_change_json',
    reason: 'asr_reason',
    result: 'asr_result',
    appliedAt: 'asr_applied_at',
  };

  const SPACER_ELEMENT_ID = 'asr_editor';

  const text = (code, label, extra) => ({
    code,
    type: 'SINGLE_LINE_TEXT',
    label,
    noLabel: false,
    required: false,
    unique: false,
    minLength: '',
    maxLength: '',
    defaultValue: '',
    ...extra,
  });

  const multiText = (code, label) => ({
    code,
    type: 'MULTI_LINE_TEXT',
    label,
    noLabel: false,
    required: false,
    defaultValue: '',
  });

  const FIELD_DEFINITIONS = [
    {
      code: CODES.appId,
      type: 'NUMBER',
      label: '対象アプリID',
      noLabel: false,
      required: true,
      unique: false,
      minValue: '1',
      maxValue: '',
      digit: false,
      displayScale: '',
      defaultValue: '',
    },
    text(CODES.appName, '対象アプリ名'),
    text(CODES.fieldLabel, '対象フィールド'),
    text(CODES.operation, '変更内容'),
    multiText(CODES.changeJson, '変更内容(JSON)'),
    multiText(CODES.reason, '依頼理由'),
    multiText(CODES.result, '反映結果'),
    {
      code: CODES.appliedAt,
      type: 'DATETIME',
      label: '反映日時',
      noLabel: false,
      required: false,
      unique: false,
      defaultValue: '',
      defaultNowValue: false,
    },
  ];

  // 既存フィールド一覧(GET .../form/fields.jsonのproperties)に無い定義だけを抽出する(冪等性)。
  const diffMissingFields = (existingProperties) => {
    const existingCodes = new Set(Object.keys(existingProperties || {}));
    return FIELD_DEFINITIONS.filter((def) => !existingCodes.has(def.code));
  };

  const buildAddFieldsPayload = (definitions) => {
    const properties = {};
    definitions.forEach((def) => {
      properties[def.code] = def;
    });
    return properties;
  };

  // レイアウト(GET .../form/layout.jsonのlayout)にelementIdのスペースがあるか。GROUP内も走査する。
  const hasSpacer = (layout, elementId) =>
    (layout || []).some((row) => {
      if (row.type === 'GROUP') {
        return hasSpacer(row.layout, elementId);
      }
      return (row.fields || []).some(
        (f) => f.type === 'SPACER' && f.elementId === elementId,
      );
    });

  const rowHasField = (row, code) =>
    (row.fields || []).some((f) => f.code === code);

  // スペースはフィールド追加APIでは作れないため、レイアウトに1行追加する。依頼の入力UIなので、
  // 追加したフィールド(対象アプリID)の行の直前に置く。見つからなければ末尾に追加する。
  const insertSpacerRow = (layout, elementId) => {
    const rows = layout || [];
    if (hasSpacer(rows, elementId)) {
      return rows;
    }
    const spacerRow = {
      type: 'ROW',
      fields: [
        { type: 'SPACER', elementId, size: { width: '900', height: '60' } },
      ],
    };
    const index = rows.findIndex(
      (row) => row.type === 'ROW' && rowHasField(row, CODES.appId),
    );
    if (index === -1) {
      return rows.concat([spacerRow]);
    }
    return rows.slice(0, index).concat([spacerRow], rows.slice(index));
  };

  // 既定のプロセス管理で「未申請」の作業者を作成者にするため、作成者フィールドのコードを探す
  // (新規アプリでは「作成者」だが、変更されている場合がある)。
  const findCreatorFieldCode = (properties) => {
    const code = Object.keys(properties || {}).find(
      (c) => properties[c].type === 'CREATOR',
    );
    return code || '';
  };

  const FieldDefs = {
    CODES,
    SPACER_ELEMENT_ID,
    FIELD_DEFINITIONS,
    diffMissingFields,
    buildAddFieldsPayload,
    hasSpacer,
    insertSpacerRow,
    findCreatorFieldCode,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldDefs;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.FieldDefs = FieldDefs;
  }
})(typeof window !== 'undefined' ? window : globalThis);
