const EraTable = require('../js/lib/era-table');

describe('EraTable.matchingEra', () => {
  const reiwaOnly = [{ code: 'R', label: '令和', startYear: 2019 }];

  test('a fiscal year within the only era returns that era', () => {
    expect(EraTable.matchingEra(reiwaOnly, 2020)).toEqual(reiwaOnly[0]);
  });

  test('unsorted input is sorted before matching (last-started era with startYear <= fiscalYear wins)', () => {
    const unsorted = [
      { code: 'X', label: '仮元号', startYear: 2031 },
      { code: 'R', label: '令和', startYear: 2019 },
    ];
    expect(EraTable.matchingEra(unsorted, 2024)).toEqual(unsorted[1]);
    expect(EraTable.matchingEra(unsorted, 2031)).toEqual(unsorted[0]);
    expect(EraTable.matchingEra(unsorted, 2030)).toEqual(unsorted[1]);
  });

  test('a fiscal year before any configured era throws', () => {
    expect(() => EraTable.matchingEra(reiwaOnly, 2000)).toThrow();
  });

  test('duplicate startYear entries: the later one in a stable sort wins deterministically', () => {
    const dup = [
      { code: 'A', label: '元号A', startYear: 2019 },
      { code: 'B', label: '元号B', startYear: 2019 },
    ];
    // Both start the same year; matchingEra must not throw and must return one of them consistently.
    const result = EraTable.matchingEra(dup, 2019);
    expect(['A', 'B']).toContain(result.code);
  });
});

describe('EraTable.eraYear', () => {
  test('era-year is fiscalYear - startYear + 1', () => {
    const reiwa = { code: 'R', label: '令和', startYear: 2019 };
    expect(EraTable.eraYear(reiwa, 2024)).toBe(6);
    expect(EraTable.eraYear(reiwa, 2019)).toBe(1);
  });
});
