(function (root) {
  'use strict';

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。fieldInfoByCode({ フィールドコード: { type } })を渡した場合のみ、
  // 緯度・経度フィールドの型チェックを行う(省略時はスキップ、org_lookupのconfig-validation.jsと同じ設計)。
  const validateConfig = (config, fieldInfoByCode) => {
    const errors = [];
    const latitudeFieldCode = config && config.latitudeFieldCode;
    const longitudeFieldCode = config && config.longitudeFieldCode;

    if (!isNonEmptyString(latitudeFieldCode)) {
      errors.push('緯度を保存するフィールドを選択してください。');
    } else if (
      fieldInfoByCode &&
      fieldInfoByCode[latitudeFieldCode] &&
      fieldInfoByCode[latitudeFieldCode].type !== 'NUMBER'
    ) {
      errors.push('緯度フィールドは数値フィールドのみ選択できます。');
    }

    if (!isNonEmptyString(longitudeFieldCode)) {
      errors.push('経度を保存するフィールドを選択してください。');
    } else if (
      fieldInfoByCode &&
      fieldInfoByCode[longitudeFieldCode] &&
      fieldInfoByCode[longitudeFieldCode].type !== 'NUMBER'
    ) {
      errors.push('経度フィールドは数値フィールドのみ選択できます。');
    }

    if (
      isNonEmptyString(latitudeFieldCode) &&
      isNonEmptyString(longitudeFieldCode) &&
      latitudeFieldCode === longitudeFieldCode
    ) {
      errors.push(
        '緯度フィールドと経度フィールドには異なるフィールドを選択してください。',
      );
    }

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.GeoCheckin = root.GeoCheckin || {};
    root.GeoCheckin.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
