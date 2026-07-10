'use strict';

const RuleLookup = require('../js/lib/rule-lookup');

describe('RuleLookup.findRule', () => {
  test('returns the first rule matching the trigger event', () => {
    const rules = [
      { triggerEvent: 'EDIT_SUBMIT', body: 'A' },
      { triggerEvent: 'CREATE_SUBMIT', body: 'B' },
    ];
    expect(RuleLookup.findRule(rules, 'CREATE_SUBMIT')).toBe(rules[1]);
  });

  test('returns the first rule when multiple rules target the same trigger event', () => {
    const rules = [
      { triggerEvent: 'CREATE_SUBMIT', body: 'first' },
      { triggerEvent: 'CREATE_SUBMIT', body: 'second' },
    ];
    expect(RuleLookup.findRule(rules, 'CREATE_SUBMIT')).toBe(rules[0]);
  });

  test('returns null when no rule matches the trigger event', () => {
    const rules = [{ triggerEvent: 'EDIT_SUBMIT', body: 'A' }];
    expect(RuleLookup.findRule(rules, 'CREATE_SUBMIT')).toBeNull();
  });

  test('returns null when the rule list is empty', () => {
    expect(RuleLookup.findRule([], 'CREATE_SUBMIT')).toBeNull();
  });
});
