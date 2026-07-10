const ColorAssignment = require('../js/lib/color-assignment');

const row = (fields) => ({ record: fields });

const dropdownField = (value) => ({ type: 'DROP_DOWN', value });
const userField = (code) => ({
  type: 'USER_SELECT',
  value: code ? [{ code, name: code }] : [],
});

describe('ColorAssignment.resolveColorKey', () => {
  test('resolves a plain string field value', () => {
    expect(
      ColorAssignment.resolveColorKey(
        { status: dropdownField('todo') },
        'status',
      ),
    ).toBe('todo');
  });

  test('resolves the code of the first entry of a user-select-like field', () => {
    expect(
      ColorAssignment.resolveColorKey(
        { assignee: userField('alice') },
        'assignee',
      ),
    ).toBe('alice');
  });

  test('returns "" for an empty multi-select value', () => {
    expect(
      ColorAssignment.resolveColorKey({ assignee: userField('') }, 'assignee'),
    ).toBe('');
  });

  test('returns "" when the field code is not configured', () => {
    expect(
      ColorAssignment.resolveColorKey({ status: dropdownField('todo') }, ''),
    ).toBe('');
  });

  test('returns "" when the field is missing from the record', () => {
    expect(ColorAssignment.resolveColorKey({}, 'status')).toBe('');
  });
});

describe('ColorAssignment.assignColors', () => {
  test('assigns a distinct color per unique value, cycling through the palette', () => {
    const rows = [
      row({ status: dropdownField('a') }),
      row({ status: dropdownField('b') }),
      row({ status: dropdownField('c') }),
    ];
    const map = ColorAssignment.assignColors(rows, 'status', ['#111', '#222']);
    expect(map.a).toBe('#111');
    expect(map.b).toBe('#222');
    expect(map.c).toBe('#111'); // cycles back around
  });

  test('assigns colors deterministically (sorted key order) regardless of row order', () => {
    const rowsA = [
      row({ status: dropdownField('b') }),
      row({ status: dropdownField('a') }),
    ];
    const rowsB = [
      row({ status: dropdownField('a') }),
      row({ status: dropdownField('b') }),
    ];
    const mapA = ColorAssignment.assignColors(rowsA, 'status', [
      '#111',
      '#222',
    ]);
    const mapB = ColorAssignment.assignColors(rowsB, 'status', [
      '#111',
      '#222',
    ]);
    expect(mapA).toEqual(mapB);
  });

  test('uses the default palette when none is supplied', () => {
    const rows = [row({ status: dropdownField('a') })];
    const map = ColorAssignment.assignColors(rows, 'status');
    expect(map.a).toBe(ColorAssignment.DEFAULT_PALETTE[0]);
  });

  test('rows with no color field configured all map under the "" key', () => {
    const rows = [
      row({ status: dropdownField('a') }),
      row({ status: dropdownField('b') }),
    ];
    const map = ColorAssignment.assignColors(rows, '');
    expect(Object.keys(map)).toEqual(['']);
  });
});

describe('ColorAssignment.getColorForRow', () => {
  test('returns the color mapped to the row value', () => {
    const colorMap = { a: '#111', b: '#222' };
    expect(
      ColorAssignment.getColorForRow(
        colorMap,
        { status: dropdownField('a') },
        'status',
      ),
    ).toBe('#111');
  });

  test('falls back to the given fallback color for an unmapped value', () => {
    const colorMap = { a: '#111' };
    expect(
      ColorAssignment.getColorForRow(
        colorMap,
        { status: dropdownField('z') },
        'status',
        '#fallback',
      ),
    ).toBe('#fallback');
  });
});
