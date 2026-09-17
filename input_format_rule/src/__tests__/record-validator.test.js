'use strict';

const RecordValidator = require('../js/lib/record-validator');

const makeRule = (overrides) => ({
  fieldCode: 'name',
  forbid: {
    fullWidthHiragana: false,
    fullWidthKatakana: false,
    halfWidthKatakana: false,
    fullWidthAlnum: false,
    halfWidthAlnum: false,
    fullWidthSymbol: false,
    halfWidthSymbol: false,
  },
  ...overrides,
});

describe('RecordValidator.validateFieldValue', () => {
  test('禁止文字が含まれる場合はエラーメッセージを返す', () => {
    const rule = makeRule({
      forbid: { ...makeRule().forbid, halfWidthAlnum: true },
    });
    expect(RecordValidator.validateFieldValue('abc123', rule)).toMatch(
      /半角英数字/,
    );
  });

  test('禁止文字が含まれない場合はnullを返す', () => {
    const rule = makeRule({
      forbid: { ...makeRule().forbid, halfWidthAlnum: true },
    });
    expect(RecordValidator.validateFieldValue('あいうえお', rule)).toBeNull();
  });

  test('ruleがnull/undefinedの場合はnullを返す(例外を投げない)', () => {
    expect(RecordValidator.validateFieldValue('abc', null)).toBeNull();
    expect(RecordValidator.validateFieldValue('abc', undefined)).toBeNull();
  });
});

describe('RecordValidator.findRuleForField', () => {
  test('fieldCodeが一致するルールを返す', () => {
    const rules = [makeRule({ fieldCode: 'a' }), makeRule({ fieldCode: 'b' })];
    expect(RecordValidator.findRuleForField(rules, 'b')).toBe(rules[1]);
  });

  test('一致するルールが無ければundefinedを返す', () => {
    const rules = [makeRule({ fieldCode: 'a' })];
    expect(RecordValidator.findRuleForField(rules, 'z')).toBeUndefined();
  });

  test('rulesが未指定でも例外を投げない', () => {
    expect(RecordValidator.findRuleForField(undefined, 'a')).toBeUndefined();
  });
});

describe('RecordValidator.validateRecord', () => {
  // fieldMessagesは対象フィールドすべてについて、違反時はエラーメッセージ・違反なしはnullを
  // 返す「完全なマップ」にする(値を修正した際に古いエラーを明示的にクリアできるようにするため。
  // idea.md「発動する画面・タイミング」参照)。
  test('違反したフィールドはメッセージ、違反しなかったフィールドはnullを返す', () => {
    const rules = [
      makeRule({
        fieldCode: 'kana',
        forbid: { ...makeRule().forbid, fullWidthHiragana: true },
      }),
      makeRule({
        fieldCode: 'code',
        forbid: { ...makeRule().forbid, halfWidthAlnum: true },
      }),
    ];
    const record = {
      kana: { value: 'あいう' },
      code: { value: '正常な値' },
    };
    const result = RecordValidator.validateRecord(record, rules);
    expect(result.hasError).toBe(true);
    expect(result.fieldMessages.kana).toMatch(/全角ひらがな/);
    expect(result.fieldMessages.code).toBeNull();
  });

  test('違反が無ければhasErrorはfalse、全フィールドnull', () => {
    const rules = [
      makeRule({
        fieldCode: 'kana',
        forbid: { ...makeRule().forbid, fullWidthHiragana: true },
      }),
    ];
    const record = { kana: { value: 'ABC' } };
    const result = RecordValidator.validateRecord(record, rules);
    expect(result.hasError).toBe(false);
    expect(result.fieldMessages).toEqual({ kana: null });
  });

  test('レコードに対象フィールドが存在しない場合は無視する(例外を投げない)', () => {
    const rules = [
      makeRule({
        fieldCode: 'missing',
        forbid: { ...makeRule().forbid, halfWidthAlnum: true },
      }),
    ];
    const result = RecordValidator.validateRecord({}, rules);
    expect(result.hasError).toBe(false);
    expect(result.fieldMessages).toEqual({});
  });

  test('rulesが空配列でも例外を投げない', () => {
    const result = RecordValidator.validateRecord({ a: { value: '1' } }, []);
    expect(result).toEqual({ fieldMessages: {}, hasError: false });
  });
});
