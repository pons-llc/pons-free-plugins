const {
  validateViewConfig,
  validateViewConfigs,
} = require('../js/lib/config-validation');

describe('validateViewConfig', () => {
  test('valid when title is set and groupMode/assigneeMode requirements are met', () => {
    const result = validateViewConfig({
      titleFieldCode: 'title',
      groupMode: 'STATUS',
      assigneeMode: 'STATUS_ASSIGNEE',
    });
    expect(result.valid).toBe(true);
  });

  test('invalid when titleFieldCode is missing', () => {
    const result = validateViewConfig({
      groupMode: 'STATUS',
      assigneeMode: 'STATUS_ASSIGNEE',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/タイトル/);
  });

  test('invalid when groupMode is FIELD but groupFieldCode is missing', () => {
    const result = validateViewConfig({
      titleFieldCode: 'title',
      groupMode: 'FIELD',
      assigneeMode: 'STATUS_ASSIGNEE',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/グループ分け/);
  });

  test('valid when groupMode is FIELD and groupFieldCode is set', () => {
    const result = validateViewConfig({
      titleFieldCode: 'title',
      groupMode: 'FIELD',
      groupFieldCode: 'status_select',
      assigneeMode: 'STATUS_ASSIGNEE',
    });
    expect(result.valid).toBe(true);
  });

  test('invalid when assigneeMode is USER_FIELD but assigneeFieldCode is missing', () => {
    const result = validateViewConfig({
      titleFieldCode: 'title',
      groupMode: 'STATUS',
      assigneeMode: 'USER_FIELD',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/担当者/);
  });

  test('valid when assigneeMode is USER_FIELD and assigneeFieldCode is set', () => {
    const result = validateViewConfig({
      titleFieldCode: 'title',
      groupMode: 'STATUS',
      assigneeMode: 'USER_FIELD',
      assigneeFieldCode: 'assignee_user',
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateViewConfigs', () => {
  const validBase = {
    titleFieldCode: 't',
    groupMode: 'STATUS',
    assigneeMode: 'STATUS_ASSIGNEE',
  };

  test('flags duplicate viewIds', () => {
    const result = validateViewConfigs([
      { viewId: 'ALL', ...validBase },
      { viewId: 'ALL', ...validBase },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/重複/);
  });

  test('valid for a well-formed list of distinct views', () => {
    const result = validateViewConfigs([
      { viewId: 'ALL', ...validBase },
      { viewId: '5', ...validBase },
    ]);
    expect(result.valid).toBe(true);
  });

  test('valid for an empty list', () => {
    expect(validateViewConfigs([])).toEqual({ valid: true, errors: [] });
  });
});
