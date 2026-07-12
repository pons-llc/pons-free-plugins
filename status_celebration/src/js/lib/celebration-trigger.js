(function (root) {
  'use strict';

  const PATTERNS = ['KUSUDAMA', 'CRACKER', 'CONFETTI'];

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 「直近の値」から「新しい値」への変化をもとに、お祝いを発火すべきか判定する純粋関数。
  // 値が変わっていない(同じ値のまま)場合や、新しい値がルールの対象外の場合は発火させない
  // (idea.md「発火条件」参照。レコードを開くたびに毎回演出されると煩わしいための仕様)。
  const shouldCelebrate = (rule, previousValue, currentValue) => {
    if (!rule || !isNonEmptyString(currentValue)) {
      return false;
    }
    if (previousValue === currentValue) {
      return false;
    }
    const triggerValues = Array.isArray(rule.triggerValues)
      ? rule.triggerValues
      : [];
    return triggerValues.includes(currentValue);
  };

  const defaultPickRandom = (candidates) =>
    candidates[Math.floor(Math.random() * candidates.length)];

  // 設定された演出パターンから実際に再生するパターンを決定する。RANDOMの場合の抽選方法を
  // pickRandomとして注入可能にし、Jestで決定的にテストできるようにしている。
  const resolvePattern = (pattern, pickRandom = defaultPickRandom) => {
    if (pattern === 'RANDOM') {
      return pickRandom(PATTERNS);
    }
    return PATTERNS.includes(pattern) ? pattern : 'CONFETTI';
  };

  const CelebrationTrigger = { PATTERNS, shouldCelebrate, resolvePattern };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CelebrationTrigger;
  } else {
    root.StatusCelebration = root.StatusCelebration || {};
    root.StatusCelebration.CelebrationTrigger = CelebrationTrigger;
  }
})(typeof window !== 'undefined' ? window : globalThis);
