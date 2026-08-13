const {
  groupRecordsByField,
  groupRecordsByStatus,
} = require('../js/lib/record-grouping');

describe('groupRecordsByField', () => {
  const options = [
    { code: 'todo', label: '未着手' },
    { code: 'doing', label: '進行中' },
    { code: 'done', label: '完了' },
  ];

  test('groups records by field value, keeping empty defined columns', () => {
    const records = [
      { status_select: { value: 'todo' } },
      { status_select: { value: 'done' } },
      { status_select: { value: 'todo' } },
    ];
    const columns = groupRecordsByField(records, 'status_select', options);
    expect(columns.map((c) => c.key)).toEqual(['todo', 'doing', 'done']);
    expect(columns[0].records).toHaveLength(2);
    expect(columns[1].records).toHaveLength(0);
    expect(columns[2].records).toHaveLength(1);
  });

  test('puts records with a value not present in options into an "other" column', () => {
    const records = [{ status_select: { value: 'deleted_option' } }];
    const columns = groupRecordsByField(records, 'status_select', options);
    const other = columns.find((c) => c.key === '__OTHER__');
    expect(other).toBeDefined();
    expect(other.label).toBe('その他');
    expect(other.records).toHaveLength(1);
  });

  test('puts records with a blank value into an "unset" column', () => {
    const records = [
      { status_select: { value: '' } },
      { status_select: { value: null } },
      {},
    ];
    const columns = groupRecordsByField(records, 'status_select', options);
    const unset = columns.find((c) => c.key === '__UNSET__');
    expect(unset).toBeDefined();
    expect(unset.label).toBe('未設定');
    expect(unset.records).toHaveLength(3);
  });

  test('omits the "other"/"unset" columns when there are no such records', () => {
    const records = [{ status_select: { value: 'todo' } }];
    const columns = groupRecordsByField(records, 'status_select', options);
    expect(columns.some((c) => c.key === '__OTHER__')).toBe(false);
    expect(columns.some((c) => c.key === '__UNSET__')).toBe(false);
  });
});

describe('groupRecordsByStatus', () => {
  const statusSettings = {
    states: {
      未処理: { index: '0' },
      処理中: { index: '1' },
      完了: { index: '2' },
    },
  };

  test('orders columns by states[].index and keeps empty status columns', () => {
    const records = [
      { ステータス: { value: '完了' } },
      { ステータス: { value: '未処理' } },
    ];
    const columns = groupRecordsByStatus(records, 'ステータス', statusSettings);
    expect(columns.map((c) => c.key)).toEqual(['未処理', '処理中', '完了']);
    expect(columns[0].records).toHaveLength(1);
    expect(columns[1].records).toHaveLength(0);
    expect(columns[2].records).toHaveLength(1);
  });

  test('collects statuses not found in states into an "other" column', () => {
    const records = [{ ステータス: { value: '不明なステータス' } }];
    const columns = groupRecordsByStatus(records, 'ステータス', statusSettings);
    const other = columns.find((c) => c.key === '__OTHER__');
    expect(other).toBeDefined();
    expect(other.records).toHaveLength(1);
  });

  test('handles missing statusSettings.states gracefully', () => {
    const columns = groupRecordsByStatus(
      [{ ステータス: { value: 'x' } }],
      'ステータス',
      {},
    );
    expect(columns).toHaveLength(1);
    expect(columns[0].key).toBe('__OTHER__');
  });
});
