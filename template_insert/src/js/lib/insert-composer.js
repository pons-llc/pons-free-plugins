(function (root) {
  'use strict';

  // 挿入先フィールドの既存値の末尾に、解決済みのテンプレート文字列を追記した新しい値を組み立てる
  // (idea.md「挿入方式」参照。カーソル位置への挿入ではなく末尾追記)。既存値が空なら区切り文字を
  // 挟まずそのまま設定する。insertTextが空(例: サブテーブルに行が無い)の場合は既存値をそのまま
  // 返す(空の区切り文字だけが残ることを防ぐ。呼び出し側で事前に案内を出す想定)。

  const APPEND_SEPARATOR = {
    MULTI_LINE_TEXT: '\n',
    RICH_TEXT: '<br>',
  };

  const composeInsertedValue = ({
    currentValue,
    insertText,
    targetFieldType,
  }) => {
    if (!insertText) {
      return currentValue || '';
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
