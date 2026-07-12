'use strict';

const BatchWriter = require('../js/lib/batch-writer');

describe('BatchWriter.chunk', () => {
  test('WRITE_BATCH_SIZE件ずつに分割する', () => {
    const records = Array.from({ length: 250 }, (_, i) => ({ id: String(i) }));
    const chunks = BatchWriter.chunk(records);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });
});

describe('BatchWriter.isRevisionConflictError', () => {
  test('GAIA_CO02は競合とみなす', () => {
    expect(BatchWriter.isRevisionConflictError({ code: 'GAIA_CO02' })).toBe(
      true,
    );
  });
  test('メッセージにrevisionを含めば競合とみなす', () => {
    expect(
      BatchWriter.isRevisionConflictError({ message: 'The revision is old.' }),
    ).toBe(true);
  });
  test('関係ないエラーは競合ではない', () => {
    expect(BatchWriter.isRevisionConflictError({ code: 'GAIA_IL19' })).toBe(
      false,
    );
  });
  test('nullは競合ではない', () => {
    expect(BatchWriter.isRevisionConflictError(null)).toBe(false);
  });
});

describe('BatchWriter.writeChunkWithFallback', () => {
  test('バッチ送信が成功すれば全件updated', async () => {
    const records = [{ id: '1' }, { id: '2' }];
    const putBatch = jest.fn().mockResolvedValue(undefined);
    const result = await BatchWriter.writeChunkWithFallback(records, {
      putBatch,
      putSingle: jest.fn(),
    });
    expect(result).toEqual({ updated: ['1', '2'], skipped: [] });
  });

  test('バッチ送信が競合エラーで失敗したら個別送信にフォールバックする', async () => {
    const records = [
      { id: '1', recordNumber: '1' },
      { id: '2', recordNumber: '2' },
    ];
    const putBatch = jest.fn().mockRejectedValue({ code: 'GAIA_CO02' });
    const putSingle = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.reject({ code: 'GAIA_CO02' }));

    const result = await BatchWriter.writeChunkWithFallback(records, {
      putBatch,
      putSingle,
    });
    expect(result.updated).toEqual(['1']);
    expect(result.skipped).toEqual([
      { id: '2', recordNumber: '2', reason: 'revision conflict' },
    ]);
  });

  test('競合以外のエラーはそのまま再スローする', async () => {
    const records = [{ id: '1' }];
    const putBatch = jest.fn().mockRejectedValue(new Error('server error'));
    await expect(
      BatchWriter.writeChunkWithFallback(records, {
        putBatch,
        putSingle: jest.fn(),
      }),
    ).rejects.toThrow('server error');
  });
});

describe('BatchWriter.runAll', () => {
  test('複数チャンクの結果を集計する', async () => {
    const records = Array.from({ length: 150 }, (_, i) => ({ id: String(i) }));
    const putBatch = jest.fn().mockResolvedValue(undefined);
    const result = await BatchWriter.runAll(records, {
      putBatch,
      putSingle: jest.fn(),
    });
    expect(result.updatedCount).toBe(150);
    expect(result.skipped).toEqual([]);
    expect(putBatch).toHaveBeenCalledTimes(2);
  });
});

describe('BatchWriter.buildResultSummary', () => {
  test('スキップが無ければレコード番号一覧を含めない', () => {
    const summary = BatchWriter.buildResultSummary({
      totalTarget: 10,
      updatedCount: 10,
      skipped: [],
    });
    expect(summary).toContain('対象レコード数: 10件');
    expect(summary).not.toContain('スキップしたレコード番号');
  });

  test('スキップがあればレコード番号一覧を含める', () => {
    const summary = BatchWriter.buildResultSummary({
      totalTarget: 10,
      updatedCount: 8,
      skipped: [{ recordNumber: '3' }, { recordNumber: '7' }],
    });
    expect(summary).toContain('スキップしたレコード番号: 3, 7');
  });
});
