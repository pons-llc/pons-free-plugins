const TypeCompatibility = require('../js/lib/type-compatibility');

describe('TypeCompatibility.check', () => {
  test('an identical type pair is always compatible with no warning', () => {
    expect(
      TypeCompatibility.check('SINGLE_LINE_TEXT', 'SINGLE_LINE_TEXT'),
    ).toEqual({
      compatible: true,
      warning: null,
      reason: null,
    });
  });

  test('a NUMBER source into a TEXT target is compatible with a warning', () => {
    const result = TypeCompatibility.check('NUMBER', 'SINGLE_LINE_TEXT');
    expect(result.compatible).toBe(true);
    expect(result.warning).toMatch(/文字列/);
  });

  test('a single-select source into a multi-select target is compatible with a warning', () => {
    const result = TypeCompatibility.check('DROP_DOWN', 'CHECK_BOX');
    expect(result.compatible).toBe(true);
    expect(result.warning).toMatch(/複数選択/);
  });

  test('a multi-select source into a single-select target is not compatible', () => {
    const result = TypeCompatibility.check('CHECK_BOX', 'DROP_DOWN');
    expect(result.compatible).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  test('DATE and DATETIME are different categories and are not compatible', () => {
    const result = TypeCompatibility.check('DATE', 'DATETIME');
    expect(result.compatible).toBe(false);
  });

  test('USER_SELECT and ORGANIZATION_SELECT are not compatible with each other', () => {
    expect(
      TypeCompatibility.check('USER_SELECT', 'ORGANIZATION_SELECT').compatible,
    ).toBe(false);
  });

  test('SUBTABLE cannot be used as a source field', () => {
    const result = TypeCompatibility.check('SUBTABLE', 'SINGLE_LINE_TEXT');
    expect(result.compatible).toBe(false);
    expect(result.reason).toMatch(/SUBTABLE/);
  });

  test('REFERENCE_TABLE cannot be used as a source field', () => {
    expect(
      TypeCompatibility.check('REFERENCE_TABLE', 'SINGLE_LINE_TEXT').compatible,
    ).toBe(false);
  });

  test('FILE is unsupported as either a source or a target', () => {
    expect(TypeCompatibility.check('FILE', 'SINGLE_LINE_TEXT').compatible).toBe(
      false,
    );
    expect(TypeCompatibility.check('SINGLE_LINE_TEXT', 'FILE').compatible).toBe(
      false,
    );
  });

  test('an unknown field type is not compatible', () => {
    expect(
      TypeCompatibility.check('SOMETHING_UNKNOWN', 'SINGLE_LINE_TEXT')
        .compatible,
    ).toBe(false);
  });

  test('missing arguments are not compatible', () => {
    expect(TypeCompatibility.check(null, 'SINGLE_LINE_TEXT').compatible).toBe(
      false,
    );
    expect(TypeCompatibility.check('SINGLE_LINE_TEXT', null).compatible).toBe(
      false,
    );
  });
});
