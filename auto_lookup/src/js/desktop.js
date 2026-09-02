(function (global, kintone) {
  'use strict';

  const NS = global.AutoLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // フィールド(またはサブテーブル)ごとに発動タイミングを選べるため、対象イベントごとに
  // 「そのイベントを選んでいるフィールドコード」だけを絞り込んでから再取得を行う。
  const targetFieldCodesFor = (triggerEvent) =>
    Object.keys(config.fieldTriggers).filter((code) =>
      config.fieldTriggers[code].includes(triggerEvent),
    );

  const runAutoLookup = (triggerEvent) => async (event) => {
    const targetFieldCodes = targetFieldCodesFor(triggerEvent);
    if (targetFieldCodes.length === 0) {
      return event;
    }
    // ルックアップフィールドかどうかの判定にはフォーム設定情報(lookupプロパティの有無)が必要なため、
    // kintone.app.getFormFields()で取得する(idea.mdの「ルックアップフィールドの判定」参照)。
    const formFields = await kintone.app.getFormFields();
    const targets = NS.LookupTargetResolver.resolveLookupTargets(
      targetFieldCodes,
      formFields,
    );
    NS.LookupTrigger.applyLookupTriggers(event.record, targets);
    return event;
  };

  // 「保存するとき(submit)」はkintone公式ドキュメント「イベントオブジェクトで実行できる操作」の
  // 対応表でルックアップの自動取得が非対応(✕)のため対象イベントに含めない。
  kintone.events.on('app.record.create.show', runAutoLookup('create.show'));
  kintone.events.on('app.record.edit.show', runAutoLookup('edit.show'));
})(window, kintone);
