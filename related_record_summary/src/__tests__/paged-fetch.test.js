const PagedFetch = require('../js/lib/paged-fetch');

describe('PagedFetch.buildPagedQuery', () => {
  test('appends order by/limit only on the first page (no lastId yet)', () => {
    expect(
      PagedFetch.buildPagedQuery('顧客コード = "C001"', undefined, 500),
    ).toBe('顧客コード = "C001" order by $id asc limit 500');
  });

  test('AND-combines the $id > lastId condition on subsequent pages', () => {
    expect(PagedFetch.buildPagedQuery('顧客コード = "C001"', 42, 500)).toBe(
      '(顧客コード = "C001") and ($id > 42) order by $id asc limit 500',
    );
  });

  test('omits the leading condition entirely when baseQuery is empty and there is no lastId', () => {
    expect(PagedFetch.buildPagedQuery('', undefined, 500)).toBe(
      'order by $id asc limit 500',
    );
  });

  test('uses only the $id condition when baseQuery is empty but lastId is set', () => {
    expect(PagedFetch.buildPagedQuery('', 10, 500)).toBe(
      '$id > 10 order by $id asc limit 500',
    );
  });
});

describe('PagedFetch.fetchAllPages', () => {
  test('stops after a single page when fewer records than pageSize are returned', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      records: [{ $id: { value: '1' } }, { $id: { value: '2' } }],
    });
    const result = await PagedFetch.fetchAllPages('', fetchPage, 500);
    expect(result).toHaveLength(2);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  test('keeps requesting subsequent pages using the last $id until a short page is returned', async () => {
    const page1 = {
      records: Array.from({ length: 2 }, (_, i) => ({
        $id: { value: String(i + 1) },
      })),
    };
    const page2 = { records: [{ $id: { value: '3' } }] };
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const result = await PagedFetch.fetchAllPages('', fetchPage, 2);

    expect(result.map((r) => r.$id.value)).toEqual(['1', '2', '3']);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 'order by $id asc limit 2');
    expect(fetchPage).toHaveBeenNthCalledWith(
      2,
      '$id > 2 order by $id asc limit 2',
    );
  });

  test('returns an empty array when the first page is empty', async () => {
    const fetchPage = jest.fn().mockResolvedValue({ records: [] });
    const result = await PagedFetch.fetchAllPages('x = 1', fetchPage, 500);
    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
