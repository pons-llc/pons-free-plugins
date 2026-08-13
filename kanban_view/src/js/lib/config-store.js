(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きを行う。
  // 一覧(view)ごとに独立した表示設定を持てるよう、viewConfigs は配列としてJSON文字列で保存する
  // (calendar_view/src/js/lib/config-store.js と同じ方式)。

  const GROUP_MODE_FIELD = 'FIELD';
  const GROUP_MODE_STATUS = 'STATUS';
  const ASSIGNEE_MODE_USER_FIELD = 'USER_FIELD';
  const ASSIGNEE_MODE_STATUS_ASSIGNEE = 'STATUS_ASSIGNEE';

  const VIEW_CONFIG_DEFAULTS = {
    viewId: '',
    viewName: '',
    groupMode: GROUP_MODE_FIELD,
    groupFieldCode: '',
    assigneeMode: ASSIGNEE_MODE_USER_FIELD,
    assigneeFieldCode: '',
    titleFieldCode: '',
    dueFieldCode: '',
    badgeFieldCode: '',
    hoverFieldCodes: [],
  };

  const parseJsonOr = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  // 古いバージョンの保存データや部分的なオブジェクトが来ても、欠けているキーだけ既定値で補う。
  const normalizeViewConfig = (raw) => {
    const merged = Object.assign({}, VIEW_CONFIG_DEFAULTS, raw || {});
    merged.viewId =
      merged.viewId === '' || merged.viewId == null
        ? 'ALL'
        : String(merged.viewId);
    merged.groupMode =
      merged.groupMode === GROUP_MODE_STATUS
        ? GROUP_MODE_STATUS
        : GROUP_MODE_FIELD;
    merged.assigneeMode =
      merged.assigneeMode === ASSIGNEE_MODE_STATUS_ASSIGNEE
        ? ASSIGNEE_MODE_STATUS_ASSIGNEE
        : ASSIGNEE_MODE_USER_FIELD;
    merged.hoverFieldCodes = Array.isArray(merged.hoverFieldCodes)
      ? merged.hoverFieldCodes
      : [];
    return merged;
  };

  // getConfig()はプラグインが未設定のアプリでは null を返すことがあるため、
  // saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    const viewConfigs = parseJsonOr(saved.viewConfigs, []).map(
      normalizeViewConfig,
    );
    return { viewConfigs };
  };

  const serialize = (config) => ({
    viewConfigs: JSON.stringify(
      (config.viewConfigs || []).map(normalizeViewConfig),
    ),
  });

  const ConfigStore = {
    GROUP_MODE_FIELD,
    GROUP_MODE_STATUS,
    ASSIGNEE_MODE_USER_FIELD,
    ASSIGNEE_MODE_STATUS_ASSIGNEE,
    VIEW_CONFIG_DEFAULTS,
    normalizeViewConfig,
    load,
    serialize,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.KanbanView = root.KanbanView || {};
    root.KanbanView.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
