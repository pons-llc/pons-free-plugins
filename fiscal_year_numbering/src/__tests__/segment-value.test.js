const SegmentValue = require('../js/lib/segment-value');

describe('SegmentValue.resolve', () => {
  test('an option with an override string returns the override', () => {
    const segments = [
      { fieldCode: 'buka', order: 1, optionOverrides: { soumu: '総務課' } },
    ];
    const record = { buka: { value: 'soumu' } };
    expect(SegmentValue.resolve(segments, record)).toEqual([
      { code: 'buka', order: 1, value: '総務課' },
    ]);
  });

  test('an option with no override (or blank override) falls back to the literal field value', () => {
    const segments = [
      { fieldCode: 'shubetsu', order: 2, optionOverrides: { seikyu: '' } },
    ];
    const record = { shubetsu: { value: 'seikyu' } };
    expect(SegmentValue.resolve(segments, record)).toEqual([
      { code: 'shubetsu', order: 2, value: 'seikyu' },
    ]);
  });

  test('multiple segments are resolved and kept in their configured order', () => {
    const segments = [
      { fieldCode: 'shubetsu', order: 2, optionOverrides: {} },
      { fieldCode: 'buka', order: 1, optionOverrides: { soumu: '総務課' } },
    ];
    const record = { buka: { value: 'soumu' }, shubetsu: { value: 'seikyu' } };
    expect(SegmentValue.resolve(segments, record)).toEqual([
      { code: 'buka', order: 1, value: '総務課' },
      { code: 'shubetsu', order: 2, value: 'seikyu' },
    ]);
  });

  test('a missing/empty segment field value resolves to an empty string rather than throwing', () => {
    const segments = [{ fieldCode: 'buka', order: 1, optionOverrides: {} }];
    const record = { buka: { value: '' } };
    expect(SegmentValue.resolve(segments, record)).toEqual([
      { code: 'buka', order: 1, value: '' },
    ]);
  });
});
