(function (global, kintone) {
  'use strict';

  const NS = global.InputFormatRule;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // ロジックはdesktop.jsと完全に共有し(js/lib/配下)、イベント名のみモバイル用の
  // 'mobile.'プレフィックス付きに変える(subtable_sortと同じ構成、idea.md「対応画面」参照)。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  config.rules.forEach((rule) => {
    kintone.events.on(
      [
        `mobile.app.record.create.change.${rule.fieldCode}`,
        `mobile.app.record.edit.change.${rule.fieldCode}`,
      ],
      (event) => {
        const field = event.record[rule.fieldCode];
        if (field) {
          field.error = NS.RecordValidator.validateFieldValue(
            field.value,
            rule,
          );
        }
        return event;
      },
    );
  });

  kintone.events.on(
    ['mobile.app.record.create.submit', 'mobile.app.record.edit.submit'],
    (event) => {
      const { fieldMessages, hasError } = NS.RecordValidator.validateRecord(
        event.record,
        config.rules,
      );
      Object.keys(fieldMessages).forEach((fieldCode) => {
        event.record[fieldCode].error = fieldMessages[fieldCode];
      });
      if (hasError) {
        event.error =
          '入力内容にエラーがあります。各項目のエラーメッセージを確認してください。';
      }
      return event;
    },
  );
})(window, kintone);
