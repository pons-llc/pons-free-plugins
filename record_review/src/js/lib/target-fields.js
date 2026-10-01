(function (root) {
  'use strict';

  // 指摘対象にできるフィールドの候補を、フォームレイアウト順に列挙する(idea.md「設定画面」)。
  // formFields: kintone.app.getFormFields()の戻り値(フィールドコードをキーにした平坦なオブジェクト)
  // layout:     kintone.app.getFormLayout()の戻り値(レイアウト配列そのもの)

  // getFieldElement()で要素が取れない、または指摘対象として意味をなさないフィールド型。
  const EXCLUDED_TYPES = new Set([
    'RECORD_NUMBER',
    'CREATOR',
    'CREATED_TIME',
    'MODIFIER',
    'UPDATED_TIME',
    'STATUS',
    'STATUS_ASSIGNEE',
    'CATEGORY',
    'GROUP',
    '__ID__',
    '__REVISION__',
  ]);

  const collectLayoutCodes = (layout, out) => {
    (layout || []).forEach((item) => {
      if (!item) {
        return;
      }
      if (item.type === 'GROUP') {
        out.push(item.code);
        collectLayoutCodes(item.layout, out);
        return;
      }
      if (item.type === 'SUBTABLE') {
        // テーブル内の個々のフィールドはgetFieldElement()で取得できないため、テーブル自体だけを候補にする。
        out.push(item.code);
        return;
      }
      (item.fields || []).forEach((field) => {
        if (field.code) {
          out.push(field.code);
        }
      });
    });
    return out;
  };

  const listTargetFields = (formFields, layout, excludeCode) => {
    const fields = formFields || {};
    const ordered = collectLayoutCodes(layout, []);
    Object.keys(fields).forEach((code) => {
      if (ordered.indexOf(code) === -1) {
        ordered.push(code);
      }
    });

    const seen = new Set();
    const result = [];
    ordered.forEach((code) => {
      const field = fields[code];
      if (!field || seen.has(code) || code === excludeCode) {
        return;
      }
      seen.add(code);
      if (EXCLUDED_TYPES.has(field.type)) {
        return;
      }
      result.push({ code, label: field.label || code, type: field.type });
    });
    return result;
  };

  // 保存済みの対象フィールド(空 = すべて)を、候補(レイアウト順)に絞り込む。削除済みのコードは捨てる。
  const resolveTargets = (allTargets, savedCodes) => {
    if (!savedCodes || savedCodes.length === 0) {
      return allTargets;
    }
    const wanted = new Set(savedCodes);
    return allTargets.filter((f) => wanted.has(f.code));
  };

  const TargetFields = { EXCLUDED_TYPES, listTargetFields, resolveTargets };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TargetFields;
  } else {
    root.RecordReview = root.RecordReview || {};
    root.RecordReview.TargetFields = TargetFields;
  }
})(typeof window !== 'undefined' ? window : globalThis);
