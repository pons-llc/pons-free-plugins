(function (root) {
  'use strict';

  // 合計値・予算・しきい値から、メーター表示に必要な値を計算する純粋関数。
  const LEVEL = { OK: 'ok', WARNING: 'warning', DANGER: 'danger' };

  const levelOf = (percentage, warningThresholdPct, dangerThresholdPct) => {
    if (percentage >= dangerThresholdPct) {
      return LEVEL.DANGER;
    }
    if (percentage >= warningThresholdPct) {
      return LEVEL.WARNING;
    }
    return LEVEL.OK;
  };

  // budgetは設定画面のバリデーション(row-validator.js)で常に0より大きい値になっている前提だが、
  // 想定外の0/負値が渡された場合はここでも0除算を起こさず例外にする(呼び出し側でcatchする)。
  const compute = (sum, budget, warningThresholdPct, dangerThresholdPct) => {
    if (!(budget > 0)) {
      throw new Error('budgetは0より大きい数値である必要があります');
    }
    const percentage = (sum / budget) * 100;
    const barWidthPercentage = Math.max(0, Math.min(100, percentage));
    const roundedPercentage = Math.round(percentage * 10) / 10;
    return {
      percentage,
      roundedPercentage,
      barWidthPercentage,
      level: levelOf(percentage, warningThresholdPct, dangerThresholdPct),
    };
  };

  const Meter = { LEVEL, compute };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Meter;
  } else {
    root.BudgetMeter = root.BudgetMeter || {};
    root.BudgetMeter.Meter = Meter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
