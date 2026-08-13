(function (root) {
  'use strict';

  // 設定画面(config.js)の保存前バリデーション。

  const validateViewConfig = (viewConfig) => {
    const errors = [];
    if (!viewConfig.titleFieldCode) {
      errors.push('タイトルフィールドを設定してください。');
    }
    if (viewConfig.groupMode === 'FIELD' && !viewConfig.groupFieldCode) {
      errors.push(
        'グループ分け方法が「ラジオボタン/ドロップダウン」の場合、グループ分けフィールドを設定してください。',
      );
    }
    if (
      viewConfig.assigneeMode === 'USER_FIELD' &&
      !viewConfig.assigneeFieldCode
    ) {
      errors.push(
        '担当者の表示元が「ユーザー選択フィールド」の場合、担当者フィールドを設定してください。',
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
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
