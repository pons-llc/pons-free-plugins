(function (root) {
  'use strict';

  const VALID_MODES = ['zip', 'archive'];
  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
  const isPositiveIntegerString = (v) =>
    isNonEmptyString(v) && /^[1-9][0-9]*$/.test(v);

  // 設定画面の保存前チェック(idea.md「設定画面」参照)。
  const validateConfig = (config) => {
    const errors = [];

    if (!config || !VALID_MODES.includes(config.mode)) {
      errors.push('バックアップ方式の指定が不正です。');
      return { valid: false, errors };
    }

    if (config.mode === 'zip') {
      return { valid: true, errors: [] };
    }

    // mode === 'archive'
    if (!isPositiveIntegerString(config.archiveAppId)) {
      errors.push('アーカイブ先アプリIDには1以上の整数を指定してください。');
    }
    if (!isNonEmptyString(config.jsonFieldCode)) {
      errors.push('JSON保存先フィールドを選択してください。');
    }
    if (!isNonEmptyString(config.attachmentFieldCode)) {
      errors.push('添付ファイル保存先フィールドを選択してください。');
    }
    if (
      isNonEmptyString(config.jsonFieldCode) &&
      isNonEmptyString(config.attachmentFieldCode) &&
      config.jsonFieldCode === config.attachmentFieldCode
    ) {
      errors.push(
        'JSON保存先フィールドと添付ファイル保存先フィールドに同じフィールドは指定できません。',
      );
    }

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.DeleteBackup = root.DeleteBackup || {};
    root.DeleteBackup.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
