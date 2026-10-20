'use strict';

const Model = require('../js/lib/model');
const MemoSaver = require('../js/lib/memo-saver');

const memo = {
  targetId: '',
  text: '電話で近況確認',
  author: { code: 'sato', name: '佐藤' },
  at: '2026-10-20T00:00:00.000Z',
};

const baseArgs = (api, currentValue) => ({
  api,
  appId: 10,
  recordId: 5,
  revision: '3',
  fieldCode: 'json',
  currentValue,
  memo,
  idGen: () => 'm9',
});

const conflictError = () => {
  const error = new Error('conflict');
  error.code = 'GAIA_CO02';
  return error;
};

describe('appendMemo', () => {
  test('通常は画面表示時の値とリビジョンでPUTを1回だけ呼ぶ', async () => {
    const calls = [];
    const api = async (path, method, body) => {
      calls.push({ path, method, body });
      return { revision: '4' };
    };
    const current = Model.serialize(
      Model.normalize({ persons: [{ id: 'a', name: '太郎' }] }),
    );
    await MemoSaver.appendMemo(baseArgs(api, current));

    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].body.revision).toBe('3');
    expect(Object.keys(calls[0].body.record)).toEqual(['json']);
    const saved = JSON.parse(calls[0].body.record.json.value);
    expect(saved.persons[0].name).toBe('太郎');
    expect(saved.memos).toEqual([{ id: 'm9', ...memo }]);
  });

  test('リビジョン競合(GAIA_CO02)のときだけ最新をGETしてメモを足し直し、そのリビジョンでPUTする', async () => {
    const calls = [];
    const latest = Model.serialize(
      Model.normalize({
        persons: [{ id: 'a', name: '他の人が更新' }],
        memos: [{ id: 'mx', text: '他の人のメモ' }],
      }),
    );
    const api = async (path, method, body) => {
      calls.push({ path, method, body });
      if (method === 'PUT' && calls.length === 1) {
        throw conflictError();
      }
      if (method === 'GET') {
        return {
          record: { json: { value: latest }, $revision: { value: '7' } },
        };
      }
      return { revision: '8' };
    };
    await MemoSaver.appendMemo(baseArgs(api, ''));

    expect(calls.map((c) => c.method)).toEqual(['PUT', 'GET', 'PUT']);
    expect(calls[1].body).toEqual({ app: 10, id: 5 });
    expect(calls[2].body.revision).toBe('7');
    const saved = JSON.parse(calls[2].body.record.json.value);
    expect(saved.persons[0].name).toBe('他の人が更新');
    expect(saved.memos.map((m) => m.id)).toEqual(['mx', 'm9']);
  });

  test('競合以外のエラーはそのまま投げる(再試行しない)', async () => {
    let count = 0;
    const api = async () => {
      count++;
      const error = new Error('権限がありません');
      error.code = 'CB_NO02';
      throw error;
    };
    await expect(MemoSaver.appendMemo(baseArgs(api, ''))).rejects.toThrow(
      '権限がありません',
    );
    expect(count).toBe(1);
  });

  test('再試行でも競合したら、再読み込みを促すエラー', async () => {
    const api = async (path, method) => {
      if (method === 'GET') {
        return { record: { json: { value: '' }, $revision: { value: '7' } } };
      }
      throw conflictError();
    };
    await expect(MemoSaver.appendMemo(baseArgs(api, ''))).rejects.toThrow(
      '再読み込み',
    );
  });

  test('保存済みの値がJSONとして読めないときは、上書きせずエラー', async () => {
    const api = jest.fn();
    await expect(
      MemoSaver.appendMemo(baseArgs(api, '{broken')),
    ).rejects.toThrow('読み込めません');
    expect(api).not.toHaveBeenCalled();
  });

  test('本文が空ならAPIを呼ばずにエラー', async () => {
    const api = jest.fn();
    const args = baseArgs(api, '');
    args.memo = { ...memo, text: '  ' };
    await expect(MemoSaver.appendMemo(args)).rejects.toThrow('入力');
    expect(api).not.toHaveBeenCalled();
  });
});
