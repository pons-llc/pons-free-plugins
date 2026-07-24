(function (root) {
  'use strict';

  // 一致したルール(またはルール無し=null)から、showAddRecordButton()/showEditRecordButton()/
  // showDuplicateRecordButton()に渡すstate('VISIBLE'/'HIDDEN')を組み立てる。ルールが無い場合は
  // nullを返し、呼び出し側は何もしない(kintone既定の表示状態のまま、idea.mdの
  // 「発動する画面・タイミング」参照)。
  const ACTION_TO_STATE = {
    SHOW: 'VISIBLE',
    HIDE: 'HIDDEN',
  };

  const resolveButtonState = (matchedRule) => {
    if (!matchedRule) {
      return null;
    }
    return ACTION_TO_STATE[matchedRule.action] || null;
  };

  const ButtonAction = { ACTION_TO_STATE, resolveButtonState };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ButtonAction;
  } else {
    root.RecordButtonToggle = root.RecordButtonToggle || {};
    root.RecordButtonToggle.ButtonAction = ButtonAction;
  }
})(typeof window !== 'undefined' ? window : globalThis);
