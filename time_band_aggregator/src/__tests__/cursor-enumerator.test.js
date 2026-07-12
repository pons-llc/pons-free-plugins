'use strict';

const CursorEnumerator = require('../js/lib/cursor-enumerator');

describe('CursorEnumerator.enumerateAll', () => {
  test('nextがfalseになるまでページを取得し全件を結合する', async () => {
    const pages = [
      { records: [{ id: '1' }, { id: '2' }], next: true },
      { records: [{ id: '3' }], next: false },
    ];
    let callCount = 0;
    const deps = {
      createCursor: jest.fn().mockResolvedValue({ id: 'cur1', totalCount: 3 }),
      getCursor: jest.fn().mockImplementation(() => {
        const page = pages[callCount];
        callCount += 1;
        return Promise.resolve(page);
      }),
      deleteCursor: jest.fn().mockResolvedValue(undefined),
    };

    const result = await CursorEnumerator.enumerateAll(deps);
    expect(result.records).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    expect(result.totalCount).toBe(3);
    expect(deps.deleteCursor).not.toHaveBeenCalled();
  });

  test('next:trueでも空ページなら継続する', async () => {
    const pages = [
      { records: [], next: true },
      { records: [{ id: '1' }], next: false },
    ];
    let callCount = 0;
    const deps = {
      createCursor: jest.fn().mockResolvedValue({ id: 'cur1', totalCount: 1 }),
      getCursor: jest.fn().mockImplementation(() => {
        const page = pages[callCount];
        callCount += 1;
        return Promise.resolve(page);
      }),
    };
    const result = await CursorEnumerator.enumerateAll(deps);
    expect(result.records).toEqual([{ id: '1' }]);
  });

  test('途中で例外が起きたらdeleteCursorを試みてから再スローする', async () => {
    const deps = {
      createCursor: jest.fn().mockResolvedValue({ id: 'cur1', totalCount: 1 }),
      getCursor: jest.fn().mockRejectedValue(new Error('boom')),
      deleteCursor: jest.fn().mockResolvedValue(undefined),
    };
    await expect(CursorEnumerator.enumerateAll(deps)).rejects.toThrow('boom');
    expect(deps.deleteCursor).toHaveBeenCalledWith('cur1');
  });

  test('deleteCursor自体が失敗しても元の例外を優先する', async () => {
    const deps = {
      createCursor: jest.fn().mockResolvedValue({ id: 'cur1', totalCount: 1 }),
      getCursor: jest.fn().mockRejectedValue(new Error('original')),
      deleteCursor: jest.fn().mockRejectedValue(new Error('delete failed')),
    };
    await expect(CursorEnumerator.enumerateAll(deps)).rejects.toThrow(
      'original',
    );
  });
});
