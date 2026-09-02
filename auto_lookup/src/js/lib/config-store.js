(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  //
  // 設定の中心は fieldTriggers: { [フィールドコード]: 発動タイミングの配列 } で、フィールド
  // (またはサブテーブル)ごとに発動タイミング('create.show'/'edit.show')を個別に選べる。
  // マップに含まれないフィールドコードは対象外(このプラグインを一切適用しない)を意味する。
  const DEFAULTS = {
    fieldTriggers: {},
  };

  const LEGACY_DEFAULT_TRIGGER_EVENTS = ['edit.show'];

  const parseJsonOr = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  // 過去の設定形式(フィールドごとの発動タイミングを導入する前)からの移行。
  // - 本当に古い形式(targetFieldCodesのみ、triggerEventsキー自体がない): 全対象フィールドを
  //   edit.showのみで発動していたため、そのままedit.showを割り当てる。
  // - 発動タイミングをフィールド単位ではなく全体で1つだけ選ぶ形式だった期間の設定
  //   (targetFieldCodes + 全体用のtriggerEvents): 対象フィールドすべてに同じtriggerEventsを
  //   割り当てる(既存ユーザーの保存内容を維持したまま新形式に変換するだけで、動作は変えない)。
  const migrateLegacyConfig = (saved) => {
    const targetFieldCodes = parseJsonOr(saved.targetFieldCodes, []);
    const legacyTriggerEvents = parseJsonOr(
      saved.triggerEvents,
      LEGACY_DEFAULT_TRIGGER_EVENTS,
    );
    const fieldTriggers = {};
    targetFieldCodes.forEach((code) => {
      fieldTriggers[code] = legacyTriggerEvents;
    });
    return fieldTriggers;
  };

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    if (saved.fieldTriggers) {
      return {
        fieldTriggers: parseJsonOr(saved.fieldTriggers, DEFAULTS.fieldTriggers),
      };
    }
    if (saved.targetFieldCodes) {
      return { fieldTriggers: migrateLegacyConfig(saved) };
    }
    return { fieldTriggers: DEFAULTS.fieldTriggers };
  };

  const serialize = (config) => ({
    fieldTriggers: JSON.stringify(config.fieldTriggers),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.AutoLookup = root.AutoLookup || {};
    root.AutoLookup.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
