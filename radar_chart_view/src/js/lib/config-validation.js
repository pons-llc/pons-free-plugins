(function (root) {
  'use strict';

  // 設定画面の保存時バリデーション(js/config.js から呼ぶ)。
  // formFields: kintone.app.getFormFields() の戻り値(フィールドコード→定義のオブジェクト。
  // 戻り値そのものがREST APIのpropertiesと同等の値でラップされない。CLAUDE.md記載の既知の落とし穴参照)。

  const MIN_AXIS_FIELDS = 3;
  const MAX_AXIS_FIELDS = 8;
  const MIN_SCALE_DIVISIONS = 2;
  const MAX_SCALE_DIVISIONS = 10;
  const AXIS_FIELD_TYPE = 'NUMBER';
  const GROUPING_FIELD_TYPES = ['RADIO_BUTTON', 'DROP_DOWN'];

  const isPositiveInteger = (value) => Number.isInteger(value) && value >= 1;

  const validateAxisFieldCodes = (axisFieldCodes, formFields, errors) => {
    const codes = axisFieldCodes || [];

    if (codes.length < MIN_AXIS_FIELDS || codes.length > MAX_AXIS_FIELDS) {
      errors.push(
        `集計用フィールド(軸)は${MIN_AXIS_FIELDS}〜${MAX_AXIS_FIELDS}個選択してください(現在${codes.length}個)。`,
      );
      return;
    }

    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size !== codes.length) {
      errors.push('集計用フィールド(軸)が重複しています。');
    }

    codes.forEach((code) => {
      const field = formFields[code];
      if (!field) {
        errors.push(`集計用フィールド「${code}」が見つかりません。`);
      } else if (field.type !== AXIS_FIELD_TYPE) {
        errors.push(
          `集計用フィールド「${field.label || code}」は数値フィールドではありません。`,
        );
      }
    });
  };

  const validateGrouping = (config, formFields, errors) => {
    if (config.groupingType !== 'field') {
      return;
    }
    const code = config.groupingFieldCode;
    if (!code) {
      errors.push(
        'グルーピング単位が「フィールドごと」の場合、グルーピングフィールドを選択してください。',
      );
      return;
    }
    const field = formFields[code];
    if (!field) {
      errors.push(`グルーピングフィールド「${code}」が見つかりません。`);
    } else if (!GROUPING_FIELD_TYPES.includes(field.type)) {
      errors.push(
        `グルーピングフィールド「${field.label || code}」はラジオボタン/ドロップダウンではありません。`,
      );
    }
  };

  const validateScaleDivisions = (scaleDivisions, errors) => {
    if (
      !Number.isInteger(scaleDivisions) ||
      scaleDivisions < MIN_SCALE_DIVISIONS ||
      scaleDivisions > MAX_SCALE_DIVISIONS
    ) {
      errors.push(
        `目盛数は${MIN_SCALE_DIVISIONS}〜${MAX_SCALE_DIVISIONS}の整数で指定してください。`,
      );
    }
  };

  const validateMaxRecords = (maxRecords, errors) => {
    if (!isPositiveInteger(maxRecords)) {
      errors.push('全件取得の上限件数は1以上の整数で指定してください。');
    }
  };

  const validateConfig = (config, formFields) => {
    const errors = [];
    const fields = formFields || {};

    validateAxisFieldCodes(config.axisFieldCodes, fields, errors);
    validateGrouping(config, fields, errors);
    validateScaleDivisions(config.scaleDivisions, errors);
    validateMaxRecords(config.maxRecords, errors);

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = {
    MIN_AXIS_FIELDS,
    MAX_AXIS_FIELDS,
    MIN_SCALE_DIVISIONS,
    MAX_SCALE_DIVISIONS,
    AXIS_FIELD_TYPE,
    GROUPING_FIELD_TYPES,
    validateConfig,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
