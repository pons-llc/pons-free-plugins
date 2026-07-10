(function (root) {
  'use strict';

  // ステップの配列+現在値から、各ステップの状態(DONE/ACTIVE/PENDING)を求める。
  // idea.mdの「状態モデル」参照。kintoneに依存しない純粋関数。
  const computeArrowStates = (steps, currentValue) => {
    const list = Array.isArray(steps) ? steps : [];
    const activeIndex = list.indexOf(currentValue);

    return list.map((step, index) => {
      let state = 'PENDING';
      if (activeIndex !== -1) {
        if (index < activeIndex) {
          state = 'DONE';
        } else if (index === activeIndex) {
          state = 'ACTIVE';
        }
      }
      return { value: step, state };
    });
  };

  const ArrowState = { computeArrowStates };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArrowState;
  } else {
    root.StatusArrow = root.StatusArrow || {};
    root.StatusArrow.ArrowState = ArrowState;
  }
})(typeof window !== 'undefined' ? window : globalThis);
