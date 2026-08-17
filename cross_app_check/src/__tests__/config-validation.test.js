const ConfigValidation = require('../js/lib/config-validation');

const validConfig = () => ({
  baseApp: { appId: '570', keyFieldCode: '宛名番号' },
  targets: [{ appId: '571', keyFieldCode: '宛名番号' }],
});

describe('validate — 正常系', () => {
  test('基準アプリと対象アプリが揃っていれば通る', () => {
    expect(ConfigValidation.validate(validConfig(), '600')).toEqual({
      ok: true,
      errors: [],
    });
  });

  test('対象アプリが複数でも通る', () => {
    const config = validConfig();
    config.targets.push({ appId: '572', keyFieldCode: '宛名番号' });
    expect(ConfigValidation.validate(config, '600').ok).toBe(true);
  });

  test('未入力の空行は対象アプリとして数えない', () => {
    const config = validConfig();
    config.targets.push({ appId: '', keyFieldCode: '' });
    expect(ConfigValidation.validate(config, '600').ok).toBe(true);
  });
});

describe('validate — 基準アプリ', () => {
  test('アプリID未入力を弾く', () => {
    const config = validConfig();
    config.baseApp.appId = '';
    expect(ConfigValidation.validate(config).errors).toContain(
      '基準アプリのアプリIDを入力してください。',
    );
  });

  test('数字以外のアプリIDを弾く', () => {
    const config = validConfig();
    config.baseApp.appId = 'abc';
    expect(ConfigValidation.validate(config).errors).toContain(
      '基準アプリのアプリIDは数字で入力してください。',
    );
  });

  test('突合キー未選択を弾く', () => {
    const config = validConfig();
    config.baseApp.keyFieldCode = '';
    expect(ConfigValidation.validate(config).errors).toContain(
      '基準アプリの突合キーとなるフィールドを選択してください。',
    );
  });
});

describe('validate — 対象アプリ', () => {
  test('1つも無ければ弾く', () => {
    const config = validConfig();
    config.targets = [];
    expect(ConfigValidation.validate(config).errors).toContain(
      '対象アプリを1つ以上設定してください。',
    );
  });

  test('アプリIDだけ入れて突合キーが未選択なら弾く', () => {
    const config = validConfig();
    config.targets = [{ appId: '571', keyFieldCode: '' }];
    expect(ConfigValidation.validate(config).errors).toContain(
      '対象アプリ1の突合キーとなるフィールドを選択してください。',
    );
  });

  test('同じアプリIDの重複を弾く', () => {
    const config = validConfig();
    config.targets.push({ appId: '571', keyFieldCode: '宛名番号' });
    expect(ConfigValidation.validate(config).errors).toContain(
      '対象アプリ2のアプリID(571)が重複しています。',
    );
  });
});

describe('validate — 集計アプリ自身の指定', () => {
  test('基準アプリに集計アプリ自身は指定できない', () => {
    const config = validConfig();
    config.baseApp.appId = '600';
    expect(ConfigValidation.validate(config, '600').errors).toContain(
      '基準アプリにこの集計アプリ自身は指定できません。別のアプリを指定してください。',
    );
  });

  test('対象アプリに集計アプリ自身は指定できない', () => {
    const config = validConfig();
    config.targets = [{ appId: '600', keyFieldCode: '宛名番号' }];
    expect(ConfigValidation.validate(config, '600').errors).toContain(
      '対象アプリ1にこの集計アプリ自身は指定できません。',
    );
  });

  test('現在のアプリIDを渡さなければそのチェックは行わない', () => {
    const config = validConfig();
    config.baseApp.appId = '600';
    expect(ConfigValidation.validate(config).ok).toBe(true);
  });
});

describe('validate — 壊れた入力', () => {
  test('configがnullでも例外を投げない', () => {
    const result = ConfigValidation.validate(null);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('targetsが配列でなくても落ちない', () => {
    const result = ConfigValidation.validate({
      baseApp: { appId: '570', keyFieldCode: 'k' },
      targets: 'これは配列ではない',
    });
    expect(result.errors).toContain('対象アプリを1つ以上設定してください。');
  });
});

describe('isAppId', () => {
  test('数字のみを許可する', () => {
    expect(ConfigValidation.isAppId('570')).toBe(true);
    expect(ConfigValidation.isAppId(' 570 ')).toBe(true);
    expect(ConfigValidation.isAppId('57a')).toBe(false);
    expect(ConfigValidation.isAppId('')).toBe(false);
    expect(ConfigValidation.isAppId(null)).toBe(false);
  });
});
