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

  // 基準フィールドの値をオフセット計算し、出力先フィールドへ反映する。idea.mdの方針通りsubmitイベントでのみ実行する。
  // 基準フィールドの型はkintone.app.getFormFields()から取得し直さず、event.recordのtype
  // (フィールド形式取得時にも含まれる)をそのまま使う(REST API呼び出し不要)。
  const applyRules = (record) => {
    config.rules.forEach((rule) => {
      const baseField = record[rule.baseFieldCode];
      const targetField = record[rule.targetFieldCode];
      // 基準・出力先フィールドが存在しない(フィールド削除・設定の食い違い等)場合は
      // 何もせず、画面全体をクラッシュさせない。
      if (!baseField || !targetField) {
        return;
      }
      const offsetFieldRawValue =
        rule.offsetSource === 'FIELD'
          ? record[rule.offsetFieldCode] && record[rule.offsetFieldCode].value
          : undefined;
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
      applyRules(event.record);
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
})(window, kintone);
