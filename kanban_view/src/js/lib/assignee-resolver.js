(function (root) {
  'use strict';

  // カードに表示する担当者を1名だけ取り出す純粋ロジック。idea.md「担当者の表示」参照。
  //
  // USER_SELECT/STATUS_ASSIGNEE(作業者)は、どちらもレコード上は
  // { value: [{ code, name }, ...] } という同じ配列形式(kintoneドキュメントMCPで確認済み。
  // 作業者はプロセス管理の作業者設定がONE/ALL/ANYのいずれでも配列で返る)。
  // 「先頭の1人」をカードに表示する(ユーザー指示)。0人(未割当)ならnullを返す。
  //
  // options: { assigneeFieldCode, statusAssigneeFieldCode }
  const resolveAssignee = (record, assigneeMode, options) => {
    const opts = options || {};
    const fieldCode =
      assigneeMode === 'STATUS_ASSIGNEE'
        ? opts.statusAssigneeFieldCode
        : opts.assigneeFieldCode;
    if (!fieldCode) {
      return null;
    }
    const field = record[fieldCode];
    const value = field && Array.isArray(field.value) ? field.value : [];
    if (value.length === 0) {
      return null;
    }
    const first = value[0];
    return { code: first.code, name: first.name || first.code };
  };

  const AssigneeResolver = { resolveAssignee };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssigneeResolver;
  } else {
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.AssigneeResolver = AssigneeResolver;
  }
})(typeof window !== 'undefined' ? window : globalThis);
