'use strict';

// このプラグインのe2eテストが必要とするデータを冪等に用意する。
//
// TEST_APP_ID_1には標準の文字列(1行)「文字列__1行_」・ドロップダウン「ドロップダウン」
// (選択肢: sample1/sample2)・ラジオボタン「ラジオボタン」(選択肢: sample1/sample2)・
// 日付「日付」・ユーザー選択「ユーザー選択」・プロセス管理(STATUS「ステータス」・
// STATUS_ASSIGNEE「作業者」)が既存で用意済み(CLAUDE.md記載の前提。実機で
// GET /k/v1/app/form/fields.json を確認して型を特定済み)のため、新規フィールド作成は行わない。
//
// 他プラグインのfixtures.jsは専用のマーカーフィールド(「文字列__1行__0」〜「__2」)を使って
// 自分のシードレコードを再実行時に見分けているが、TEST_APP_ID_1のトップレベルには
// SINGLE_LINE_TEXT型の空きフィールドがもう無い(「文字列__1行__3」はテーブル内にのみ存在し、
// テーブル内フィールドは`=`/`in`のクエリ演算子が使えないため識別子に使えないことを実機で確認済み)。
// そのためマーカーフィールドは持たず、タイトルフィールド(文字列__1行_)自体に本プラグイン固有の
// 一意な値を入れ、それをそのまま検索キーとしても使う。
//
// 期限超過(🔥)の表示を確認できるよう、片方は過去日付(超過)・もう片方は未来日付(未超過)にする。

const kintoneAdmin = require('../../../scripts/kintone-admin');

const TITLE_FIELD_CODE = '文字列__1行_';
const GROUP_FIELD_CODE = 'ドロップダウン';
const BADGE_FIELD_CODE = 'ラジオボタン';
const DUE_FIELD_CODE = '日付';
const ASSIGNEE_FIELD_CODE = 'ユーザー選択';
// bulk_field_updateプラグインのe2eテストが追加した必須フィールド。TEST_APP_ID_1の他アプリ全体に
// 影響する必須制約のため、新規レコード作成時は値を埋める必要がある(このプラグイン固有の項目ではない)。
const REQUIRED_TEST_FIELD_CODE = 'bfu_required_test_field';

const SEED_RECORDS = [
  {
    title: 'カンバンE2E-A(超過)',
    groupValue: 'sample1',
    badgeValue: 'sample1',
    dueValue: '2020-01-01',
  },
  {
    title: 'カンバンE2E-B(未超過)',
    groupValue: 'sample2',
    badgeValue: 'sample2',
    dueValue: '2099-01-01',
  },
];

const ensureSeedRecord = async (env, appId, seed) => {
  const existing = await kintoneAdmin.request(
    env,
    '/k/v1/records.json',
    'GET',
    {
      app: appId,
      query: `${TITLE_FIELD_CODE} = "${seed.title}"`,
    },
  );

  const record = {
    [TITLE_FIELD_CODE]: { value: seed.title },
    [GROUP_FIELD_CODE]: { value: seed.groupValue },
    [BADGE_FIELD_CODE]: { value: seed.badgeValue },
    [DUE_FIELD_CODE]: { value: seed.dueValue },
    [ASSIGNEE_FIELD_CODE]: { value: [{ code: env.KINTONE_USERNAME }] },
    [REQUIRED_TEST_FIELD_CODE]: { value: 'kv_e2e' },
  };

  if (existing.records && existing.records.length > 0) {
    const recordId = existing.records[0].$id.value;
    await kintoneAdmin.request(env, '/k/v1/record.json', 'PUT', {
      app: appId,
      id: recordId,
      record,
    });
    return { created: false, recordId };
  }

  const res = await kintoneAdmin.request(env, '/k/v1/record.json', 'POST', {
    app: appId,
    record,
  });
  return { created: true, recordId: res.id };
};

const ensureSeedRecords = async (env, appId) => {
  const results = [];
  for (const seed of SEED_RECORDS) {
    results.push(await ensureSeedRecord(env, appId, seed));
  }
  return results;
};

// TEST_APP_ID_1にはcalendar_view等、同じくkintone.app.getHeaderSpaceElement()へ描画する
// 「一覧すべて(ALL)」向けの表示専用プラグインが既に設定されており、同じ一覧を開くと
// 後から発火したプラグインのapp.record.index.showハンドラーが描画済みの内容を上書きしてしまう
// (実機で確認済み: calendar_viewの`.cv-root`がkanban_viewの`.kb-root`を上書きしていた)。
// このため、本プラグインのe2eテストは「すべて」ではなく専用の一覧(kanban_view_e2e)を作成し、
// そこにだけ本プラグインの設定を割り当てて、他プラグインとの描画競合を避ける
// (budget_meter/src/e2e/fixtures.jsのensureBudgetMeterView()と同じ方式)。
// 一覧の設定を変更するREST API(PUT /k/v1/preview/app/views.json)は「指定しなかった一覧は
// 削除される」仕様のため、既存の一覧を必ず先にGETしてからPUTに含める。

const VIEW_NAME = 'kanban_view_e2e';

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

const ensureKanbanView = async (env, appId) => {
  const current = await kintoneAdmin.request(
    env,
    '/k/v1/preview/app/views.json',
    'GET',
    {
      app: appId,
    },
  );
  const existing = current.views[VIEW_NAME];
  if (existing) {
    return existing.id;
  }

  const views = {};
  Object.entries(current.views).forEach(([name, view]) => {
    views[name] = toRequestView(view);
  });
  const titleValues = SEED_RECORDS.map((seed) => `"${seed.title}"`).join(', ');
  views[VIEW_NAME] = {
    index: String(Object.keys(views).length),
    type: 'LIST',
    name: VIEW_NAME,
    fields: [
      TITLE_FIELD_CODE,
      GROUP_FIELD_CODE,
      BADGE_FIELD_CODE,
      DUE_FIELD_CODE,
    ],
    filterCond: `${TITLE_FIELD_CODE} in (${titleValues})`,
  };

  const res = await kintoneAdmin.request(
    env,
    '/k/v1/preview/app/views.json',
    'PUT',
    {
      app: appId,
      views,
    },
  );
  await kintoneAdmin.deployApp(env, appId);
  return res.views[VIEW_NAME].id;
};

module.exports = {
  TITLE_FIELD_CODE,
  GROUP_FIELD_CODE,
  BADGE_FIELD_CODE,
  DUE_FIELD_CODE,
  ASSIGNEE_FIELD_CODE,
  SEED_RECORDS,
  VIEW_NAME,
  ensureSeedRecords,
  ensureKanbanView,
};
