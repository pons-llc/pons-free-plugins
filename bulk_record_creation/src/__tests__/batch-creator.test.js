'use strict';

const {
  createAll,
  buildResultSummary,
  CHUNK_SIZE,
} = require('../js/lib/batch-creator');

const makeRecords = (count) =>
  Array.from({ length: count }, (_, i) => ({
    title: { value: `record-${i}` },
  }));

describe('createAll', () => {
  test('100件以下は1バッチで送信する', async () => {
    const records = makeRecords(30);
    const postBatch = jest.fn().mockResolvedValue({ ids: [], revisions: [] });
    const result = await createAll(records, { postBatch });

    expect(postBatch).toHaveBeenCalledTimes(1);
    expect(postBatch).toHaveBeenCalledWith(records);
    expect(result).toEqual({
      totalCount: 30,
      createdCount: 30,
      batches: [{ startIndex: 0, endIndex: 29, count: 30, status: 'SUCCESS' }],
    });
  });

  test('CHUNK_SIZEは100で、それを超える件数は複数バッチに分割する', async () => {
    const records = makeRecords(250);
    const calledWith = [];
    const postBatch = jest.fn().mockImplementation(async (chunk) => {
      calledWith.push(chunk.length);
      return { ids: [], revisions: [] };
    });
    const result = await createAll(records, { postBatch });

    expect(CHUNK_SIZE).toBe(100);
    expect(calledWith).toEqual([100, 100, 50]);
    expect(
      result.batches.map((b) => [b.startIndex, b.endIndex, b.count, b.status]),
    ).toEqual([
      [0, 99, 100, 'SUCCESS'],
      [100, 199, 100, 'SUCCESS'],
      [200, 249, 50, 'SUCCESS'],
    ]);
    expect(result.createdCount).toBe(250);
  });

  test('バッチを並列ではなく逐次で送信する', async () => {
    const records = makeRecords(300);
    const order = [];
    const postBatch = jest.fn().mockImplementation(async (chunk) => {
      order.push(`start:${chunk.length}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`end:${chunk.length}`);
      return { ids: [], revisions: [] };
    });
    await createAll(records, { postBatch });

    // 並列実行(Promise.all)だと全バッチのstartが先に並ぶが、逐次実行なら
    // 1バッチ分のstart/endが交互に現れる。
    expect(order).toEqual([
      'start:100',
      'end:100',
      'start:100',
      'end:100',
      'start:100',
      'end:100',
    ]);
  });

  test('あるバッチが失敗しても後続バッチの送信は継続し、失敗はFAILUREとして記録する', async () => {
    const records = makeRecords(250);
    const postBatch = jest
      .fn()
      .mockResolvedValueOnce({ ids: [], revisions: [] })
      .mockRejectedValueOnce(new Error('サーバーエラー'))
      .mockResolvedValueOnce({ ids: [], revisions: [] });

    const result = await createAll(records, { postBatch });

    expect(result.batches.map((b) => b.status)).toEqual([
      'SUCCESS',
      'FAILURE',
      'SUCCESS',
    ]);
    expect(result.batches[1].error).toBe('サーバーエラー');
    // 失敗したバッチ(100件)分はcreatedCountに含めない。
    expect(result.createdCount).toBe(150);
    expect(result.totalCount).toBe(250);
  });

  test('records が空配列ならバッチを送信せずcreatedCount 0を返す', async () => {
    const postBatch = jest.fn();
    const result = await createAll([], { postBatch });
    expect(postBatch).not.toHaveBeenCalled();
    expect(result).toEqual({ totalCount: 0, createdCount: 0, batches: [] });
  });
});

describe('buildResultSummary', () => {
  test('全件成功の場合', () => {
    const summary = buildResultSummary({
      totalCount: 30,
      createdCount: 30,
      batches: [{ startIndex: 0, endIndex: 29, count: 30, status: 'SUCCESS' }],
    });
    expect(summary).toContain('30件中30件を作成しました。');
    expect(summary).not.toContain('失敗');
  });

  test('一部失敗の場合は何件目〜何件目かを含める', () => {
    const summary = buildResultSummary({
      totalCount: 250,
      createdCount: 150,
      batches: [
        { startIndex: 0, endIndex: 99, count: 100, status: 'SUCCESS' },
        {
          startIndex: 100,
          endIndex: 199,
          count: 100,
          status: 'FAILURE',
          error: 'サーバーエラー',
        },
        { startIndex: 200, endIndex: 249, count: 50, status: 'SUCCESS' },
      ],
    });
    expect(summary).toContain('250件中150件を作成しました。');
    expect(summary).toContain('101件目〜200件目');
    expect(summary).toContain('サーバーエラー');
  });
});
