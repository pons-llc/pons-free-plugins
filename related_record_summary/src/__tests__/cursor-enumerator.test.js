const CursorEnumerator = require('../js/lib/cursor-enumerator');

describe('CursorEnumerator.enumerateAll', () => {
  test('collects records across multiple pages until next is false', async () => {
    const createCursor = jest
      .fn()
      .mockResolvedValue({ id: 'cursor-1', totalCount: '3' });
    const getCursor = jest
      .fn()
      .mockResolvedValueOnce({ records: [{ id: 1 }, { id: 2 }], next: true })
      .mockResolvedValueOnce({ records: [{ id: 3 }], next: false });

    const result = await CursorEnumerator.enumerateAll({
      createCursor,
      getCursor,
    });

    expect(result.records).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(result.totalCount).toBe('3');
    expect(getCursor).toHaveBeenCalledTimes(2);
  });

  test('keeps polling when next is true even if a page returns an empty records array', async () => {
    const createCursor = jest
      .fn()
      .mockResolvedValue({ id: 'cursor-1', totalCount: '1' });
    const getCursor = jest
      .fn()
      .mockResolvedValueOnce({ records: [], next: true })
      .mockResolvedValueOnce({ records: [{ id: 1 }], next: false });

    const result = await CursorEnumerator.enumerateAll({
      createCursor,
      getCursor,
    });

    expect(result.records).toEqual([{ id: 1 }]);
    expect(getCursor).toHaveBeenCalledTimes(2);
  });

  test('stops immediately when the first page already has next: false', async () => {
    const createCursor = jest
      .fn()
      .mockResolvedValue({ id: 'cursor-1', totalCount: '0' });
    const getCursor = jest.fn().mockResolvedValue({ records: [], next: false });

    const result = await CursorEnumerator.enumerateAll({
      createCursor,
      getCursor,
    });

    expect(result.records).toEqual([]);
    expect(getCursor).toHaveBeenCalledTimes(1);
  });

  test('deletes the cursor and rethrows when getCursor fails mid-enumeration', async () => {
    const createCursor = jest
      .fn()
      .mockResolvedValue({ id: 'cursor-1', totalCount: '10' });
    const failure = new Error('timeout');
    const getCursor = jest.fn().mockRejectedValue(failure);
    const deleteCursor = jest.fn().mockResolvedValue({});

    await expect(
      CursorEnumerator.enumerateAll({ createCursor, getCursor, deleteCursor }),
    ).rejects.toBe(failure);
    expect(deleteCursor).toHaveBeenCalledWith('cursor-1');
  });

  test('still rethrows the original error even if deleteCursor itself fails', async () => {
    const createCursor = jest
      .fn()
      .mockResolvedValue({ id: 'cursor-1', totalCount: '10' });
    const failure = new Error('timeout');
    const getCursor = jest.fn().mockRejectedValue(failure);
    const deleteCursor = jest
      .fn()
      .mockRejectedValue(new Error('delete also failed'));

    await expect(
      CursorEnumerator.enumerateAll({ createCursor, getCursor, deleteCursor }),
    ).rejects.toBe(failure);
  });

  test('does not attempt to delete the cursor when deleteCursor is not provided', async () => {
    const createCursor = jest
      .fn()
      .mockResolvedValue({ id: 'cursor-1', totalCount: '10' });
    const failure = new Error('timeout');
    const getCursor = jest.fn().mockRejectedValue(failure);

    await expect(
      CursorEnumerator.enumerateAll({ createCursor, getCursor }),
    ).rejects.toBe(failure);
  });
});
