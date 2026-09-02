(function (root) {
  'use strict';

  const ALLOWED_TRIGGER_EVENTS = ['create.show', 'edit.show'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。プラグイン設定(フィールドコードごとの発動タイミングのマップ)の
  // 構造的な不正を検出する。例外を投げず、常に { valid, errors } を返す(呼び出し側でalert等に
  // 表示しやすくするため)。
  const validateFieldTriggers = (fieldTriggers) => {
    const errors = [];

    if (
      typeof fieldTriggers !== 'object' ||
      fieldTriggers === null ||
      Array.isArray(fieldTriggers)
    ) {
      return {
        valid: false,
        errors: ['設定(fieldTriggers)がオブジェクトではありません。'],
      };
    }

    Object.entries(fieldTriggers).forEach(([code, events]) => {
      if (!isNonEmptyString(code)) {
        errors.push('フィールドコードが空です。');
        return;
      }
      if (!Array.isArray(events) || events.length === 0) {
        errors.push(
          `フィールド「${code}」の発動タイミングが選択されていません。`,
        );
        return;
      }
      events.forEach((event) => {
        if (!ALLOWED_TRIGGER_EVENTS.includes(event)) {
          errors.push(
            `フィールド「${code}」の発動タイミング「${event}」は不正な値です。`,
          );
        }
      });
    });

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateFieldTriggers };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.AutoLookup = root.AutoLookup || {};
    root.AutoLookup.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
