(function (root) {
  'use strict';

  // デザインプリセット名からCSSクラス名を解決する。未知の値・未設定はDEFAULTにフォールバックする
  // (idea.mdの「デザイン」参照)。kintoneに依存しない純粋関数。
  const PRESET_CLASSES = {
    DEFAULT: 'sta-design-default',
    BLUE: 'sta-design-blue',
    GREEN: 'sta-design-green',
    ORANGE: 'sta-design-orange',
  };

  const resolveDesignClass = (design) =>
    PRESET_CLASSES[design] || PRESET_CLASSES.DEFAULT;

  const DesignPreset = { PRESET_CLASSES, resolveDesignClass };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DesignPreset;
  } else {
    root.StatusArrow = root.StatusArrow || {};
    root.StatusArrow.DesignPreset = DesignPreset;
  }
})(typeof window !== 'undefined' ? window : globalThis);
