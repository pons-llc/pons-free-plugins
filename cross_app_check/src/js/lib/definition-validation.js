(function (root) {
  'use strict';

  // レコード単位の突合定義([[definition-store]])の保存前チェック。
  // エラーメッセージは日本語でそのまま詳細画面に出す。
  const isAppId = (value) => /^[0-9]+$/.test(String(value || '').trim());

  const validate = (definition, currentAppId) => {
    const errors = [];
    const source = definition || {};
    const baseApp = source.baseApp || {};
    const targets = Array.isArray(source.targets) ? source.targets : [];

    if (!baseApp.appId) {
      errors.push('基準アプリのアプリIDを入力してください。');
    } else if (!isAppId(baseApp.appId)) {
      errors.push('基準アプリのアプリIDは数字で入力してください。');
    }
    if (!baseApp.keyFieldCode) {
      errors.push('基準アプリの突合キーとなるフィールドを選択してください。');
    }

    const filled = targets.filter(
      (target) => target.appId || target.keyFieldCode,
    );
    if (filled.length === 0) {
      errors.push('対象アプリを1つ以上設定してください。');
    }

    filled.forEach((target, position) => {
      const name = `対象アプリ${position + 1}`;
      if (!target.appId) {
        errors.push(`${name}のアプリIDを入力してください。`);
      } else if (!isAppId(target.appId)) {
        errors.push(`${name}のアプリIDは数字で入力してください。`);
      }
      if (!target.keyFieldCode) {
        errors.push(`${name}の突合キーとなるフィールドを選択してください。`);
      }
    });

    // 同じアプリを2回設定しても列が重複するだけで意味がないため弾く
    const seen = new Set();
    filled.forEach((target, position) => {
      if (!target.appId) {
        return;
      }
      if (seen.has(target.appId)) {
        errors.push(
          `対象アプリ${position + 1}のアプリID(${target.appId})が重複しています。`,
        );
      }
      seen.add(target.appId);
    });

    // 集計アプリ自身を読みに行くと、突合結果のレコードが母集団に混ざってしまう
    if (currentAppId) {
      const current = String(currentAppId);
      if (baseApp.appId === current) {
        errors.push(
          '基準アプリにこの集計アプリ自身は指定できません。別のアプリを指定してください。',
        );
      }
      filled.forEach((target, position) => {
        if (target.appId === current) {
          errors.push(
            `対象アプリ${position + 1}にこの集計アプリ自身は指定できません。`,
          );
        }
      });
    }

    return { ok: errors.length === 0, errors };
  };

  const DefinitionValidation = {
    isAppId,
    validate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DefinitionValidation;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.DefinitionValidation = DefinitionValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
