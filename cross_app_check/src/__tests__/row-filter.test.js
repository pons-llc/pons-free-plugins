const RowFilter = require('../js/lib/row-filter');

const rows = [
  {
    key: 'A-001',
    name: '山田花子',
    targets: [{ submitted: true }, { submitted: true }],
  },
  {
    key: 'A-002',
    name: '鈴木一郎',
    targets: [{ submitted: false }, { submitted: true }],
  },
  {
    key: 'A-003',
    name: '佐藤次郎',
    targets: [{ submitted: true }, { submitted: false }],
  },
];

describe('filterRows — 既定', () => {
  test('条件を渡さなければ全行返す', () => {
    expect(RowFilter.filterRows(rows, {})).toHaveLength(3);
    expect(RowFilter.filterRows(rows)).toHaveLength(3);
  });

  test('rowsがnullでも落ちない', () => {
    expect(RowFilter.filterRows(null, {})).toEqual([]);
  });
});

describe('filterRows — 未提出のみ', () => {
  test('対象アプリ「すべて」ではどれか1つでも未提出の行を残す', () => {
    const filtered = RowFilter.filterRows(rows, { unsubmittedOnly: true });
    expect(filtered.map((row) => row.key)).toEqual(['A-002', 'A-003']);
  });

  test('対象アプリを絞るとそのアプリが未提出の行だけ残す', () => {
    expect(
      RowFilter.filterRows(rows, { unsubmittedOnly: true, targetIndex: 0 }).map(
        (row) => row.key,
      ),
    ).toEqual(['A-002']);
    expect(
      RowFilter.filterRows(rows, { unsubmittedOnly: true, targetIndex: 1 }).map(
        (row) => row.key,
      ),
    ).toEqual(['A-003']);
  });

  test('未提出のみを外せば絞り込まない', () => {
    expect(
      RowFilter.filterRows(rows, { unsubmittedOnly: false, targetIndex: 0 }),
    ).toHaveLength(3);
  });

  test('存在しない対象アプリの番号では該当なし', () => {
    expect(
      RowFilter.filterRows(rows, { unsubmittedOnly: true, targetIndex: 9 }),
    ).toEqual([]);
  });
});

describe('filterRows — キーワード', () => {
  test('キーでも氏名でも部分一致する', () => {
    expect(
      RowFilter.filterRows(rows, { keyword: 'A-002' }).map((r) => r.key),
    ).toEqual(['A-002']);
    expect(
      RowFilter.filterRows(rows, { keyword: '鈴木' }).map((r) => r.key),
    ).toEqual(['A-002']);
  });

  test('大文字小文字を区別しない', () => {
    expect(
      RowFilter.filterRows(rows, { keyword: 'a-001' }).map((r) => r.key),
    ).toEqual(['A-001']);
  });

  test('空白のみのキーワードは無視する', () => {
    expect(RowFilter.filterRows(rows, { keyword: '   ' })).toHaveLength(3);
  });

  test('未提出のみと組み合わせられる', () => {
    const filtered = RowFilter.filterRows(rows, {
      unsubmittedOnly: true,
      keyword: '佐藤',
    });
    expect(filtered.map((row) => row.key)).toEqual(['A-003']);
  });
});
