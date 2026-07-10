(function (global, kintone) {
  'use strict';

  const NS = global.AutoLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じロジック(record オブジェクトの形式・lookupプロパティによる再取得指示はPC・
  // モバイル共通の仕様)。
  kintone.events.on('mobile.app.record.edit.show', async (event) => {
    if (config.targetFieldCodes.length === 0) {
      return event;
    }
    const formFields = await kintone.app.getFormFields();
    const targets = NS.LookupTargetResolver.resolveLookupTargets(
      config.targetFieldCodes,
      formFields,
    );
    NS.LookupTrigger.applyLookupTriggers(event.record, targets);
    return event;
  });
})(window, kintone);
