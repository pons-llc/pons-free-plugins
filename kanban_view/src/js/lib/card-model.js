(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./format-field-value'),
      require('./due-date'),
      require('./assignee-resolver'),
    );
  } else {
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.CardModel = factory(
      root.KanbanView.FormatFieldValue,
      root.KanbanView.DueDate,
      root.KanbanView.AssigneeResolver,
    );
  }
})(
  typeof window !== 'undefined' ? window : globalThis,
  function (FormatFieldValue, DueDate, AssigneeResolver) {
    'use strict';

    // レコード1件+一覧設定+フォームフィールド情報から、カード描画用のデータモデルへ変換する
    // 統合ロジック(idea.md「カードの表示項目」参照)。DOM操作は一切行わない
    // (タイトルはtextContent、ホバーはtitle属性へのプロパティ代入で描画側がHTMLエスケープの
    // 心配なく挿入できる)。
    //
    // viewConfig: js/lib/config-store.js が正規化した1件分の設定
    //   (titleFieldCode/dueFieldCode/badgeFieldCode/hoverFieldCodes/assigneeMode/assigneeFieldCode)
    // context: { formFields, statusAssigneeFieldCode, now }
    //   formFields: kintone.app.getFormFields() の戻り値(ホバー項目のラベル表示に使う)
    //   statusAssigneeFieldCode: STATUS_ASSIGNEE型フィールドのコード(js/lib/field-lookup.jsで特定済み)
    //   now: 期限超過判定の基準時刻(js/lib/due-date.js参照)

    const labelOf = (formFields, code) => {
      const field = formFields && formFields[code];
      return field ? field.label : code;
    };

    const buildHoverText = (record, hoverFieldCodes, formFields) =>
      (hoverFieldCodes || [])
        .map((code) => {
          const value = FormatFieldValue.formatFieldValue(record[code]);
          return value === '' ? null : `${labelOf(formFields, code)}: ${value}`;
        })
        .filter((line) => line !== null)
        .join('\n');

    const buildCard = (record, viewConfig, context) => {
      const ctx = context || {};
      const formFields = ctx.formFields || {};

      const dueValue = viewConfig.dueFieldCode
        ? currentValueOf(record, viewConfig.dueFieldCode)
        : null;

      return {
        id: record.$id ? record.$id.value : undefined,
        title: FormatFieldValue.formatFieldValue(
          record[viewConfig.titleFieldCode],
        ),
        hoverText: buildHoverText(
          record,
          viewConfig.hoverFieldCodes,
          formFields,
        ),
        dueLabel: DueDate.formatDueDate(dueValue),
        overdue: DueDate.isOverdue(dueValue, ctx.now),
        badgeLabel: viewConfig.badgeFieldCode
          ? FormatFieldValue.formatFieldValue(record[viewConfig.badgeFieldCode])
          : '',
        assignee: AssigneeResolver.resolveAssignee(
          record,
          viewConfig.assigneeMode,
          {
            assigneeFieldCode: viewConfig.assigneeFieldCode,
            statusAssigneeFieldCode: ctx.statusAssigneeFieldCode,
          },
        ),
      };
    };

    function currentValueOf(record, fieldCode) {
      const field = record[fieldCode];
      return field ? field.value : undefined;
    }

    return { buildCard };
  },
);
