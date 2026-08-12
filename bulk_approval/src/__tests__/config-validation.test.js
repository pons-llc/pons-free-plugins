const ConfigValidation = require('../js/lib/config-validation');

describe('validate', () => {
  test('実行可能グループが0件ならエラー', () => {
    const errors = ConfigValidation.validate({
      displayFieldCodes: [],
      groupCodes: [],
    });
    expect(errors).toEqual(['実行可能グループを1つ以上指定してください。']);
  });

  test('実行可能グループが1件以上あればエラー無し', () => {
    const errors = ConfigValidation.validate({
      displayFieldCodes: [],
      groupCodes: ['managers'],
    });
    expect(errors).toEqual([]);
  });

  test('表示項目が0件でもエラーにならない', () => {
    const errors = ConfigValidation.validate({
      displayFieldCodes: [],
      groupCodes: ['managers'],
    });
    expect(errors).toEqual([]);
  });
});
