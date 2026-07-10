'use strict';

const FlagValues = require('../js/lib/flag-values');

describe('FlagValues', () => {
  test('exposes the fixed PENDING/DONE text values', () => {
    expect(FlagValues.PENDING).toBe('未');
    expect(FlagValues.DONE).toBe('済');
  });
});
