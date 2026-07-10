(function (global, kintone) {
  'use strict';

  const NS = global.AutoLookup;
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // このプラグインの設定はレコード画面の表示中には変わらないため、画面読み込み時に一度だけ読み込む。
  const config = NS.ConfigStore.load(kintone.plugin.app.getConfig(PLUGIN_ID));

  // idea.mdの方針通りedit.showイベントのみで発動する(create.showは対象外、判断記録.mdの1番)。
  kintone.events.on('app.record.edit.show', async (event) => {
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
  });
})(window, kintone);
