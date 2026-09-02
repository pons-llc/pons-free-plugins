(function (global, kintone) {
  'use strict';

  const NS = global.AutoLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  const runAutoLookup = async (event) => {
    if (config.targetFieldCodes.length === 0) {
      return event;
    }
    // ルックアップフィールドかどうかの判定にはフォーム設定情報(lookupプロパティの有無)が必要なため、
    // kintone.app.getFormFields()で取得する(idea.mdの「ルックアップフィールドの判定」参照)。
    const formFields = await kintone.app.getFormFields();
    const targets = NS.LookupTargetResolver.resolveLookupTargets(
      config.targetFieldCodes,
      formFields,
    );
    NS.LookupTrigger.applyLookupTriggers(event.record, targets);
    return event;
  };

  // 発動タイミングは設定画面のチェックボックス(config.triggerEvents)で選ぶ。未設定時の既定値は
  // ['edit.show'](config-store.jsのDEFAULTS)で、この機能追加より前の挙動と変わらない。
  // 「保存するとき(submit)」はkintone公式ドキュメント「イベントオブジェクトで実行できる操作」の
  // 対応表でルックアップの自動取得が非対応(✕)のため選択肢に含めない。
  if (config.triggerEvents.includes('create.show')) {
    kintone.events.on('app.record.create.show', runAutoLookup);
  }
  if (config.triggerEvents.includes('edit.show')) {
    kintone.events.on('app.record.edit.show', runAutoLookup);
  }
})(window, kintone);
