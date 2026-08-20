(function (global, kintone) {
  'use strict';

  const NS = global.DateOffsetAutofill;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // 出力先フィールドは常にプラグインが上書きする値なので、追加・編集画面では直接入力できないように
  // disabledにする(idea.mdの「発動タイミング・編集禁止の仕様」参照)。
  const disableTargetFields = (record) => {
    config.rules.forEach((rule) => {
      const targetField = record[rule.targetFieldCode];
      if (targetField) {
        targetField.disabled = true;
      }
    });
  };

  // 基準フィールドの値をオフセット計算し、出力先フィールドへ反映する。
  // 基準フィールドの型はkintone.app.getFormFields()から取得し直さず、event.recordのtype
  // (フィールド形式取得時にも含まれる)をそのまま使う(REST API呼び出し不要)。
  // isInlineEditは一覧画面のインライン編集(app.record.index.edit.submit)から呼ばれたことを示す。
  // このコンテキストでは、一覧に配置していないCALCフィールドの値が「再計算前の値」のまま返る
  // ことがある(OffsetCalculator.isUnreliableInlineEditOffsetのコメント参照)ため、CALCフィールドを
  // オフセット参照に使うルールは誤った日付を書き込まないようスキップする。
  const applyRules = (record, isInlineEdit) => {
    config.rules.forEach((rule) => {
      const baseField = record[rule.baseFieldCode];
      const targetField = record[rule.targetFieldCode];
      // 基準・出力先フィールドが存在しない(フィールド削除・設定の食い違い等)場合は
      // 何もせず、画面全体をクラッシュさせない。
      if (!baseField || !targetField) {
        return;
      }
      let offsetFieldRawValue;
      if (rule.offsetSource === 'FIELD') {
        const offsetField = record[rule.offsetFieldCode];
        if (!offsetField) {
          return;
        }
        if (
          isInlineEdit &&
          NS.OffsetCalculator.isUnreliableInlineEditOffset(
            rule,
            offsetField.type,
          )
        ) {
          return;
        }
        offsetFieldRawValue = offsetField.value;
      }
      const newValue = NS.OffsetCalculator.computeTargetValue(
        rule,
        baseField.value,
        baseField.type,
        offsetFieldRawValue,
      );
      // 計算できなかった場合(基準値が空、オフセットが数値として解決できない等)は
      // 出力先フィールドを変更しない(idea.mdの「エッジケース」参照)。
      if (newValue !== null) {
        targetField.value = newValue;
      }
    });
  };

  kintone.events.on(
    ['app.record.create.show', 'app.record.edit.show'],
    (event) => {
      disableTargetFields(event.record);
      return event;
    },
  );

  kintone.events.on(
    ['app.record.create.submit', 'app.record.edit.submit'],
    (event) => {
      applyRules(event.record, false);
      return event;
    },
  );

  // レコード一覧画面のインライン編集では、出力先フィールドの直接編集を禁止する
  // (idea.mdの「対応画面」参照)。基準フィールドは自由に編集できてよいため対象外。
  // モバイルにはインライン編集自体が存在しない。
  kintone.events.on('app.record.index.edit.show', (event) => {
    disableTargetFields(event.record);
    return event;
  });

  // 一覧画面のインライン編集で基準フィールドを直接変更して保存した場合も、通常の追加・編集画面と
  // 同様に出力先フィールドを再計算する(idea.md「対応画面」2026-08-21改訂)。
  kintone.events.on('app.record.index.edit.submit', (event) => {
    applyRules(event.record, true);
    return event;
  });
})(window, kintone);
