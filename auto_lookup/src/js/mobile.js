(function (global, kintone) {
  'use strict';

  const NS = global.AutoLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じロジック(record オブジェクトの形式・lookupプロパティによる再取得指示はPC・
  // モバイル共通の仕様)。フィールドごとの発動タイミング設定もdesktop.jsと共有する。
  const targetFieldCodesFor = (triggerEvent) =>
    Object.keys(config.fieldTriggers).filter((code) =>
      config.fieldTriggers[code].includes(triggerEvent),
    );

  const runAutoLookup = (triggerEvent) => async (event) => {
    const targetFieldCodes = targetFieldCodesFor(triggerEvent);
    if (targetFieldCodes.length === 0) {
      return event;
    }
    const formFields = await kintone.app.getFormFields();
    const targets = NS.LookupTargetResolver.resolveLookupTargets(
      targetFieldCodes,
      formFields,
    );
    NS.LookupTrigger.applyLookupTriggers(event.record, targets);
    return event;
  };

  kintone.events.on(
    'mobile.app.record.create.show',
    runAutoLookup('create.show'),
  );
  kintone.events.on('mobile.app.record.edit.show', runAutoLookup('edit.show'));
})(window, kintone);
