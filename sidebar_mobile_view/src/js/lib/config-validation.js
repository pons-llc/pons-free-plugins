(function (root) {
  'use strict';

  const MIN_PANEL_WIDTH = 240;
  const MAX_PANEL_WIDTH = 900;

  const isPositiveIntString = (v) => /^[1-9][0-9]*$/.test(v);

  // 設定画面の保存前チェック。例外を投げず、常に { valid, errors } を返す
  // (呼び出し側でエラーメッセージ表示に使いやすくするため)。
  const validateConfig = (config) => {
    const errors = [];

    if (
      !config ||
      (config.defaultView !== 'NATIVE' && config.defaultView !== 'IFRAME')
    ) {
      errors.push('初期表示の指定が不正です。');
    }

    if (
      !config ||
      (config.defaultNativeState !== 'COMMENTS' &&
        config.defaultNativeState !== 'HISTORY')
    ) {
      errors.push('コメント・変更履歴表示時にどちらを開くかの指定が不正です。');
    }

    const panelWidth = config ? config.panelWidth : undefined;
    if (
      typeof panelWidth !== 'number' ||
      !Number.isFinite(panelWidth) ||
      panelWidth < MIN_PANEL_WIDTH ||
      panelWidth > MAX_PANEL_WIDTH
    ) {
      errors.push(
        `パネルの幅は${MIN_PANEL_WIDTH}〜${MAX_PANEL_WIDTH}(px)の範囲で指定してください。`,
      );
    }

    const targetAppId = config ? config.targetAppId : undefined;
    if (targetAppId && !isPositiveIntString(String(targetAppId))) {
      errors.push('対象アプリIDは正の整数で指定してください(未入力可)。');
    }

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { MIN_PANEL_WIDTH, MAX_PANEL_WIDTH, validateConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.SidebarMobileView = root.SidebarMobileView || {};
    root.SidebarMobileView.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
