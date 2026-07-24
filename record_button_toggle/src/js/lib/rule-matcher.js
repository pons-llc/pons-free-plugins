(function (root) {
  'use strict';

  const ConditionEngine =
    typeof module !== 'undefined' && module.exports
      ? require('./condition-engine')
      : root.RecordButtonToggle.ConditionEngine;

  // レコード(またはレコード文脈が無い画面ではnull)+ルールの配列(常に一致するALWAYS/条件付き
  // MATCHが混在)+対象ボタンから、対象ボタンで絞り込んだうえで設定順で最初に一致したルールを返す
  // (idea.mdの「ルールは設定順に評価し、最初に一致したルールの動作を適用する」参照。
  // group_field_toggleとの違いは、レコード一覧・グラフ画面のようにレコード文脈が無い画面では
  // recordにnullを渡し、その場合mode: 'MATCH'のルールを一切一致させない点。idea.mdの
  // 「レコードの文脈が無い画面での条件評価」参照。存在しないレコードに対してIS_EMPTY等が
  // 誤って真になることを避けるため、条件評価自体を行わない設計にした)。
  // 一致するルールがなければnullを返す。
  const findMatchingRule = (record, rules, targetButton) => {
    const list = Array.isArray(rules) ? rules : [];
    const found = list
      .filter((rule) => rule && rule.targetButton === targetButton)
      .find((rule) => {
        if (rule.mode === 'ALWAYS') {
          return true;
        }
        if (!record) {
          return false;
        }
        return ConditionEngine.evaluateCondition(record, rule.condition);
      });
    return found || null;
  };

  const RuleMatcher = { findMatchingRule };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleMatcher;
  } else {
    root.RecordButtonToggle = root.RecordButtonToggle || {};
    root.RecordButtonToggle.RuleMatcher = RuleMatcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
