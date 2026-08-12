(function (root) {
  'use strict';

  // 設定画面(config.js)の保存前バリデーション。

  const validateViewConfig = (viewConfig) => {
    const errors = [];
    if (!viewConfig.titleFieldCode) {
      errors.push('タイトルフィールドを設定してください。');
    }
    if (!viewConfig.startFieldCode) {
      errors.push('開始日時フィールドを設定してください。');
    }
    if (
      viewConfig.endFieldCode &&
      viewConfig.startFieldCode &&
      viewConfig.endFieldCode === viewConfig.startFieldCode
    ) {
      errors.push(
        '終了日時フィールドは開始日時フィールドと異なるものを設定してください。',
      );
    }
    return { valid: errors.length === 0, errors };
  };

  const validateViewConfigs = (viewConfigs) => {
    const errors = [];
    const seenViewIds = new Set();
    (viewConfigs || []).forEach((viewConfig) => {
      if (seenViewIds.has(viewConfig.viewId)) {
        errors.push(`一覧ID「${viewConfig.viewId}」の設定が重複しています。`);
      }
      seenViewIds.add(viewConfig.viewId);
      const result = validateViewConfig(viewConfig);
      if (!result.valid) {
        errors.push(
          ...result.errors.map(
            (msg) => `[${viewConfig.viewName || viewConfig.viewId}] ${msg}`,
          ),
        );
      }
    });
    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateViewConfig, validateViewConfigs };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
