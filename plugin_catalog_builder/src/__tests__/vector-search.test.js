const VectorSearch = require('../js/lib/vector-search.js');

describe('cosineSimilarity', () => {
  test('同一ベクトルなら内積(ノルム1同士なら1.0)', () => {
    expect(VectorSearch.cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });

  test('直交ベクトルなら0', () => {
    expect(VectorSearch.cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
});

describe('topKByQuery', () => {
  test('スコア降順に並べ、上位k件のcorpusだけを返す', () => {
    const entries = [
      { corpus: { name: 'A' }, vector: [1, 0] },
      { corpus: { name: 'B' }, vector: [0.9, 0.1] },
      { corpus: { name: 'C' }, vector: [0, 1] },
    ];
    const results = VectorSearch.topKByQuery([1, 0], entries, 2);
    expect(results).toEqual([{ name: 'A' }, { name: 'B' }]);
  });

  test('kがentries数より大きくても全件返す', () => {
    const entries = [{ corpus: { name: 'A' }, vector: [1, 0] }];
    expect(VectorSearch.topKByQuery([1, 0], entries, 10)).toEqual([
      { name: 'A' },
    ]);
  });
});
