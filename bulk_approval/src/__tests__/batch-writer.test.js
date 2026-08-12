const BatchWriter = require('../js/lib/batch-writer');

describe('chunk', () => {
  test('指定サイズごとに分割する', () => {
    const records = [1, 2, 3, 4, 5];
    expect(BatchWriter.chunk(records, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('既定サイズは100件', () => {
    const records = Array.from({ length: 150 }, (_, i) => i);
    const chunks = BatchWriter.chunk(records);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(100);
    expect(chunks[1].length).toBe(50);
  });
});

describe('writeChunkWithFallback', () => {
  test('バッチ送信が成功すれば全件updatedになる', async () => {
    const records = [{ id: 1, revision: '1', action: '承認' }];
    const putBatch = jest.fn().mockResolvedValue({});
    const putSingle = jest.fn();
    const result = await BatchWriter.writeChunkWithFallback(records, {
      putBatch,
      putSingle,
    });
    expect(result).toEqual({ updated: [1], skipped: [] });
    expect(putSingle).not.toHaveBeenCalled();
  });

  test('バッチが失敗すると1件ずつ再送し、失敗したものだけスキップする', async () => {
    const records = [
      { id: 1, revision: '1', action: '承認' },
      { id: 2, revision: '1', action: '承認' },
    ];
    const putBatch = jest.fn().mockRejectedValue(new Error('batch failed'));
    const putSingle = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new Error('他ユーザーが作業者のため実行できません'),
      );
    const result = await BatchWriter.writeChunkWithFallback(records, {
      putBatch,
      putSingle,
    });
    expect(result.updated).toEqual([1]);
    expect(result.skipped).toEqual([
      { id: 2, reason: '他ユーザーが作業者のため実行できません' },
    ]);
  });
});

describe('runAll', () => {
  test('複数チャンクを合算して集計する', async () => {
    const records = Array.from({ length: 120 }, (_, i) => ({
      id: i,
      revision: '1',
      action: '承認',
    }));
    const putBatch = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('fail'));
    const putSingle = jest.fn().mockResolvedValue({});
    const result = await BatchWriter.runAll(records, { putBatch, putSingle });
    expect(result.updatedCount).toBe(120);
    expect(result.skipped).toEqual([]);
  });
});

describe('buildResultSummary', () => {
  test('スキップ件数・理由を含めた本文を組み立てる', () => {
    const summary = BatchWriter.buildResultSummary({
      totalTarget: 3,
      updatedCount: 2,
      skipped: [{ id: 5, reason: 'conflict' }],
    });
    expect(summary).toContain('実行対象レコード数: 3件');
    expect(summary).toContain('実行に成功したレコード数: 2件');
    expect(summary).toContain('実行に失敗しスキップしたレコード数: 1件');
    expect(summary).toContain('5(conflict)');
  });

  test('スキップが0件なら該当行を出さない', () => {
    const summary = BatchWriter.buildResultSummary({
      totalTarget: 2,
      updatedCount: 2,
      skipped: [],
    });
    expect(summary).not.toContain('スキップしたレコード:');
  });
});
