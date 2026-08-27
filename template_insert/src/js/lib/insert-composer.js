(function (root) {
  'use strict';

  // 挿入先フィールドの既存値と、解決済みのテンプレート文字列から新しい値を組み立てる
  // (idea.md「挿入方式」参照。カーソル位置への挿入ではなく末尾追記、またはmode: 'OVERWRITE'
  // 指定時は既存値を破棄して上書き)。追加(APPEND、既定)の場合、既存値が空なら区切り文字を
  // 挟まずそのまま設定する。insertTextが空(例: サブテーブルに行が無い)の場合は
  // モードによらず既存値をそのまま返す(呼び出し側で事前に案内を出す想定のため、
  // ここで空文字列に上書きしてしまわない)。

  const APPEND_SEPARATOR = {
    MULTI_LINE_TEXT: '\n',
    RICH_TEXT: '<br>',
  };

  const composeInsertedValue = ({
    currentValue,
    insertText,
    targetFieldType,
    mode,
  }) => {
    if (!insertText) {
      return currentValue || '';
    }
    if (mode === 'OVERWRITE') {
      return insertText;
    }
    if (!currentValue) {
      return insertText;
    }
    const separator = APPEND_SEPARATOR[targetFieldType] || '\n';
    return currentValue + separator + insertText;
  };

  const InsertComposer = { composeInsertedValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = InsertComposer;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.InsertComposer = InsertComposer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
