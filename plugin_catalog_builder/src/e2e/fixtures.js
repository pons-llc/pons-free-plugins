'use strict';

// このプラグインのe2eテストが必要とする前提を冪等に用意する。
// このプラグインは対象アプリ側に事前フィールドを必要としない(config.js自身が
// plugin_id/plugin_name/plugin_version/plugin_detail/pcb_apps_tableを自動作成するため、それ自体が
// config-save.e2e.test.jsの検証対象)。ここでは共通ツール scripts/kintone-admin.js の
// ensurePluginAdded() で、アップロード済みのプラグインをテスト対象アプリに追加するだけを行う。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const ensurePluginAddedToApp = (env, appId, pluginId) =>
  kintoneAdmin.ensurePluginAdded(env, appId, pluginId);

module.exports = { ensurePluginAddedToApp };
