const SeriesBuilder = require('../js/lib/series-builder');

const numField = (value) => ({ type: 'NUMBER', value });
const textField = (value) => ({ type: 'SINGLE_LINE_TEXT', value });

const record = ({ id, name, category, sales, profit, cost }) => ({
  $id: { type: '__ID__', value: String(id) },
  name: textField(name),
  category: textField(category),
  sales: numField(sales),
  profit: numField(profit),
  cost: numField(cost),
});

describe('SeriesBuilder.buildSeries - grouping: record', () => {
  const config = {
    groupingType: 'record',
    axisFieldCodes: ['sales', 'profit', 'cost'],
    badgeFieldCodes: ['name'],
  };

  test('returns one series per record with raw axis values', () => {
    const records = [
      record({
        id: 1,
        name: '田中',
        category: 'A',
        sales: '100',
        profit: '20',
        cost: '80',
      }),
      record({
        id: 2,
        name: '鈴木',
        category: 'B',
        sales: '200',
        profit: '50',
        cost: '150',
      }),
    ];
    const series = SeriesBuilder.buildSeries(records, config);
    expect(series).toEqual([
      { label: '田中', values: [100, 20, 80], count: 1 },
      { label: '鈴木', values: [200, 50, 150], count: 1 },
    ]);
  });

  test('joins multiple badge fields with " / "', () => {
    const records = [
      record({
        id: 1,
        name: '田中',
        category: 'A',
        sales: '1',
        profit: '1',
        cost: '1',
      }),
    ];
    const series = SeriesBuilder.buildSeries(records, {
      ...config,
      badgeFieldCodes: ['name', 'category'],
    });
    expect(series[0].label).toBe('田中 / A');
  });

  test('falls back to "#$id" when no badge fields are configured or all are empty', () => {
    const records = [
      record({
        id: 42,
        name: '',
        category: '',
        sales: '1',
        profit: '1',
        cost: '1',
      }),
    ];
    const series = SeriesBuilder.buildSeries(records, {
      ...config,
      badgeFieldCodes: ['name'],
    });
    expect(series[0].label).toBe('#42');
  });

  test('treats non-numeric or empty axis values as 0', () => {
    const records = [
      record({
        id: 1,
        name: 'x',
        category: 'A',
        sales: '',
        profit: 'not a number',
        cost: '10',
      }),
    ];
    const series = SeriesBuilder.buildSeries(records, config);
    expect(series[0].values).toEqual([0, 0, 10]);
  });

  test('returns an empty array for an empty record list', () => {
    expect(SeriesBuilder.buildSeries([], config)).toEqual([]);
  });
});

describe('SeriesBuilder.buildSeries - grouping: field', () => {
  const config = {
    groupingType: 'field',
    groupingFieldCode: 'category',
    axisFieldCodes: ['sales', 'profit', 'cost'],
    badgeFieldCodes: ['name'],
  };

  test('sums axis values per distinct grouping field value, in first-seen order', () => {
    const records = [
      record({
        id: 1,
        name: 'a',
        category: 'B',
        sales: '10',
        profit: '1',
        cost: '5',
      }),
      record({
        id: 2,
        name: 'b',
        category: 'A',
        sales: '100',
        profit: '10',
        cost: '50',
      }),
      record({
        id: 3,
        name: 'c',
        category: 'B',
        sales: '20',
        profit: '2',
        cost: '10',
      }),
    ];
    const series = SeriesBuilder.buildSeries(records, config);
    expect(series).toEqual([
      { label: 'B', values: [30, 3, 15], count: 2 },
      { label: 'A', values: [100, 10, 50], count: 1 },
    ]);
  });

  test('groups records with an empty grouping field value under "(未設定)"', () => {
    const records = [
      record({
        id: 1,
        name: 'a',
        category: '',
        sales: '10',
        profit: '1',
        cost: '5',
      }),
    ];
    const series = SeriesBuilder.buildSeries(records, config);
    expect(series[0].label).toBe(SeriesBuilder.UNSET_GROUP_LABEL);
    expect(series[0].count).toBe(1);
  });
});
