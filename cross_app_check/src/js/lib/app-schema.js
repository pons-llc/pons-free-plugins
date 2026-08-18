(function (root) {
  'use strict';

  // 集計アプリ側のスキーマ定義。
  // 対象アプリを増やしてもフィールドを増やさなくて済むよう、
  // 結果の中身はJSONファイルに持たせ、アプリ側は「実行履歴のテーブル」だけを固定で持つ。
  const FIELD_CODES = {
    title: 'cac_title',
    definition: 'cac_definition',
    runs: 'cac_runs',
    runId: 'cac_run_id',
    runAt: 'cac_run_at',
    runSummary: 'cac_run_summary',
    runFile: 'cac_run_file',
  };

  // 結果ビューワを描画するスペースフィールドの要素ID。
  // スペースはフィールド追加APIでは作れないため、レイアウト変更APIで差し込む。
  const SPACER_ELEMENT_ID = 'cac_view';

  const subtableFieldProperties = () => ({
    [FIELD_CODES.runId]: {
      type: 'SINGLE_LINE_TEXT',
      code: FIELD_CODES.runId,
      label: '実行ID',
      noLabel: false,
      required: false,
      unique: false,
      defaultValue: '',
      expression: '',
      hideExpression: false,
      minLength: '',
      maxLength: '',
    },
    [FIELD_CODES.runAt]: {
      type: 'SINGLE_LINE_TEXT',
      code: FIELD_CODES.runAt,
      label: '実行日時',
      noLabel: false,
      required: false,
      unique: false,
      defaultValue: '',
      expression: '',
      hideExpression: false,
      minLength: '',
      maxLength: '',
    },
    [FIELD_CODES.runSummary]: {
      type: 'SINGLE_LINE_TEXT',
      code: FIELD_CODES.runSummary,
      label: '概要',
      noLabel: false,
      required: false,
      unique: false,
      defaultValue: '',
      expression: '',
      hideExpression: false,
      minLength: '',
      maxLength: '',
    },
    [FIELD_CODES.runFile]: {
      type: 'FILE',
      code: FIELD_CODES.runFile,
      label: '結果JSON',
      noLabel: false,
      required: false,
      thumbnailSize: '150',
    },
  });

  const buildFieldProperties = () => ({
    [FIELD_CODES.title]: {
      type: 'SINGLE_LINE_TEXT',
      code: FIELD_CODES.title,
      label: '突合名',
      noLabel: false,
      required: false,
      unique: false,
      defaultValue: '',
      expression: '',
      hideExpression: false,
      minLength: '',
      maxLength: '',
    },
    // 突合の定義(基準アプリ・対象アプリ・キー・絞り込み条件)をJSONで保持する欄。
    // 利用者が直接編集するものではなく、詳細画面の設定UIが読み書きする。
    // 対象アプリが可変長なのでフィールドを増やさずJSON1本に寄せている。
    [FIELD_CODES.definition]: {
      type: 'MULTI_LINE_TEXT',
      code: FIELD_CODES.definition,
      label: '突合設定(自動生成・編集不要)',
      noLabel: false,
      required: false,
      defaultValue: '',
    },
    [FIELD_CODES.runs]: {
      type: 'SUBTABLE',
      code: FIELD_CODES.runs,
      label: '突合履歴',
      noLabel: false,
      fields: subtableFieldProperties(),
    },
  });

  const topLevelCodes = () => Object.keys(buildFieldProperties());

  // 既存フィールドと突き合わせ、まだ無いトップレベルのフィールドだけを返す。
  // (`ensureFormFields`と同じ「冪等・既存には触らない」方針)
  const missingFieldProperties = (existingProperties) => {
    const existing = existingProperties || {};
    const all = buildFieldProperties();
    const missing = {};
    topLevelCodes().forEach((code) => {
      if (!existing[code]) {
        missing[code] = all[code];
      }
    });
    return missing;
  };

  // 履歴テーブルだけ先に存在していて中身のフィールドが欠けている場合を検出する。
  // (テーブル自体はあるので追加APIでは足せず、フィールド設定変更APIが要る)
  const missingSubtableFieldCodes = (existingProperties) => {
    const existing = existingProperties || {};
    const runs = existing[FIELD_CODES.runs];
    if (!runs || runs.type !== 'SUBTABLE') {
      return [];
    }
    const inner = runs.fields || {};
    return Object.keys(subtableFieldProperties()).filter(
      (code) => !inner[code],
    );
  };

  const isSchemaReady = (existingProperties, layout) =>
    Object.keys(missingFieldProperties(existingProperties)).length === 0 &&
    missingSubtableFieldCodes(existingProperties).length === 0 &&
    hasSpacer(layout);

  // レイアウトを再帰的にたどってスペースフィールドの有無を調べる
  // (GROUPフィールドの中にも行が入れ子になりうる)
  function hasSpacer(layout, elementId) {
    const targetId = elementId || SPACER_ELEMENT_ID;
    const rows = layout || [];
    return rows.some((row) => {
      if (row.type === 'GROUP') {
        return hasSpacer(row.layout || [], targetId);
      }
      return (row.fields || []).some(
        (field) => field.type === 'SPACER' && field.elementId === targetId,
      );
    });
  }

  const buildSpacerRow = (elementId) => ({
    type: 'ROW',
    fields: [
      {
        type: 'SPACER',
        elementId: elementId || SPACER_ELEMENT_ID,
        size: { width: '200', height: '200' },
      },
    ],
  });

  // スペースが無ければ末尾に足した新しいレイアウトを返す。あれば同じ配列をそのまま返す。
  const appendSpacerRow = (layout, elementId) => {
    const rows = layout || [];
    if (hasSpacer(rows, elementId)) {
      return rows;
    }
    return rows.concat([buildSpacerRow(elementId)]);
  };

  const AppSchema = {
    FIELD_CODES,
    SPACER_ELEMENT_ID,
    buildFieldProperties,
    subtableFieldProperties,
    missingFieldProperties,
    missingSubtableFieldCodes,
    isSchemaReady,
    hasSpacer,
    buildSpacerRow,
    appendSpacerRow,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppSchema;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.AppSchema = AppSchema;
  }
})(typeof window !== 'undefined' ? window : globalThis);
