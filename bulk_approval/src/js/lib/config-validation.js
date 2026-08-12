(function (root) {
  'use strict';

  // 設定画面の保存時バリデーション。実行可能グループが0件のまま保存すると、
  // ボタンが誰にも表示されず機能が使えない状態になるため保存自体を弾く
  // (age_grade_field_updateと同じ方針、idea.md「設定画面」参照)。
  // 表示項目(displayFieldCodes)は0件でも保存可能(ステータスのみの表示になる)。
  const validate = (config) => {
    const errors = [];
    if (!config.groupCodes || config.groupCodes.length === 0) {
      errors.push('実行可能グループを1つ以上指定してください。');
    }
    return errors;
  };

  const ConfigValidation = { validate };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.BulkApproval = root.BulkApproval || {};
    root.BulkApproval.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
