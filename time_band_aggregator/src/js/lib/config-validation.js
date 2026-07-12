(function (root) {
  'use strict';

  const TimeBand =
    typeof module !== 'undefined' && module.exports
      ? require('./time-band')
      : root.TimeBandAggregator.TimeBand;

  // 変換元フィールドはDATETIME(日時)・TIME(時刻)のみ選択可能(idea.md「機能概要」)。
  const VALID_SOURCE_FIELD_TYPES = ['DATETIME', 'TIME'];
  const VALID_TRIGGERS = ['CHANGE', 'SUBMIT'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。fieldInfoByCode({ フィールドコード: { type } })を渡した場合のみ、
  // 変換元フィールドの型チェックを行う(省略時はスキップ)。
  const validateRows = (rows, fieldInfoByCode) => {
    const errors = [];

    if (!Array.isArray(rows)) {
      return { valid: false, errors: ['設定(rows)が配列ではありません。'] };
    }
    if (rows.length === 0) {
      errors.push('設定行が1件もありません。');
    }

    const sourceCounts = new Map();

    rows.forEach((row, index) => {
      const label = `${index + 1}行目`;

      if (!row || !isNonEmptyString(row.sourceFieldCode)) {
        errors.push(`${label}: 変換元フィールドが選択されていません。`);
      } else {
        if (
          fieldInfoByCode &&
          fieldInfoByCode[row.sourceFieldCode] &&
          !VALID_SOURCE_FIELD_TYPES.includes(
            fieldInfoByCode[row.sourceFieldCode].type,
          )
        ) {
          errors.push(
            `${label}: 変換元フィールドは日時または時刻フィールドのみ選択できます。`,
          );
        }
        sourceCounts.set(
          row.sourceFieldCode,
          (sourceCounts.get(row.sourceFieldCode) || 0) + 1,
        );
      }

      if (!row || !TimeBand.BAND_WIDTH_OPTIONS.includes(row.bandWidthMinutes)) {
        errors.push(`${label}: 区切り幅の指定が不正です。`);
      }
    });

    sourceCounts.forEach((count, code) => {
      if (count > 1) {
        errors.push(
          `変換元フィールド「${code}」が${count}件の設定行で重複しています。同じ変換元フィールドを複数行で指定することはできません。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const validateTrigger = (trigger) => VALID_TRIGGERS.includes(trigger);

  // 一括実行を有効にする場合は、許可グループコードを1件以上指定する必要がある。
  const validateBulkGroupCodes = (bulkEnabled, bulkGroupCodes) => {
    if (!bulkEnabled) {
      return { valid: true, errors: [] };
    }
    if (!Array.isArray(bulkGroupCodes) || bulkGroupCodes.length === 0) {
      return {
        valid: false,
        errors: [
          '一括実行を有効にする場合は、実行を許可するグループコードを1件以上指定してください。',
        ],
      };
    }
    return { valid: true, errors: [] };
  };

  const ConfigValidation = {
    VALID_SOURCE_FIELD_TYPES,
    VALID_TRIGGERS,
    validateRows,
    validateTrigger,
    validateBulkGroupCodes,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.TimeBandAggregator = root.TimeBandAggregator || {};
    root.TimeBandAggregator.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
