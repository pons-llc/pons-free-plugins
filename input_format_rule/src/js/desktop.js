(function (global, kintone) {
  'use strict';

  const NS = global.InputFormatRule;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // ルールが設定されているフィールドコードの分だけchangeイベントを登録する(設定にない
  // フィールドの分まで登録しない)。文字列1行フィールドのみ対象(idea.md「対象フィールド」参照、
  // 文字列複数行は.changeイベントが発火しないため対象外)。
  config.rules.forEach((rule) => {
    kintone.events.on(
      [
        `app.record.create.change.${rule.fieldCode}`,
        `app.record.edit.change.${rule.fieldCode}`,
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

  // 保存直前に全ルールをまとめて再チェックする(changeイベントを経由しない自動計算・
  // コピー&ペースト等の値変更も保存時に必ず捕捉するため)。フィールドにエラーを表示することが
  // 保存処理をキャンセルする方法の1つ(公式ドキュメント「保存処理をキャンセルする」参照)。
  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
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
