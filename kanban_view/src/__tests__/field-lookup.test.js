const { findFieldCodeByType, optionsOf } = require('../js/lib/field-lookup');

describe('findFieldCodeByType', () => {
  test('returns the code of the first field matching the given type', () => {
    const formFields = {
      title: { type: 'SINGLE_LINE_TEXT' },
      status: { type: 'STATUS' },
      worker: { type: 'STATUS_ASSIGNEE' },
    };
    expect(findFieldCodeByType(formFields, 'STATUS')).toBe('status');
    expect(findFieldCodeByType(formFields, 'STATUS_ASSIGNEE')).toBe('worker');
  });

  test('returns null when no field matches the type', () => {
    expect(
      findFieldCodeByType({ title: { type: 'SINGLE_LINE_TEXT' } }, 'STATUS'),
    ).toBeNull();
  });

  test('returns null for empty/missing formFields', () => {
    expect(findFieldCodeByType(null, 'STATUS')).toBeNull();
    expect(findFieldCodeByType({}, 'STATUS')).toBeNull();
  });
});

describe('optionsOf', () => {
  test('returns options sorted by index', () => {
    const field = {
      type: 'DROP_DOWN',
      options: {
        b: { label: 'B', index: '1' },
        a: { label: 'A', index: '0' },
      },
    };
    expect(optionsOf(field)).toEqual([
      { code: 'a', label: 'A' },
      { code: 'b', label: 'B' },
    ]);
  });

  test('returns an empty array when the field has no options', () => {
    expect(optionsOf({ type: 'SINGLE_LINE_TEXT' })).toEqual([]);
    expect(optionsOf(null)).toEqual([]);
  });
});
