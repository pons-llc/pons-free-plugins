(function (root) {
  'use strict';

  // ラジオボタン連動モード(idea.md参照)。現在のラジオボタンの値に対応するテンプレートを解決する。
  // 対応するマッピングが無い場合、またはマッピング先のテンプレートが(削除等により)見つからない
  // 場合はnullを返す(呼び出し側で挿入ボタンを無効化する/案内を出す)。
  const resolveTemplateForRadioValue = ({
    templates,
    radioMappings,
    radioValue,
  }) => {
    const mapping = (radioMappings || []).find(
      (m) => m.optionValue === radioValue,
    );
    if (!mapping) {
      return null;
    }
    return (templates || []).find((t) => t.id === mapping.templateId) || null;
  };

  const RadioTemplateMapping = { resolveTemplateForRadioValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RadioTemplateMapping;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.RadioTemplateMapping = RadioTemplateMapping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
