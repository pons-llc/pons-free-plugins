(function (root) {
  'use strict';

  // 設定画面の保存前バリデーション(idea.md「設定画面」参照)。fieldInfoByCodeは
  // { フィールドコード: { type } } の形(kintone.app.getFormFields()から作る、
  // CLAUDE.mdの既知の落とし穴コメントは呼び出し側のconfig.jsに記載)。

  const TARGET_FIELD_TYPES = ['MULTI_LINE_TEXT', 'RICH_TEXT'];

  const validateTemplate = (template, index, fieldInfoByCode, errors) => {
    const label = `テンプレート${index + 1}`;
    if (!template.name || !template.name.trim()) {
      errors.push(`${label}: テンプレート名を入力してください。`);
    }
    const targetField = fieldInfoByCode[template.targetFieldCode];
    if (!template.targetFieldCode || !targetField) {
      errors.push(`${label}: 挿入先フィールドを選択してください。`);
    } else if (TARGET_FIELD_TYPES.indexOf(targetField.type) === -1) {
      errors.push(
        `${label}: 挿入先フィールドは文字列(複数行)またはリッチエディターのみ選択できます。`,
      );
    }
    if (!template.body || !template.body.trim()) {
      errors.push(`${label}: 本文を入力してください。`);
    }
    if (template.kind === 'SUBTABLE_REPEAT') {
      const subtableField = fieldInfoByCode[template.subtableFieldCode];
      if (!template.subtableFieldCode || !subtableField) {
        errors.push(`${label}: 対象サブテーブルを選択してください。`);
      } else if (subtableField.type !== 'SUBTABLE') {
        errors.push(
          `${label}: 対象サブテーブルにはテーブル項目を選択してください。`,
        );
      }
    }
  };

  const validateConfig = (config, fieldInfoByCode) => {
    const errors = [];

    if (config.mode !== 'DROPDOWN' && config.mode !== 'RADIO_LINKED') {
      errors.push('表示モードを選択してください。');
    }

    if (config.mode === 'RADIO_LINKED') {
      const radioField = fieldInfoByCode[config.radioFieldCode];
      if (!config.radioFieldCode || !radioField) {
        errors.push('連動するラジオボタンフィールドを選択してください。');
      } else if (radioField.type !== 'RADIO_BUTTON') {
        errors.push(
          '連動するフィールドにはラジオボタン項目を選択してください。',
        );
      }
    }

    const templates = config.templates || [];
    if (templates.length === 0) {
      errors.push('テンプレートを1件以上追加してください。');
    }
    templates.forEach((template, index) =>
      validateTemplate(template, index, fieldInfoByCode, errors),
    );

    if (config.mode === 'RADIO_LINKED') {
      const templateIds = templates.map((t) => t.id);
      (config.radioMappings || []).forEach((mapping, index) => {
        // 空文字列は「(挿入しない)」という意図的な未割り当てを表し、エラーではない
        // (idea.md「対応するテンプレートが無い選択肢もあってよい」参照)。
        if (!mapping.templateId) {
          return;
        }
        if (templateIds.indexOf(mapping.templateId) === -1) {
          errors.push(
            `ラジオボタン対応${index + 1}: 対応するテンプレートが見つかりません。`,
          );
        }
      });
    }

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
