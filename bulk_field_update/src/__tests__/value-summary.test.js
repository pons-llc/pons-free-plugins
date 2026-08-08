'use strict';

const {
  isBlank,
  describeValue,
  buildTargetSummaries,
} = require('../js/lib/value-summary');

describe('isBlank', () => {
  test('空文字列・null・undefined・空配列はblank', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank([])).toBe(true);
  });

  test('値がある場合はblankではない', () => {
    expect(isBlank('a')).toBe(false);
    expect(isBlank(['a'])).toBe(false);
    expect(isBlank('0')).toBe(false);
  });
});

describe('describeValue', () => {
  test('空値は「(空にする)」と表示する', () => {
    expect(describeValue({ type: 'SINGLE_LINE_TEXT' }, '')).toBe('(空にする)');
    expect(describeValue({ type: 'CHECK_BOX', options: {} }, [])).toBe(
      '(空にする)',
    );
  });

  test('単一選択(ラジオボタン/ドロップダウン)は選択肢のlabelを表示する', () => {
    const field = {
      type: 'DROP_DOWN',
      options: { opt1: { label: '選択肢イチ', index: '0' } },
    };
    expect(describeValue(field, 'opt1')).toBe('選択肢イチ');
  });

  test('複数選択(チェックボックス/複数選択)は選択肢のlabelをカンマ区切りで表示する', () => {
    const field = {
      type: 'CHECK_BOX',
      options: {
        opt1: { label: 'イチ', index: '0' },
        opt2: { label: 'ニ', index: '1' },
      },
    };
    expect(describeValue(field, ['opt1', 'opt2'])).toBe('イチ, ニ');
  });

  test('通常の文字列・数値等の値はそのまま表示する', () => {
    expect(describeValue({ type: 'SINGLE_LINE_TEXT' }, 'こんにちは')).toBe(
      'こんにちは',
    );
    expect(describeValue({ type: 'NUMBER' }, '123')).toBe('123');
  });
});

describe('buildTargetSummaries', () => {
  test('現在のフォームに存在するフィールドだけをサマリー化する', () => {
    const targets = [
      { fieldCode: 'text1', value: 'hello' },
      { fieldCode: 'deleted1', value: 'x' },
    ];
    const formFieldsByCode = {
      text1: { type: 'SINGLE_LINE_TEXT', label: '文字列1' },
    };
    const { summaries } = buildTargetSummaries(targets, formFieldsByCode);
    expect(summaries).toEqual([
      { fieldCode: 'text1', label: '文字列1', valueLabel: 'hello' },
    ]);
  });

  test('targetsが空の場合は空の結果を返す', () => {
    expect(buildTargetSummaries([], {})).toEqual({ summaries: [] });
    expect(buildTargetSummaries(null, {})).toEqual({ summaries: [] });
  });
});
