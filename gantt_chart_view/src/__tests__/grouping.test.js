const Grouping = require('../js/lib/grouping');
const RecordModel = require('../js/lib/record-model');

const config = { startFieldCode: 'start_date', endFieldCode: 'end_date' };

const record = (id, start, end, assignee) => ({
  $id: { value: String(id) },
  start_date: { value: start },
  end_date: { value: end },
  assignee: {
    type: 'USER_SELECT',
    value: assignee ? [{ code: assignee, name: assignee }] : [],
  },
  status: { type: 'DROP_DOWN', value: assignee || '' },
});

describe('Grouping.groupRows', () => {
  test('rows without a groupFieldCode all fall into a single unnamed group, unscheduled rows in their own group at the end', () => {
    const rows = RecordModel.buildRows(
      [record(1, '2026-07-01', '2026-07-05'), record(2, '', '2026-07-05')],
      config,
    );
    const groups = Grouping.groupRows(rows, '');
    expect(groups).toHaveLength(2);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[1].key).toBe(RecordModel.UNSCHEDULED_GROUP_KEY);
    expect(groups[1].label).toBe('未仕訳');
    expect(groups[1].rows).toHaveLength(1);
  });

  test('rows are grouped by a USER_SELECT field value, unscheduled rows always appear last', () => {
    const rows = RecordModel.buildRows(
      [
        record(1, '2026-07-01', '2026-07-05', 'alice'),
        record(2, '2026-07-02', '2026-07-06', 'bob'),
        record(3, '2026-07-03', '2026-07-07', 'alice'),
        record(4, '', '', 'carol'),
      ],
      config,
    );
    const groups = Grouping.groupRows(rows, 'assignee');
    const lastGroup = groups[groups.length - 1];
    expect(lastGroup.key).toBe(RecordModel.UNSCHEDULED_GROUP_KEY);

    const aliceGroup = groups.find((g) => g.key === 'alice');
    expect(aliceGroup.rows).toHaveLength(2);
  });

  test('rows with an empty/missing group value are grouped under a "(未設定)" bucket, separate from unscheduled', () => {
    const rows = RecordModel.buildRows(
      [record(1, '2026-07-01', '2026-07-05', '')],
      config,
    );
    const groups = Grouping.groupRows(rows, 'assignee');
    expect(groups[0].key).toBe('');
    expect(groups[0].label).toBe('(未設定)');
  });

  test('grouping by a DROP_DOWN (string) field works the same way as multi-select fields', () => {
    const rows = RecordModel.buildRows(
      [
        record(1, '2026-07-01', '2026-07-05', 'todo'),
        record(2, '2026-07-01', '2026-07-05', 'todo'),
      ],
      config,
    );
    const groups = Grouping.groupRows(rows, 'status');
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
  });
});

describe('Grouping.isGroupableField', () => {
  test('USER_SELECT, ORGANIZATION_SELECT, GROUP_SELECT, DROP_DOWN, RADIO_BUTTON are groupable', () => {
    [
      'USER_SELECT',
      'ORGANIZATION_SELECT',
      'GROUP_SELECT',
      'DROP_DOWN',
      'RADIO_BUTTON',
    ].forEach((type) => {
      expect(Grouping.isGroupableField({ type })).toBe(true);
    });
  });

  test('other field types (e.g. SINGLE_LINE_TEXT, NUMBER) are not groupable', () => {
    expect(Grouping.isGroupableField({ type: 'SINGLE_LINE_TEXT' })).toBe(false);
    expect(Grouping.isGroupableField({ type: 'NUMBER' })).toBe(false);
  });

  test('a missing/undefined field is not groupable', () => {
    expect(Grouping.isGroupableField(undefined)).toBe(false);
  });
});

describe('Grouping.validateGroupConfig', () => {
  const formFields = {
    assignee: { code: 'assignee', type: 'USER_SELECT' },
    status: { code: 'status', type: 'DROP_DOWN' },
    memo: { code: 'memo', type: 'SINGLE_LINE_TEXT' },
  };

  test('valid when all allowed fields are groupable and default is among allowed fields', () => {
    const result = Grouping.validateGroupConfig(
      'assignee',
      ['assignee', 'status'],
      formFields,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('invalid when an allowed field is not a groupable type', () => {
    const result = Grouping.validateGroupConfig('', ['memo'], formFields);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('invalid when the default grouping field is not in the allowed list', () => {
    const result = Grouping.validateGroupConfig(
      'status',
      ['assignee'],
      formFields,
    );
    expect(result.valid).toBe(false);
  });

  test('an empty default grouping field ("no grouping") is always valid regardless of allowed list', () => {
    const result = Grouping.validateGroupConfig('', ['assignee'], formFields);
    expect(result.valid).toBe(true);
  });
});
