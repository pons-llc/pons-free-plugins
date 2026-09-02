(function (global, kintone) {
  'use strict';

  const NS = global.AutoLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // desktop.js と同じロジック(record オブジェクトの形式・lookupプロパティによる再取得指示はPC・
  // モバイル共通の仕様)。
  const runAutoLookup = async (event) => {
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
  };

  // desktop.jsと同じtriggerEvents設定を参照する(PC・モバイルで同じ設定を共有)。
  if (config.triggerEvents.includes('create.show')) {
    kintone.events.on('mobile.app.record.create.show', runAutoLookup);
  }
  if (config.triggerEvents.includes('edit.show')) {
    kintone.events.on('mobile.app.record.edit.show', runAutoLookup);
  }
})(window, kintone);
