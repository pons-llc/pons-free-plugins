const RecordsFetcher = require('../js/lib/records-fetcher.js');

describe('fetchAllRecords', () => {
  test('複数ページにまたがる場合、直前ページの最大$idを次ページの条件に使う', async () => {
    const page1 = [{ $id: { value: '1' } }, { $id: { value: '2' } }];
    const page2 = [{ $id: { value: '3' } }];
    const page3 = [];
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
      .mockResolvedValueOnce(page3);

    const records = await RecordsFetcher.fetchAllRecords(fetchPage);

    expect(records).toEqual([...page1, ...page2]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 3);
  });

  test('1ページ目が空なら即終了', async () => {
    const fetchPage = jest.fn().mockResolvedValue([]);
    const records = await RecordsFetcher.fetchAllRecords(fetchPage);
    expect(records).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
