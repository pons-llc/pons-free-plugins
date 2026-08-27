(function (root) {
  'use strict';

  const TemplateBodyResolver =
    typeof module !== 'undefined' && module.exports
      ? require('./template-body-resolver')
      : root.TemplateInsert.TemplateBodyResolver;

  // 設定画面の保存前バリデーション(idea.md「設定画面」参照)。fieldCatalogは
  // { フィールドコード: { type, subtableFieldCode } } の形(js/lib/field-catalog.js参照)。

  const TARGET_FIELD_TYPES = ['MULTI_LINE_TEXT', 'RICH_TEXT'];
  const BLOCK_PATTERN = /\[\[([\s\S]*?)\]\]/g;

  // "[["・"]]"の出現回数が一致しているか(対応が崩れていないか)を確認する。
  // ネストは想定しないシンプルな数合わせのチェック。
  const hasBalancedBrackets = (body) => {
    const openCount = (body.match(/\[\[/g) || []).length;
    const closeCount = (body.match(/\]\]/g) || []).length;
    return openCount === closeCount;
  };

  const validateTemplateBody = (template, index, fieldCatalog, errors) => {
    const label = `テンプレート${index + 1}`;
    const body = template.body || '';

    if (!hasBalancedBrackets(body)) {
      errors.push(
        `${label}: 本文の[[と]]の対応が取れていません(繰り返しブロックの開始・終了を確認してください)。`,
      );
      return;
    }

    const pattern = new RegExp(BLOCK_PATTERN);
    let match;
    while ((match = pattern.exec(body))) {
      const blockContent = match[1];
      const tableCode = TemplateBodyResolver.resolveBlockTableCode(
        blockContent,
        fieldCatalog,
      );
      if (!tableCode) {
        errors.push(
          `${label}: 繰り返しブロック「[[${blockContent}]]」がどのテーブルの繰り返しか特定できません。ブロック内に、そのテーブルの列を指すプレースホルダーを1つ以上含めてください。`,
        );
      }
    }
  };

  const validateTemplate = (template, index, fieldCatalog, errors) => {
    const label = `テンプレート${index + 1}`;
    if (!template.name || !template.name.trim()) {
      errors.push(`${label}: テンプレート名を入力してください。`);
    }
    const targetField = fieldCatalog[template.targetFieldCode];
    if (!template.targetFieldCode || !targetField) {
      errors.push(`${label}: 挿入先フィールドを選択してください。`);
    } else if (TARGET_FIELD_TYPES.indexOf(targetField.type) === -1) {
      errors.push(
        `${label}: 挿入先フィールドは文字列(複数行)またはリッチエディターのみ選択できます。`,
      );
    }
    if (!template.body || !template.body.trim()) {
      errors.push(`${label}: 本文を入力してください。`);
    } else {
      validateTemplateBody(template, index, fieldCatalog, errors);
    }
  };

  const validateConfig = (config, fieldCatalog) => {
    const errors = [];

    if (config.mode !== 'DROPDOWN' && config.mode !== 'RADIO_LINKED') {
      errors.push('表示モードを選択してください。');
    }

    if (config.mode === 'RADIO_LINKED') {
      const radioField = fieldCatalog[config.radioFieldCode];
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
      validateTemplate(template, index, fieldCatalog, errors),
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
