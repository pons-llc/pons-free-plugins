(function (root) {
  'use strict';

  // 依頼アプリのquestionsテーブル(=フォーム定義)と、それをJSON化した「仮想フォームレイアウト」に
  // 関する純粋ロジック。DOMやkintoneオブジェクトには依存しない。
  //
  // レイアウト行の形はkintoneサブテーブルの行そのまま:
  //   { value: { insert_column: {value}, field_type: {value}, choice: {value}, order: {value},
  //             question: {value}, question_detail: {value}, question_width: {value},
  //             mondatory: {value} } }
  // (「mondatory」はテンプレート側の既存フィールドコードのつづりに合わせている)

  const CHOICE_REQUIRED_TYPES = [
    'ラジオボタン',
    'ドロップダウン',
    'チェックボックス',
  ];

  // 保存前のフォーム定義チェック(フィールドコードの重複/未入力、選択肢必須タイプの選択肢未入力)
  const validateFormLayout = (layoutRows) => {
    const seenColumns = new Set();
    const errors = [];

    (layoutRows || []).forEach((item, index) => {
      const row = item.value;
      const fieldCode = row.insert_column.value;
      const fieldType = row.field_type.value;
      const choices = row.choice.value;
      const rowNum = index + 1;

      if (fieldCode) {
        if (seenColumns.has(fieldCode)) {
          errors.push(
            `第${rowNum}行: フィールドコード「${fieldCode}」が重複しています。`,
          );
        }
        seenColumns.add(fieldCode);
      } else {
        errors.push(`第${rowNum}行: フィールドコードを入力してください。`);
      }

      if (CHOICE_REQUIRED_TYPES.includes(fieldType)) {
        if (!choices || choices.trim() === '') {
          errors.push(
            `第${rowNum}行: タイプが「${fieldType}」の場合、選択肢は必須です。`,
          );
        }
      }
    });

    return { isValid: errors.length === 0, messages: errors };
  };

  // order昇順の新しい配列を返す(元配列は変更しない)
  const sortLayoutByOrder = (layoutRows) =>
    [...(layoutRows || [])].sort(
      (a, b) =>
        (Number(a.value.order && a.value.order.value) || 0) -
        (Number(b.value.order && b.value.order.value) || 0),
    );

  const parseChoices = (choiceValue) => {
    if (!choiceValue) {
      return [];
    }
    return String(choiceValue)
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== '');
  };

  // ---- 日時変換(input[type=datetime-local] <-> ISO文字列) ----
  const toDatetimeLocal = (dateString) => {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const fromDatetimeLocalToISO = (localValue) => {
    if (!localValue) {
      return null;
    }
    const date = new Date(localValue);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  };

  // ---- 動的必須条件 ----

  // 条件行は2形態が混在し得る(過去データ互換):
  //   フラット形 { triggerField, targetField, operator, value, action }
  //   テーブル形 { value: { condition:{value}, target_column:{value}, valid:{value},
  //               valid_value:{value}, valid_action:{value} } }
  const normalizeConditionRule = (item) => {
    // テーブル形はvalueが行オブジェクト、フラット形はvalueが条件値(文字列)なので、
    // オブジェクトかどうかで判定する(truthy判定だとフラット形のvalueに反応してしまう)
    const isWrapped =
      item && typeof item.value === 'object' && item.value !== null;
    const c = isWrapped ? item.value : item || {};
    const pick = (flat, wrapped) =>
      flat !== undefined && flat !== null
        ? flat
        : wrapped
          ? wrapped.value
          : null;
    return {
      triggerField: pick(c.triggerField, c.condition),
      targetField: pick(c.targetField, c.target_column),
      operator: pick(c.operator, c.valid),
      value: pick(c.value, c.valid_value),
      action: pick(c.action, c.valid_action),
    };
  };

  const evaluateCondition = (triggerValue, operator, conditionValue) => {
    // チェックボックス(配列)の場合
    if (Array.isArray(triggerValue)) {
      if (operator === '含む') {
        return triggerValue.includes(conditionValue);
      }
      if (operator === '等しい') {
        return triggerValue.length === 1 && triggerValue[0] === conditionValue;
      }
      return false;
    }

    const val = triggerValue || '';
    const cond = conditionValue || '';

    // 両方数値として解釈できる場合のみ数値比較する
    const numVal = parseFloat(val);
    const numCond = parseFloat(cond);
    const isNumeric = !isNaN(numVal) && !isNaN(numCond);

    const a = isNumeric ? numVal : String(val);
    const b = isNumeric ? numCond : String(cond);

    switch (operator) {
      case '等しい':
        return a === b;
      case '等しくない':
        return a !== b;
      case '含む':
        return String(a).includes(String(b));
      case '以上':
        return a >= b;
      case '以下':
        return a <= b;
      case 'より大きい':
        return a > b;
      case 'より小さい':
        return a < b;
      default:
        return false;
    }
  };

  // 現在値の取得をgetValue(fieldCode, fieldType)として注入し、各フィールドの必須状態を返す
  const computeRequiredStates = (layoutRows, conditions, getValue) => {
    const states = {};
    (layoutRows || []).forEach((item) => {
      const code = item.value.insert_column && item.value.insert_column.value;
      if (code) {
        states[code] = false;
      }
    });

    if (!Array.isArray(conditions)) {
      return states;
    }

    conditions.forEach((item) => {
      const rule = normalizeConditionRule(item);
      if (
        !rule.triggerField ||
        !rule.targetField ||
        states[rule.targetField] === undefined
      ) {
        return;
      }
      const triggerLayout = (layoutRows || []).find(
        (l) =>
          l.value.insert_column &&
          l.value.insert_column.value === rule.triggerField,
      );
      const triggerType =
        triggerLayout && triggerLayout.value.field_type
          ? triggerLayout.value.field_type.value
          : '';
      const currentVal = getValue(rule.triggerField, triggerType);
      if (evaluateCondition(currentVal, rule.operator, rule.value)) {
        if (rule.action === '必須にする') {
          states[rule.targetField] = true;
        }
      }
    });

    return states;
  };

  // ---- 保存時のJSON生成 ----

  const safeParseJson = (text, fallback) => {
    if (!text) {
      return fallback;
    }
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  };

  // 保存JSONは { layout: [...], condition: [...] }。
  // 旧カスタマイズはcondition_jsonの「文字列」をそのまま入れていたため、回答アプリ側の
  // applyDynamicLogic(Array.isArray判定)が常にスキップされ動的必須が効かないバグがあった。
  // ここでパースして配列として保存する。
  const buildSettingJson = (sortedLayoutRows, conditionJsonText) => {
    const condition = safeParseJson(conditionJsonText, []);
    return JSON.stringify({
      layout: sortedLayoutRows,
      condition: Array.isArray(condition) ? condition : [],
    });
  };

  // 保存JSON(または旧形式)を読み取り側で安全に展開する
  const parseSettingJson = (jsonText) => {
    const parsed = safeParseJson(jsonText, null);
    if (!parsed || !Array.isArray(parsed.layout)) {
      return { layout: [], condition: [] };
    }
    let condition = parsed.condition;
    if (typeof condition === 'string') {
      // 旧カスタマイズで保存されたレコード互換(文字列のまま格納されている)
      condition = safeParseJson(condition, []);
    }
    return {
      layout: parsed.layout,
      condition: Array.isArray(condition) ? condition : [],
    };
  };

  // ---- 関連リンクのリッチテキスト生成(XSS対策) ----

  const escapeHtml = (text) =>
    String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // href に入れてよいのは http/https の絶対URLのみ(javascript:等のスキームを拒否)
  const isSafeUrl = (url) => /^https?:\/\//i.test(String(url || '').trim());

  // related_linksテーブルの行(link_link/link_display_label)からリッチテキストHTMLを生成する。
  // 旧カスタマイズは未エスケープでHTML連結していたため、URL・ラベルともエスケープする。
  const buildRelatedLinksHtml = (linkRows) => {
    let html = '';
    (linkRows || []).forEach((row) => {
      const url = row.value.link_link && row.value.link_link.value;
      const label =
        row.value.link_display_label && row.value.link_display_label.value;
      if (!url || !isSafeUrl(url)) {
        return;
      }
      const text = label && String(label).trim() !== '' ? label : url;
      html += `<a href="${escapeHtml(String(url).trim())}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a><br />`;
    });
    return html;
  };

  const FormModel = {
    CHOICE_REQUIRED_TYPES,
    validateFormLayout,
    sortLayoutByOrder,
    parseChoices,
    toDatetimeLocal,
    fromDatetimeLocalToISO,
    normalizeConditionRule,
    evaluateCondition,
    computeRequiredStates,
    safeParseJson,
    buildSettingJson,
    parseSettingJson,
    escapeHtml,
    isSafeUrl,
    buildRelatedLinksHtml,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormModel;
  } else {
    root.ResearchAnswer = root.ResearchAnswer || {};
    root.ResearchAnswer.FormModel = FormModel;
  }
})(typeof window !== 'undefined' ? window : globalThis);
