const NumberingTrigger = require('../js/lib/numbering-trigger');

describe('NumberingTrigger.isSaveTrigger', () => {
  test('true when numberingTiming is "save"', () => {
    expect(NumberingTrigger.isSaveTrigger({ numberingTiming: 'save' })).toBe(true);
  });

  test('true when numberingTiming is missing (defaults to save for pre-existing configs)', () => {
    expect(NumberingTrigger.isSaveTrigger({})).toBe(true);
  });

  test('false for other timings', () => {
    expect(NumberingTrigger.isSaveTrigger({ numberingTiming: 'button' })).toBe(false);
    expect(NumberingTrigger.isSaveTrigger({ numberingTiming: 'status' })).toBe(false);
  });
});

describe('NumberingTrigger.isButtonTrigger', () => {
  test('true only when numberingTiming is "button"', () => {
    expect(NumberingTrigger.isButtonTrigger({ numberingTiming: 'button' })).toBe(true);
    expect(NumberingTrigger.isButtonTrigger({ numberingTiming: 'save' })).toBe(false);
    expect(NumberingTrigger.isButtonTrigger({})).toBe(false);
  });
});

describe('NumberingTrigger.isStatusTrigger', () => {
  test('true when timing is "status" and nextStatus matches the configured status', () => {
    const config = { numberingTiming: 'status', numberingStatus: '処理中' };
    expect(NumberingTrigger.isStatusTrigger(config, '処理中')).toBe(true);
  });

  test('false when the next status does not match the configured status', () => {
    const config = { numberingTiming: 'status', numberingStatus: '処理中' };
    expect(NumberingTrigger.isStatusTrigger(config, '完了')).toBe(false);
  });

  test('false when numberingStatus is not configured yet (empty string)', () => {
    const config = { numberingTiming: 'status', numberingStatus: '' };
    expect(NumberingTrigger.isStatusTrigger(config, '')).toBe(false);
  });

  test('false when timing is not "status"', () => {
    const config = { numberingTiming: 'save', numberingStatus: '処理中' };
    expect(NumberingTrigger.isStatusTrigger(config, '処理中')).toBe(false);
  });
});
