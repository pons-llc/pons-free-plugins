'use strict';

const { traverseApps } = require('../js/lib/traverse-apps');

// テスト用の簡易extractRelatedAppIds: design.fieldsを{ related: [...] }という
// 単純な形にしておき、実際のフィールド走査ロジック(extract-related-app-ids.test.js側で
// 別途検証済み)とは独立してtraverseAppsのオーケストレーションだけを確認する。
const extractRelatedAppIds = (fields) => fields.related || [];

describe('traverseApps', () => {
  test('関連アプリが無い場合は起点アプリのみを処理する', async () => {
    const fetchAppDesign = jest
      .fn()
      .mockResolvedValue({ fields: { related: [] } });
    const result = await traverseApps({
      rootAppId: '1',
      fetchAppDesign,
      extractRelatedAppIds,
    });
    expect(fetchAppDesign).toHaveBeenCalledTimes(1);
    expect(fetchAppDesign).toHaveBeenCalledWith('1');
    expect(result.apps).toEqual([
      { appId: '1', design: { fields: { related: [] } }, error: null },
    ]);
    expect(result.edges).toEqual([]);
    expect(result.skippedCap).toEqual([]);
  });

  test('LOOKUP/REFERENCE_TABLEで参照される関連アプリを幅優先で辿る', async () => {
    const designs = {
      1: {
        fields: {
          related: [
            { fieldCode: 'lu_0', fieldType: 'LOOKUP', relatedAppId: '2' },
          ],
        },
      },
      2: {
        fields: {
          related: [
            {
              fieldCode: 'rt_0',
              fieldType: 'REFERENCE_TABLE',
              relatedAppId: '3',
            },
          ],
        },
      },
      3: { fields: { related: [] } },
    };
    const fetchAppDesign = jest.fn((appId) => Promise.resolve(designs[appId]));
    const result = await traverseApps({
      rootAppId: '1',
      fetchAppDesign,
      extractRelatedAppIds,
    });
    expect(result.apps.map((a) => a.appId)).toEqual(['1', '2', '3']);
    expect(result.edges).toEqual([
      { fromAppId: '1', fieldCode: 'lu_0', fieldType: 'LOOKUP', toAppId: '2' },
      {
        fromAppId: '2',
        fieldCode: 'rt_0',
        fieldType: 'REFERENCE_TABLE',
        toAppId: '3',
      },
    ]);
  });

  test('循環参照(自己参照を含む)があっても無限ループにならず、既訪問アプリは再取得しない', async () => {
    const designs = {
      1: {
        fields: {
          related: [
            { fieldCode: 'lu_self', fieldType: 'LOOKUP', relatedAppId: '1' },
            { fieldCode: 'lu_0', fieldType: 'LOOKUP', relatedAppId: '2' },
          ],
        },
      },
      2: {
        fields: {
          related: [
            { fieldCode: 'lu_back', fieldType: 'LOOKUP', relatedAppId: '1' },
          ],
        },
      },
    };
    const fetchAppDesign = jest.fn((appId) => Promise.resolve(designs[appId]));
    const result = await traverseApps({
      rootAppId: '1',
      fetchAppDesign,
      extractRelatedAppIds,
    });
    expect(fetchAppDesign).toHaveBeenCalledTimes(2);
    expect(result.apps.map((a) => a.appId)).toEqual(['1', '2']);
  });

  test('1アプリの取得が失敗しても、そのアプリにエラーを記録し他のアプリの処理は継続する', async () => {
    const designs = {
      1: {
        fields: {
          related: [
            { fieldCode: 'lu_0', fieldType: 'LOOKUP', relatedAppId: '2' },
          ],
        },
      },
    };
    const fetchAppDesign = jest.fn((appId) => {
      if (appId === '2') {
        return Promise.reject(new Error('403 Forbidden'));
      }
      return Promise.resolve(designs[appId]);
    });
    const result = await traverseApps({
      rootAppId: '1',
      fetchAppDesign,
      extractRelatedAppIds,
    });
    expect(result.apps).toEqual([
      { appId: '1', design: designs['1'], error: null },
      { appId: '2', design: null, error: '403 Forbidden' },
    ]);
  });

  test('onAppProcessedが指定されていれば、アプリを1件処理するたびに呼ばれる(進捗表示用)', async () => {
    const designs = {
      1: {
        fields: {
          related: [{ fieldCode: 'a', fieldType: 'LOOKUP', relatedAppId: '2' }],
        },
      },
      2: { fields: { related: [] } },
    };
    const fetchAppDesign = jest.fn((appId) => Promise.resolve(designs[appId]));
    const onAppProcessed = jest.fn();
    await traverseApps({
      rootAppId: '1',
      fetchAppDesign,
      extractRelatedAppIds,
      onAppProcessed,
    });
    expect(onAppProcessed.mock.calls).toEqual([
      ['1', 1],
      ['2', 2],
    ]);
  });

  test('探索するアプリの総数がmaxAppsに達したら、それ以上は辿らずskippedCapに記録する', async () => {
    const designs = {
      1: {
        fields: {
          related: [
            { fieldCode: 'a', fieldType: 'LOOKUP', relatedAppId: '2' },
            { fieldCode: 'b', fieldType: 'LOOKUP', relatedAppId: '3' },
          ],
        },
      },
      2: { fields: { related: [] } },
    };
    const fetchAppDesign = jest.fn((appId) =>
      Promise.resolve(designs[appId] || { fields: { related: [] } }),
    );
    const result = await traverseApps({
      rootAppId: '1',
      fetchAppDesign,
      extractRelatedAppIds,
      maxApps: 2,
    });
    expect(result.apps.map((a) => a.appId)).toEqual(['1', '2']);
    expect(result.skippedCap).toEqual(['3']);
    expect(fetchAppDesign).toHaveBeenCalledTimes(2);
  });
});
