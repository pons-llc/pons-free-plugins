'use strict';

// このプラグインのe2eテストが必要とする、対象アプリ(TEST_APP_ID_1)の一覧(view)を冪等に用意する。
// アプリの一覧設定を取得するJavaScript APIは無いため、config.js同様REST APIで扱う
// (idea.md「API仕様確認」参照)。
//
// 一覧の設定を変更するREST API(PUT /k/v1/preview/app/views.json)は「指定しなかった一覧は
// 削除される」仕様のため、既存の一覧(他プラグインのテストが作った一覧を含む可能性がある)を
// 必ず先にGETしてからPUTに含める。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const VIEW_NAME = 'budget_meter_e2e';

// PUTで受け付けるプロパティのみ残す(GETのレスポンスにはid等の読み取り専用プロパティが
// 含まれており、そのままPUTに渡すとエラーになるため)。
const VIEW_REQUEST_KEYS = [
  'index',
  'type',
  'name',
  'fields',
  'date',
  'title',
  'html',
  'pager',
  'device',
  'filterCond',
  'sort',
];
const toRequestView = (view) => {
  const filtered = {};
  VIEW_REQUEST_KEYS.forEach((key) => {
    if (view[key] !== undefined) {
      filtered[key] = view[key];
    }
  });
  return filtered;
};

const ensureBudgetMeterView = async (env, appId, numberFieldCode) => {
  const current = await kintoneAdmin.request(
    env,
    '/k/v1/preview/app/views.json',
    'GET',
    { app: appId },
  );
  const existing = current.views[VIEW_NAME];
  if (existing) {
    return existing.id;
  }

  const views = {};
  Object.entries(current.views).forEach(([name, view]) => {
    views[name] = toRequestView(view);
  });
  views[VIEW_NAME] = {
    index: String(Object.keys(views).length),
    type: 'LIST',
    name: VIEW_NAME,
    fields: ['レコード番号', numberFieldCode],
    sort: 'レコード番号 asc',
  };

  const res = await kintoneAdmin.request(
    env,
    '/k/v1/preview/app/views.json',
    'PUT',
    { app: appId, views },
  );
  await kintoneAdmin.deployApp(env, appId);
  return res.views[VIEW_NAME].id;
};

module.exports = { VIEW_NAME, ensureBudgetMeterView };
