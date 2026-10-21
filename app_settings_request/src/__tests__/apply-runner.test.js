const ApplyRunner = require('../js/lib/apply-runner.js');
const ChangeRequest = require('../js/lib/change-request.js');

const OWN_APP = '790';
const TARGET_APP = '791';

const targetProperties = {
  title: {
    type: 'SINGLE_LINE_TEXT',
    code: 'title',
    label: '件名',
    noLabel: false,
    required: false,
    minLength: '',
    maxLength: '',
    expression: '',
    unique: false,
    defaultValue: '',
  },
};

const makeChange = (overrides = {}) =>
  ChangeRequest.buildChange({
    app: { id: TARGET_APP, name: '案件管理', guestSpaceId: '' },
    field: {
      code: 'title',
      label: '件名',
      type: 'SINGLE_LINE_TEXT',
      subtableCode: '',
    },
    operation: 'required',
    before: false,
    after: true,
    ...overrides,
  });

const makeRecord = (change, appId = TARGET_APP) => ({
  asr_app_id: { type: 'NUMBER', value: appId },
  asr_change_json: {
    type: 'MULTI_LINE_TEXT',
    value: change === null ? '' : ChangeRequest.serialize(change),
  },
});

// path + method ごとに応答(関数 or 値)を決める偽のkintone.api。
const fakeApi = (routes) => {
  const calls = [];
  const api = jest.fn(async (path, method, body) => {
    calls.push({ path, method, body });
    const handler = routes[`${method} ${path}`];
    if (handler === undefined) {
      throw new Error(`unexpected call: ${method} ${path}`);
    }
    return typeof handler === 'function' ? handler(body, calls) : handler;
  });
  return { api, calls };
};

const defaultRoutes = (record, overrides = {}) => {
  let deployStatus = 'SUCCESS';
  return {
    'GET /self/k/v1/record.json': { record },
    'GET /k/v1/app/acl.json': { rights: [], revision: '3' },
    'GET /k/v1/app/form/fields.json': {
      properties: targetProperties,
      revision: '3',
    },
    'GET /k/v1/preview/app/form/fields.json': {
      properties: targetProperties,
      revision: '3',
    },
    'PUT /k/v1/preview/app/form/fields.json': { revision: '4' },
    'DELETE /k/v1/preview/app/form/fields.json': { revision: '4' },
    'POST /k/v1/preview/app/deploy.json': (body) => {
      if (body.revert) {
        return {};
      }
      return {};
    },
    'GET /k/v1/preview/app/deploy.json': () => ({
      apps: [{ app: TARGET_APP, status: deployStatus }],
    }),
    setDeployStatus: (s) => {
      deployStatus = s;
    },
    ...overrides,
  };
};

const run = (api, record) =>
  ApplyRunner.runApply({
    api,
    selfPath: (p) => `/self${p}`,
    wait: async () => {},
    record,
    ownAppId: OWN_APP,
    recordId: '10',
  });

describe('runApply', () => {
  test('成功: 権限確認 → 未反映の変更確認 → PUT(revision指定) → デプロイ', async () => {
    const record = makeRecord(makeChange());
    const { api, calls } = fakeApi(defaultRoutes(record));
    const result = await run(api, record);
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/案件管理/);
    expect(result.message).toMatch(/必須/);

    const put = calls.find((c) => c.method === 'PUT');
    expect(put.body).toEqual({
      app: TARGET_APP,
      revision: '3',
      properties: { title: { type: 'SINGLE_LINE_TEXT', required: true } },
    });
    const deploy = calls.find(
      (c) => c.method === 'POST' && c.path.endsWith('deploy.json'),
    );
    expect(deploy.body).toEqual({
      apps: [{ app: TARGET_APP, revision: '4' }],
    });
    // 権限確認はフィールドの変更より前
    const order = calls.map((c) => `${c.method} ${c.path}`);
    expect(order.indexOf('GET /k/v1/app/acl.json')).toBeLessThan(
      order.indexOf('PUT /k/v1/preview/app/form/fields.json'),
    );
  });

  test('ゲストスペースのアプリは /k/guest/{id}/v1/ を使う', async () => {
    const change = makeChange({
      app: { id: TARGET_APP, name: 'ゲスト', guestSpaceId: '5' },
    });
    const record = makeRecord(change);
    const routes = defaultRoutes(record);
    const guestRoutes = {};
    Object.keys(routes).forEach((key) => {
      guestRoutes[key.replace(' /k/v1/', ' /k/guest/5/v1/')] = routes[key];
    });
    const { api } = fakeApi(guestRoutes);
    const result = await run(api, record);
    expect(result.ok).toBe(true);
  });

  test('変更内容が空ならAPIを呼ばずにエラー', async () => {
    const record = makeRecord(null);
    const { api } = fakeApi({});
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });

  test('JSONのアプリIDとレコードの対象アプリIDが違えばエラー', async () => {
    const record = makeRecord(makeChange(), '999');
    const { api } = fakeApi({});
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/一致しません/);
  });

  test('依頼アプリ自身は対象にできない', async () => {
    const change = makeChange({
      app: { id: OWN_APP, name: '自分', guestSpaceId: '' },
    });
    const record = makeRecord(change, OWN_APP);
    const { api } = fakeApi({});
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });

  test('画面の内容が最新のレコードと違えばエラー(古い画面で承認しない)', async () => {
    const record = makeRecord(makeChange());
    const latest = makeRecord(makeChange({ after: false, before: true }));
    const { api } = fakeApi(
      defaultRoutes(record, {
        'GET /self/k/v1/record.json': { record: latest },
      }),
    );
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/再読み込み/);
  });

  test('対象アプリの管理権限が無ければエラー(フィールドは変更しない)', async () => {
    const record = makeRecord(makeChange());
    const { api, calls } = fakeApi(
      defaultRoutes(record, {
        'GET /k/v1/app/acl.json': () => {
          const err = { code: 'CB_NO02', message: '権限がありません。' };
          throw err;
        },
      }),
    );
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/管理権限がありません/);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  test('権限以外の理由で確認できなければその旨のエラー', async () => {
    const record = makeRecord(makeChange());
    const { api } = fakeApi(
      defaultRoutes(record, {
        'GET /k/v1/app/acl.json': () => {
          const err = {
            code: 'GAIA_AP01',
            message: 'アプリが見つかりません。',
          };
          throw err;
        },
      }),
    );
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/アプリが見つかりません/);
  });

  test('未反映の変更がある(revisionが違う)ならエラー', async () => {
    const record = makeRecord(makeChange());
    const { api, calls } = fakeApi(
      defaultRoutes(record, {
        'GET /k/v1/preview/app/form/fields.json': {
          properties: targetProperties,
          revision: '5',
        },
      }),
    );
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/未反映/);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  test('フィールドの変更APIが失敗したらエラー(デプロイしない)', async () => {
    const record = makeRecord(makeChange());
    const { api, calls } = fakeApi(
      defaultRoutes(record, {
        'PUT /k/v1/preview/app/form/fields.json': () => {
          const err = {
            code: 'CB_VA01',
            message: '入力内容が正しくありません。',
          };
          throw err;
        },
      }),
    );
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/入力内容/);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  test('デプロイが失敗したら変更を取り消して(revert)エラー', async () => {
    const record = makeRecord(makeChange());
    const routes = defaultRoutes(record);
    routes.setDeployStatus('FAIL');
    const { api, calls } = fakeApi(routes);
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/FAIL/);
    const revert = calls.find((c) => c.body && c.body.revert === true);
    expect(revert.body).toEqual({ apps: [{ app: TARGET_APP }], revert: true });
  });

  test('削除はDELETEで送る', async () => {
    const record = makeRecord(
      makeChange({ operation: 'delete', before: null, after: null }),
    );
    const { api, calls } = fakeApi(defaultRoutes(record));
    const result = await run(api, record);
    expect(result.ok).toBe(true);
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del.body).toEqual({
      app: TARGET_APP,
      revision: '3',
      fields: ['title'],
    });
  });

  test('注記(依頼後に設定が変わっていた等)を結果に含める', async () => {
    const record = makeRecord(makeChange({ before: true, after: false }));
    const { api } = fakeApi(defaultRoutes(record));
    const result = await run(api, record);
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/依頼後/);
  });
});

describe('runApply(一覧の変更)', () => {
  const viewChange = () =>
    ChangeRequest.buildChange({
      app: { id: TARGET_APP, name: '案件管理', guestSpaceId: '' },
      view: { id: '101', name: '案件一覧' },
      operation: 'viewUpdate',
      before: { name: '案件一覧', filterCond: '', sort: '' },
      after: {
        name: '案件一覧',
        filterCond: 'amount > "100"',
        sort: 'amount desc',
        sourceUrl: '/k/791/?view=101',
      },
    });
  const previewViews = {
    案件一覧: {
      type: 'LIST',
      name: '案件一覧',
      id: '101',
      index: '0',
      filterCond: '',
      sort: '',
      fields: ['title'],
    },
  };

  test('一覧の設定を変更するAPIに、取得時のrevisionと全一覧を送り、デプロイする', async () => {
    const record = makeRecord(viewChange());
    const { api, calls } = fakeApi(
      defaultRoutes(record, {
        'GET /k/v1/preview/app/views.json': {
          views: previewViews,
          revision: '3',
        },
        'PUT /k/v1/preview/app/views.json': { revision: '4' },
      }),
    );
    const result = await run(api, record);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('一覧の修正');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put.path).toBe('/k/v1/preview/app/views.json');
    expect(put.body.revision).toBe('3');
    expect(put.body.views['案件一覧'].sort).toBe('amount desc');
    expect(
      calls.some(
        (c) => c.path.endsWith('form/fields.json') && c.method === 'PUT',
      ),
    ).toBe(false);
    const deploy = calls.find(
      (c) => c.method === 'POST' && c.path.endsWith('deploy.json'),
    );
    expect(deploy.body.apps[0].revision).toBe('4');
  });

  test('対象の一覧が無くなっていたらエラー(何も送らない)', async () => {
    const record = makeRecord(viewChange());
    const { api, calls } = fakeApi(
      defaultRoutes(record, {
        'GET /k/v1/preview/app/views.json': { views: {}, revision: '3' },
      }),
    );
    const result = await run(api, record);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/見つかりません/);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  test('一覧でも管理権限が無ければエラー', async () => {
    const record = makeRecord(viewChange());
    const { api } = fakeApi(
      defaultRoutes(record, {
        'GET /k/v1/app/acl.json': () => {
          const err = { code: 'CB_NO02', message: '権限がありません。' };
          throw err;
        },
      }),
    );
    const result = await run(api, record);
    expect(result.error).toMatch(/管理権限がありません/);
  });
});
