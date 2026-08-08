(function (root) {
  'use strict';

  // 設定画面の保存前チェック。idea.md「設定画面」参照:
  // 対象フィールド未選択のまま保存させない。実行可能グループは0件のまま保存できてしまうと
  // ボタンが誰にも表示されず機能が使えなくなるため、related_record_summaryとは異なり
  // 保存時バリデーションで弾く(確定・使い勝手上の判断)。
  const validateConfig = (config) => {
    const errors = [];

    if (!config || !config.targetFieldCode) {
      errors.push('対象フィールドを選択してください。');
    }

    if (
      !config ||
      !Array.isArray(config.groupCodes) ||
      config.groupCodes.length === 0
    ) {
      errors.push('実行可能グループを1つ以上指定してください。');
    }

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.AgeGradeFieldUpdate = root.AgeGradeFieldUpdate || {};
    root.AgeGradeFieldUpdate.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
