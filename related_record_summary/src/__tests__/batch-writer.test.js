const BatchWriter = require('../js/lib/batch-writer');

describe('BatchWriter.chunk', () => {
  test('splits records into chunks of at most 100', () => {
    const records = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
    const chunks = BatchWriter.chunk(records);
    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(100);
    expect(chunks[1].length).toBe(100);
    expect(chunks[2].length).toBe(50);
  });

  test('returns an empty array for an empty input', () => {
    expect(BatchWriter.chunk([])).toEqual([]);
  });

  test('supports a custom chunk size', () => {
    const records = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
    expect(BatchWriter.chunk(records, 2).map((c) => c.length)).toEqual([
      2, 2, 1,
    ]);
  });
});

describe('BatchWriter.isRevisionConflictError', () => {
  test('treats the GAIA_CO02 code as a conflict', () => {
    expect(
      BatchWriter.isRevisionConflictError({ code: 'GAIA_CO02', message: 'x' }),
    ).toBe(true);
  });

  test('treats a message containing "リビジョン" as a conflict', () => {
    expect(
      BatchWriter.isRevisionConflictError({
        message: '指定されたリビジョンは最新ではありません。',
      }),
    ).toBe(true);
  });

  test('treats a message containing "revision" (case-insensitive) as a conflict', () => {
    expect(
      BatchWriter.isRevisionConflictError({ message: 'Revision mismatch' }),
    ).toBe(true);
  });

  test('does not treat an unrelated error as a conflict', () => {
    expect(
      BatchWriter.isRevisionConflictError({
        code: 'CB_VA01',
        message: '必須項目です。',
      }),
    ).toBe(false);
  });

  test('handles a null/undefined error gracefully', () => {
    expect(BatchWriter.isRevisionConflictError(null)).toBe(false);
    expect(BatchWriter.isRevisionConflictError(undefined)).toBe(false);
  });
});

describe('BatchWriter.writeChunkWithFallback', () => {
  test('reports all records as updated when the batch call succeeds', async () => {
    const records = [{ id: 1 }, { id: 2 }];
    const putBatch = jest.fn().mockResolvedValue({});
    const putSingle = jest.fn();
    const result = await BatchWriter.writeChunkWithFallback(records, {
      putBatch,
      putSingle,
    });
    expect(result).toEqual({ updated: [1, 2], skipped: [] });
    expect(putSingle).not.toHaveBeenCalled();
  });

  test('falls back to per-record puts when the batch call conflicts, skipping only the conflicting ones', async () => {
    const records = [
      { id: 1, recordNumber: '101' },
      { id: 2, recordNumber: '102' },
      { id: 3, recordNumber: '103' },
    ];
    const conflictError = { code: 'GAIA_CO02', message: 'conflict' };
    const putBatch = jest.fn().mockRejectedValue(conflictError);
    const putSingle = jest.fn((record) => {
      if (record.id === 2) {
        return Promise.reject(conflictError);
      }
      return Promise.resolve({});
    });

    const result = await BatchWriter.writeChunkWithFallback(records, {
      putBatch,
      putSingle,
    });

    expect(result.updated).toEqual([1, 3]);
    expect(result.skipped).toEqual([
      { id: 2, recordNumber: '102', reason: 'conflict' },
    ]);
    expect(putSingle).toHaveBeenCalledTimes(3);
  });

  test('rethrows a non-conflict error from the batch call without falling back', async () => {
    const records = [{ id: 1 }];
    const fatalError = new Error('permission denied');
    const putBatch = jest.fn().mockRejectedValue(fatalError);
    const putSingle = jest.fn();

    await expect(
      BatchWriter.writeChunkWithFallback(records, { putBatch, putSingle }),
    ).rejects.toBe(fatalError);
    expect(putSingle).not.toHaveBeenCalled();
  });

  test('rethrows a non-conflict error encountered during the per-record fallback', async () => {
    const records = [{ id: 1 }, { id: 2 }];
    const putBatch = jest
      .fn()
      .mockRejectedValue({ code: 'GAIA_CO02', message: 'conflict' });
    const fatalError = new Error('field permission denied');
    const putSingle = jest.fn().mockRejectedValueOnce(fatalError);

    await expect(
      BatchWriter.writeChunkWithFallback(records, { putBatch, putSingle }),
    ).rejects.toBe(fatalError);
  });

  test('accepts a custom isConflictError predicate', async () => {
    const records = [{ id: 1 }];
    const customError = { code: 'CUSTOM_CONFLICT' };
    const putBatch = jest.fn().mockRejectedValue(customError);
    const putSingle = jest.fn().mockRejectedValue(customError);
    const isConflictError = (err) => err.code === 'CUSTOM_CONFLICT';

    const result = await BatchWriter.writeChunkWithFallback(records, {
      putBatch,
      putSingle,
      isConflictError,
    });
    expect(result.skipped).toHaveLength(1);
  });
});

describe('BatchWriter.runAll', () => {
  test('accumulates updated counts and skipped records across multiple chunks', async () => {
    const records = Array.from({ length: 150 }, (_, i) => ({
      id: i + 1,
      recordNumber: String(i + 1),
    }));
    const conflictError = { code: 'GAIA_CO02', message: 'conflict' };
    const putBatch = jest.fn((chunk) => {
      // 2つ目のチャンク(101〜150)だけ競合させる
      if (chunk[0].id === 101) {
        return Promise.reject(conflictError);
      }
      return Promise.resolve({});
    });
    const putSingle = jest.fn((record) => {
      if (record.id === 120) {
        return Promise.reject(conflictError);
      }
      return Promise.resolve({});
    });

    const result = await BatchWriter.runAll(records, { putBatch, putSingle });

    expect(result.updatedCount).toBe(149);
    expect(result.skipped).toEqual([
      { id: 120, recordNumber: '120', reason: 'conflict' },
    ]);
  });
});

describe('BatchWriter.buildResultSummary', () => {
  test('summarizes success with no skips', () => {
    const summary = BatchWriter.buildResultSummary({
      totalTarget: 10,
      updatedCount: 10,
      skipped: [],
    });
    expect(summary).toContain('対象レコード数: 10件');
    expect(summary).toContain('集計・更新に成功したレコード数: 10件');
    expect(summary).toContain('revision競合によりスキップしたレコード数: 0件');
    expect(summary).not.toContain('スキップしたレコード番号');
  });

  test('lists the skipped record numbers when there are skips', () => {
    const summary = BatchWriter.buildResultSummary({
      totalTarget: 3,
      updatedCount: 2,
      skipped: [{ id: 5, recordNumber: '105', reason: 'conflict' }],
    });
    expect(summary).toContain('スキップしたレコード番号: 105');
  });
});
