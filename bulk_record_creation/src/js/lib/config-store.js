(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  // assigneeFieldCode: '' | fieldCode … 対象者フィールド(USER_SELECT/ORGANIZATION_SELECT/
  //   GROUP_SELECT)。未設定なら対象者展開機能を使わない。
  // dateFieldCode: '' | fieldCode … 繰り返し用日付/日時フィールド(DATE/DATETIME)。
  //   未設定なら繰り返し展開機能を使わない。
  // endDateFieldCode: '' | fieldCode … 終了日時フィールド(DATETIME、任意)。dateFieldCode
  //   がDATETIME型の場合のみ使う。開始日時の繰り返しに対応する終了日時(固定の時刻の終了時刻、
  //   または時間帯分割の各枠の終了時刻)を書き込む。idea.md「終了日時フィールド」参照。
  // templateFieldCodes: [fieldCode, ...] … テンプレート対象フィールド(値は保存しない。
  //   値は実行のたびに確認ダイアログで入力する。idea.md「テンプレート対象フィールドの絞り込み」参照)
  // groupCodes: [code, ...] … 一覧画面ボタンを表示する実行可能グループ
  const DEFAULTS = {
    assigneeFieldCode: '',
    dateFieldCode: '',
    endDateFieldCode: '',
    templateFieldCodes: [],
    groupCodes: [],
  };

  const parseJsonString = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === typeof fallback ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const parseJsonArray = (raw) => {
    const parsed = parseJsonString(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  };

  const load = (rawConfig) => {
    if (!rawConfig) {
      return { ...DEFAULTS };
    }
    return {
      assigneeFieldCode: parseJsonString(rawConfig.assigneeFieldCode, ''),
      dateFieldCode: parseJsonString(rawConfig.dateFieldCode, ''),
      endDateFieldCode: parseJsonString(rawConfig.endDateFieldCode, ''),
      templateFieldCodes: parseJsonArray(rawConfig.templateFieldCodes),
      groupCodes: parseJsonArray(rawConfig.groupCodes),
    };
  };

  const serialize = (config) => ({
    assigneeFieldCode: JSON.stringify(
      typeof (config && config.assigneeFieldCode) === 'string'
        ? config.assigneeFieldCode
        : '',
    ),
    dateFieldCode: JSON.stringify(
      typeof (config && config.dateFieldCode) === 'string'
        ? config.dateFieldCode
        : '',
    ),
    endDateFieldCode: JSON.stringify(
      typeof (config && config.endDateFieldCode) === 'string'
        ? config.endDateFieldCode
        : '',
    ),
    templateFieldCodes: JSON.stringify(
      Array.isArray(config && config.templateFieldCodes)
        ? config.templateFieldCodes
        : [],
    ),
    groupCodes: JSON.stringify(
      Array.isArray(config && config.groupCodes) ? config.groupCodes : [],
    ),
  });

  const ConfigStore = { load, serialize, DEFAULTS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
