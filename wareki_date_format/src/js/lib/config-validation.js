(function (root) {
  'use strict';

  const Wareki =
    typeof module !== 'undefined' && module.exports
      ? require('./wareki')
      : root.WarekiDateFormat.Wareki;

  const EraTable =
    typeof module !== 'undefined' && module.exports
      ? require('./era-table')
      : root.WarekiDateFormat.EraTable;

  const VALID_PRESETS = Object.values(Wareki.PRESETS);

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(ペアの配列)の構造的な不正・意味的に矛盾した設定を検出する。
  // 例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に表示しやすくするため)。
  const validatePairs = (pairs) => {
    const errors = [];

    if (!Array.isArray(pairs)) {
      return { valid: false, errors: ['設定(pairs)が配列ではありません。'] };
    }

    pairs.forEach((pair, index) => {
      const label = `${index + 1}件目`;
      if (!pair || !isNonEmptyString(pair.sourceFieldCode)) {
        errors.push(`${label}: 変換元フィールドが選択されていません。`);
      }
      if (!pair || !isNonEmptyString(pair.targetFieldCode)) {
        errors.push(`${label}: 出力先フィールドが選択されていません。`);
      }
      if (!pair || !VALID_PRESETS.includes(pair.preset)) {
        errors.push(`${label}: 書式プリセットの指定が不正です。`);
      }
      if (!pair || typeof pair.zenkaku !== 'boolean') {
        errors.push(`${label}: 全角/半角オプションの指定が不正です。`);
      }
      if (
        pair &&
        isNonEmptyString(pair.sourceFieldCode) &&
        isNonEmptyString(pair.targetFieldCode) &&
        pair.sourceFieldCode === pair.targetFieldCode
      ) {
        errors.push(`${label}: 変換元フィールドと出力先フィールドが同じです。`);
      }
    });

    const targetCounts = new Map();
    pairs.forEach((pair) => {
      if (pair && isNonEmptyString(pair.targetFieldCode)) {
        targetCounts.set(
          pair.targetFieldCode,
          (targetCounts.get(pair.targetFieldCode) || 0) + 1,
        );
      }
    });
    targetCounts.forEach((count, targetFieldCode) => {
      if (count > 1) {
        errors.push(
          `出力先フィールド「${targetFieldCode}」が${count}件のペアで重複しています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  // 設定画面の保存前チェック(元号テーブル)。管理者が登録する「Intlがまだ知らない将来の元号」の
  // 一覧(改元日+元号名)の構造的な不正・矛盾を検出する。
  const validateEras = (eras) => {
    const errors = [];

    if (!Array.isArray(eras)) {
      return { valid: false, errors: ['設定(eras)が配列ではありません。'] };
    }

    eras.forEach((era, index) => {
      const label = `元号${index + 1}件目`;
      if (!era || !isNonEmptyString(era.name)) {
        errors.push(`${label}: 元号名が入力されていません。`);
      }
      if (!era || EraTable.parseStartDate(era.startDate) === null) {
        errors.push(`${label}: 改元日がYYYY-MM-DD形式で入力されていません。`);
      }
    });

    const startDateCounts = new Map();
    eras.forEach((era) => {
      if (era && EraTable.parseStartDate(era.startDate) !== null) {
        startDateCounts.set(
          era.startDate,
          (startDateCounts.get(era.startDate) || 0) + 1,
        );
      }
    });
    startDateCounts.forEach((count, startDate) => {
      if (count > 1) {
        errors.push(
          `改元日「${startDate}」が${count}件の元号で重複しています。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validatePairs, validateEras };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.WarekiDateFormat = root.WarekiDateFormat || {};
    root.WarekiDateFormat.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
