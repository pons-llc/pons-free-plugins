const NumberTemplate = require('../js/lib/number-template');

describe('NumberTemplate.render', () => {
  const config = { numberFormat: { separator: '-', sequenceDigits: 4 } };
  const era = { code: 'R', label: '令和' };
  const segments = [
    { code: 'buka', order: 1, value: '総務課' },
    { code: 'shubetsu', order: 2, value: '請求書' },
  ];

  test('renders era + era-year + segments + zero-padded sequence, joined by the separator', () => {
    expect(NumberTemplate.render(config, era, 6, segments, 7)).toBe(
      'R6-総務課-請求書-0007'
    );
  });

  test('a custom separator is respected', () => {
    const customConfig = { numberFormat: { separator: '_', sequenceDigits: 4 } };
    expect(NumberTemplate.render(customConfig, era, 6, segments, 7)).toBe(
      'R6_総務課_請求書_0007'
    );
  });

  test('a sequence number wider than the configured digit width is not truncated', () => {
    expect(NumberTemplate.render(config, era, 6, segments, 10000)).toBe(
      'R6-総務課-請求書-10000'
    );
  });

  test('renders correctly with zero segments', () => {
    expect(NumberTemplate.render(config, era, 6, [], 3)).toBe('R6-0003');
  });
});
