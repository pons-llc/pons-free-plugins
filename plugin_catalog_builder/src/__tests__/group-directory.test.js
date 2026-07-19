const GroupDirectory = require('../js/lib/group-directory.js');

describe('fetchAllGroups', () => {
  test('1ページ(100件未満)で終わる場合は1回だけ呼ぶ', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValue([{ code: 'a' }, { code: 'b' }]);
    const groups = await GroupDirectory.fetchAllGroups(fetchPage, 100);
    expect(groups).toEqual([{ code: 'a' }, { code: 'b' }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ size: 100, offset: 0 });
  });

  test('ちょうどpageSize件返ってきたら次ページを取得し、offsetを積み上げる', async () => {
    const page1 = Array.from({ length: 2 }, (_, i) => ({ code: `g${i}` }));
    const page2 = [{ code: 'last' }];
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);
    const groups = await GroupDirectory.fetchAllGroups(fetchPage, 2);
    expect(groups).toEqual([...page1, ...page2]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { size: 2, offset: 0 });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { size: 2, offset: 2 });
  });

  test('0件なら空配列', async () => {
    const fetchPage = jest.fn().mockResolvedValue([]);
    expect(await GroupDirectory.fetchAllGroups(fetchPage)).toEqual([]);
  });
});
