'use strict';

// このプラグインは依頼アプリのプロセス管理をONにし、対象アプリのフィールド設定を書き換えてデプロイするため、
// 共有のTEST_APP_ID_1/2は使わず専用の検証アプリを使う(他プラグインのE2Eを壊さないため)。
// 2026-10-21にこのプラグインのE2E用に作成した:
//   790: [e2e] アプリ設定変更依頼(依頼アプリ) … プラグインを追加するアプリ
//   791: [e2e] アプリ設定変更依頼(変更対象アプリ) … 依頼で設定を変更されるアプリ

const kintoneAdmin = require('../../../scripts/kintone-admin');
const FieldDefs = require('../js/lib/field-defs.js');
const ProcessSetup = require('../js/lib/process-setup.js');

const REQUEST_APP_ID = process.env.ASR_REQUEST_APP_ID || '790';
const TARGET_APP_ID = process.env.ASR_TARGET_APP_ID || '791';

const TARGET_FIELDS = {
  title: {
    type: 'SINGLE_LINE_TEXT',
    code: 'title',
    label: '件名',
    required: false,
  },
  amount: { type: 'NUMBER', code: 'amount', label: '金額' },
  kind: {
    type: 'DROP_DOWN',
    code: 'kind',
    label: '種別',
    options: {
      A: { label: 'A', index: 0 },
      B: { label: 'B', index: 1 },
    },
  },
  tbl: {
    type: 'SUBTABLE',
    code: 'tbl',
    label: '明細',
    fields: {
      item: { type: 'SINGLE_LINE_TEXT', code: 'item', label: '品名' },
    },
  },
};

// 変更対象アプリを毎回同じ状態(件名: 任意)に戻す。未反映の変更が残っていれば取り消す。
const resetTargetApp = async (env) => {
  await kintoneAdmin.request(env, '/k/v1/preview/app/deploy.json', 'POST', {
    apps: [{ app: TARGET_APP_ID }],
    revert: true,
  });
  await new Promise((r) => setTimeout(r, 2000));
  await kintoneAdmin.ensureFormFields(env, TARGET_APP_ID, TARGET_FIELDS);
  // revert直後なので動作テスト環境=運用環境。
  const current = await kintoneAdmin.getFormFields(env, TARGET_APP_ID);
  const kindOptions = Object.keys(current.kind.options).sort().join(',');
  if (
    current.title.required ||
    current.title.label !== '件名' ||
    current.tbl.fields.item.label !== '品名' ||
    kindOptions !== 'A,B' ||
    current.kind.defaultValue !== 'A'
  ) {
    await kintoneAdmin.request(
      env,
      '/k/v1/preview/app/form/fields.json',
      'PUT',
      {
        app: TARGET_APP_ID,
        properties: {
          title: { type: 'SINGLE_LINE_TEXT', label: '件名', required: false },
          kind: {
            type: 'DROP_DOWN',
            options: TARGET_FIELDS.kind.options,
            defaultValue: 'A',
          },
          tbl: {
            type: 'SUBTABLE',
            fields: { item: { type: 'SINGLE_LINE_TEXT', label: '品名' } },
          },
        },
      },
    );
    await kintoneAdmin.deployApp(env, TARGET_APP_ID);
  }
};

// レコード系のテストを設定画面テストの実行順に依存させないため、依頼アプリの
// フィールド・スペース・プロセス管理をREST APIで冪等に用意する(設定画面の保存と同じ内容)。
const ensureRequestApp = async (env, approverCode) => {
  await kintoneAdmin.ensureFormFields(
    env,
    REQUEST_APP_ID,
    FieldDefs.buildAddFieldsPayload(FieldDefs.FIELD_DEFINITIONS),
  );
  await kintoneAdmin.ensureSpacerInLayout(
    env,
    REQUEST_APP_ID,
    FieldDefs.SPACER_ELEMENT_ID,
  );
  const status = await kintoneAdmin.request(
    env,
    '/k/v1/preview/app/status.json',
    'GET',
    { app: REQUEST_APP_ID },
  );
  const fields = await kintoneAdmin.getFormFields(env, REQUEST_APP_ID);
  const plan = ProcessSetup.planProcessSetup(status, {
    completeStatus: '完了',
    creatorFieldCode: FieldDefs.findCreatorFieldCode(fields),
    approverCode,
  });
  if (plan.action === 'error') {
    throw new Error(plan.error);
  }
  if (plan.action !== 'none') {
    await kintoneAdmin.request(env, '/k/v1/preview/app/status.json', 'PUT', {
      app: REQUEST_APP_ID,
      ...plan.body,
    });
    await kintoneAdmin.deployApp(env, REQUEST_APP_ID);
  }
};

// 一覧の依頼のE2Eで作った一覧(名前が「E2E一覧」で始まるもの)を変更対象アプリから消す。
const VIEW_NAME_PREFIX = 'E2E一覧';
const cleanupTargetViews = async (env) => {
  const resp = await kintoneAdmin.request(
    env,
    '/k/v1/preview/app/views.json',
    'GET',
    { app: TARGET_APP_ID },
  );
  const kept = {};
  let removed = false;
  Object.keys(resp.views).forEach((key) => {
    if (resp.views[key].name.startsWith(VIEW_NAME_PREFIX)) {
      removed = true;
    } else {
      kept[key] = resp.views[key];
    }
  });
  if (removed) {
    await kintoneAdmin.request(env, '/k/v1/preview/app/views.json', 'PUT', {
      app: TARGET_APP_ID,
      views: kept,
    });
    await kintoneAdmin.deployApp(env, TARGET_APP_ID);
  }
};

module.exports = {
  VIEW_NAME_PREFIX,
  cleanupTargetViews,
  REQUEST_APP_ID,
  TARGET_APP_ID,
  resetTargetApp,
  ensureRequestApp,
};
