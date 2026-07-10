'use strict';

const StyleBuilder = require('../js/lib/style-builder');

const rules = [
  {
    condition: {
      conditionOperator: 'AND',
      children: [{ fieldCode: 'status', operator: 'EQ', value: '対応中' }],
    },
    backgroundColor: '#ff0000',
  },
];

const record = (id, status) => ({
  $id: { type: '__ID__', value: String(id) },
  status: { type: 'DROP_DOWN', value: status },
});

describe('StyleBuilder.buildStyleConfig', () => {
  test('builds a style entry for each matching record covering every column', () => {
    const records = [record(1, '対応中'), record(2, '完了')];
    const result = StyleBuilder.buildStyleConfig(records, rules, [
      'status',
      'title',
    ]);
    expect(result).toEqual([
      {
        recordId: '1',
        style: [
          { column: 'status', background: { backgroundColor: '#ff0000' } },
          { column: 'title', background: { backgroundColor: '#ff0000' } },
        ],
      },
    ]);
  });

  test('omits records that match no rule', () => {
    const records = [record(1, '完了')];
    const result = StyleBuilder.buildStyleConfig(records, rules, ['status']);
    expect(result).toEqual([]);
  });

  test('returns an empty array when there are no records or rules', () => {
    expect(StyleBuilder.buildStyleConfig([], rules, ['status'])).toEqual([]);
    expect(
      StyleBuilder.buildStyleConfig([record(1, '対応中')], [], ['status']),
    ).toEqual([]);
  });
});
