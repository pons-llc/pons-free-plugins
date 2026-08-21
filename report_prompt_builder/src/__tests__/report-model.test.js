'use strict';

const ReportModel = require('../js/lib/report-model');

const fieldItem = (overrides) => ({
  kind: 'FIELD',
  code: 'shomei',
  label: '件名',
  type: 'SINGLE_LINE_TEXT',
  showLabel: true,
  fontSizePt: 11,
  wrap: true,
  bordered: true,
  labelPosition: 'TOP',
  textAlign: 'LEFT',
  row: 1,
  colStart: 1,
  colSpan: 12,
  ...overrides,
});

const tableItem = (overrides) => ({
  kind: 'TABLE',
  code: 'line_items',
  label: '明細',
  bordered: true,
  row: 2,
  colStart: 1,
  colSpan: 12,
  columns: [
    {
      code: 'item_name',
      label: '品名',
      type: 'SINGLE_LINE_TEXT',
      isNumeric: false,
      fontSizePt: 10,
      wrap: true,
      textAlign: 'LEFT',
    },
    {
      code: 'qty',
      label: '数量',
      type: 'NUMBER',
      isNumeric: true,
      unit: '',
      unitPosition: 'AFTER',
      showUnit: false,
      digitGrouping: false,
      fontSizePt: 10,
      wrap: true,
      textAlign: 'RIGHT',
    },
  ],
  ...overrides,
});

const textItem = (overrides) => ({
  kind: 'TEXT',
  text: '御見積書',
  fontSizePt: 18,
  wrap: true,
  bordered: false,
  textAlign: 'LEFT',
  row: 1,
  colStart: 1,
  colSpan: 12,
  ...overrides,
});

const imageItem = (overrides) => ({
  kind: 'IMAGE',
  imageId: 'img_1',
  bordered: false,
  row: 1,
  colStart: 1,
  colSpan: 3,
  ...overrides,
});

describe('buildPageModel', () => {
  test('resolves a TEXT item to its fixed text without touching the record', () => {
    const page = { items: [textItem()] };

    const model = ReportModel.buildPageModel(page, null);

    expect(model.rows).toEqual([
      {
        row: 1,
        padding: 0,
        cells: [
          {
            kind: 'TEXT',
            text: '御見積書',
            fontSizePt: 18,
            wrap: true,
            bordered: false,
            textAlign: 'LEFT',
            verticalAlign: 'TOP',
            colStart: 1,
            colSpan: 12,
          },
        ],
      },
    ]);
  });

  test('a TEXT item with no text resolves to an empty string, not a crash', () => {
    const page = { items: [textItem({ text: undefined })] };
    const model = ReportModel.buildPageModel(page, {});
    expect(model.rows[0].cells[0].text).toBe('');
  });

  test('resolves an IMAGE item to the dataUrl referenced by its imageId', () => {
    const page = { items: [imageItem({ imageId: 'img_1' })] };
    const images = { img_1: 'data:image/png;base64,AAAA' };

    const model = ReportModel.buildPageModel(page, null, images);

    expect(model.rows).toEqual([
      {
        row: 1,
        padding: 0,
        cells: [
          {
            kind: 'IMAGE',
            dataUrl: 'data:image/png;base64,AAAA',
            bordered: false,
            colStart: 1,
            colSpan: 3,
          },
        ],
      },
    ]);
  });

  test('an IMAGE item whose imageId has no matching entry resolves to an empty dataUrl, not a crash', () => {
    const page = { items: [imageItem({ imageId: 'missing_id' })] };
    const images = { img_1: 'data:image/png;base64,AAAA' };

    const model = ReportModel.buildPageModel(page, null, images);
    expect(model.rows[0].cells[0].dataUrl).toBe('');
  });

  test('an IMAGE item resolves to an empty dataUrl when no images map is provided at all', () => {
    const page = { items: [imageItem()] };
    const model = ReportModel.buildPageModel(page, null, undefined);
    expect(model.rows[0].cells[0].dataUrl).toBe('');
  });

  test('an IMAGE item overlapping a FIELD item in the same row is ordered last (rendered on top)', () => {
    // 画像は他の項目に重ねて配置できる(ユーザー指示)。DOM上で最後に描画された要素が
    // 手前に表示されるため、colStartが小さくてもIMAGEは常に同じ行の中で最後になる必要がある。
    const page = {
      items: [
        imageItem({ row: 1, colStart: 1, colSpan: 3 }),
        fieldItem({ row: 1, colStart: 1, colSpan: 12 }),
      ],
    };

    const model = ReportModel.buildPageModel(page, {});

    expect(model.rows[0].cells.map((cell) => cell.kind)).toEqual([
      'FIELD',
      'IMAGE',
    ]);
  });

  test('resolves a FIELD item to its formatted text and carries display properties through', () => {
    const page = { items: [fieldItem()] };
    const record = {
      shomei: { type: 'SINGLE_LINE_TEXT', value: '作業衣等購入' },
    };

    const model = ReportModel.buildPageModel(page, record);

    expect(model.rows).toEqual([
      {
        row: 1,
        padding: 0,
        cells: [
          {
            kind: 'FIELD',
            code: 'shomei',
            label: '件名',
            showLabel: true,
            fontSizePt: 11,
            wrap: true,
            bordered: true,
            labelPosition: 'TOP',
            textAlign: 'LEFT',
            colStart: 1,
            colSpan: 12,
            text: '作業衣等購入',
          },
        ],
      },
    ]);
  });

  test('labelPosition defaults to TOP for anything other than LEFT, and bordered defaults to false when omitted', () => {
    const page = {
      items: [fieldItem({ labelPosition: 'sideways', bordered: undefined })],
    };
    const record = { shomei: { type: 'SINGLE_LINE_TEXT', value: 'x' } };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].labelPosition).toBe('TOP');
    expect(model.rows[0].cells[0].bordered).toBe(false);
  });

  test('labelPosition LEFT is carried through as-is', () => {
    const page = { items: [fieldItem({ labelPosition: 'LEFT' })] };
    const record = { shomei: { type: 'SINGLE_LINE_TEXT', value: 'x' } };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].labelPosition).toBe('LEFT');
  });

  test('textAlign defaults to LEFT for an invalid/missing value', () => {
    const page = { items: [fieldItem({ textAlign: undefined })] };
    const record = { shomei: { type: 'SINGLE_LINE_TEXT', value: 'x' } };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].textAlign).toBe('LEFT');
  });

  test.each(['CENTER', 'RIGHT'])(
    'textAlign %s is carried through as-is for FIELD and TEXT items',
    (textAlign) => {
      const fieldModel = ReportModel.buildPageModel(
        { items: [fieldItem({ textAlign })] },
        { shomei: { type: 'SINGLE_LINE_TEXT', value: 'x' } },
      );
      expect(fieldModel.rows[0].cells[0].textAlign).toBe(textAlign);

      const textModel = ReportModel.buildPageModel(
        { items: [textItem({ textAlign })] },
        {},
      );
      expect(textModel.rows[0].cells[0].textAlign).toBe(textAlign);
    },
  );

  test.each(['MIDDLE', 'BOTTOM'])(
    'verticalAlign %s is carried through as-is for a TEXT item (ユーザー指示: 任意テキストの上下位置)',
    (verticalAlign) => {
      const model = ReportModel.buildPageModel(
        { items: [textItem({ verticalAlign })] },
        {},
      );
      expect(model.rows[0].cells[0].verticalAlign).toBe(verticalAlign);
    },
  );

  test('an invalid verticalAlign value falls back to TOP', () => {
    const model = ReportModel.buildPageModel(
      { items: [textItem({ verticalAlign: 'not-a-valid-value' })] },
      {},
    );
    expect(model.rows[0].cells[0].verticalAlign).toBe('TOP');
  });

  test('row padding defaults to 0 when page.rowPadding is absent', () => {
    const page = { items: [fieldItem()] };
    const record = { shomei: { type: 'SINGLE_LINE_TEXT', value: 'x' } };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].padding).toBe(0);
  });

  test('row padding is read from page.rowPadding, keyed by row number', () => {
    const page = {
      items: [fieldItem({ row: 1 }), fieldItem({ code: 'other', row: 2 })],
      rowPadding: { 1: 12, 2: 0 },
    };
    const record = {
      shomei: { type: 'SINGLE_LINE_TEXT', value: 'x' },
      other: { type: 'SINGLE_LINE_TEXT', value: 'y' },
    };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].padding).toBe(12);
    expect(model.rows[1].padding).toBe(0);
  });

  test('missing field value in the record formats to an empty string, not a crash', () => {
    const page = { items: [fieldItem({ code: 'missing_field' })] };
    const record = { shomei: { type: 'SINGLE_LINE_TEXT', value: 'x' } };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].text).toBe('');
  });

  test('a numeric FIELD item applies digit grouping and unit via formatNumericValue', () => {
    const page = {
      items: [
        fieldItem({
          code: 'price',
          label: '金額',
          type: 'NUMBER',
          isNumeric: true,
          unit: '円',
          unitPosition: 'AFTER',
          showUnit: true,
          digitGrouping: true,
        }),
      ],
    };
    const record = { price: { type: 'NUMBER', value: '1234567' } };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].text).toBe('1,234,567円');
  });

  test('a numeric FIELD item with showUnit/digitGrouping off returns the raw value', () => {
    const page = {
      items: [
        fieldItem({
          code: 'price',
          type: 'NUMBER',
          isNumeric: true,
          unit: '円',
          unitPosition: 'AFTER',
          showUnit: false,
          digitGrouping: false,
        }),
      ],
    };
    const record = { price: { type: 'NUMBER', value: '1234567' } };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].text).toBe('1234567');
  });

  test('a non-numeric FIELD item ignores isNumeric-only options and uses category formatting', () => {
    const page = { items: [fieldItem()] };
    const record = {
      shomei: { type: 'SINGLE_LINE_TEXT', value: '作業衣等購入' },
    };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].text).toBe('作業衣等購入');
  });

  test('groups multiple items in the same row together, ordered by colStart', () => {
    const page = {
      items: [
        fieldItem({
          code: 'kubun',
          label: '区分',
          row: 2,
          colStart: 7,
          colSpan: 6,
        }),
        fieldItem({
          code: 'shumoku',
          label: '種目',
          row: 2,
          colStart: 1,
          colSpan: 6,
        }),
      ],
    };
    const record = {
      kubun: { type: 'SINGLE_LINE_TEXT', value: '物品・委託等' },
      shumoku: { type: 'SINGLE_LINE_TEXT', value: '繊維・ゴム・皮革製品' },
    };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].row).toBe(2);
    expect(model.rows[0].cells.map((cell) => cell.code)).toEqual([
      'shumoku',
      'kubun',
    ]);
  });

  test('orders rows by row number regardless of item declaration order', () => {
    const page = {
      items: [
        fieldItem({ code: 'b', row: 3 }),
        fieldItem({ code: 'a', row: 1 }),
      ],
    };
    const record = {
      a: { type: 'SINGLE_LINE_TEXT', value: 'A' },
      b: { type: 'SINGLE_LINE_TEXT', value: 'B' },
    };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows.map((row) => row.row)).toEqual([1, 3]);
  });

  test('resolves a TABLE item into per-column display settings and formatted row data', () => {
    const page = { items: [tableItem()] };
    const record = {
      line_items: {
        type: 'SUBTABLE',
        value: [
          {
            value: {
              item_name: { type: 'SINGLE_LINE_TEXT', value: '軍手' },
              qty: { type: 'NUMBER', value: '10' },
            },
          },
          {
            value: {
              item_name: { type: 'SINGLE_LINE_TEXT', value: '安全靴' },
              qty: { type: 'NUMBER', value: '2' },
            },
          },
        ],
      },
    };

    const model = ReportModel.buildPageModel(page, record);
    const tableCell = model.rows[0].cells[0];
    expect(tableCell.kind).toBe('TABLE');
    expect(tableCell.columns).toEqual([
      { label: '品名', textAlign: 'LEFT', fontSizePt: 10, wrap: true },
      { label: '数量', textAlign: 'RIGHT', fontSizePt: 10, wrap: true },
    ]);
    expect(tableCell.rows).toEqual([
      ['軍手', '10'],
      ['安全靴', '2'],
    ]);
  });

  test('a TABLE item with no rows in the record resolves to an empty row list, not a crash', () => {
    const page = { items: [tableItem()] };
    const record = {};

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].rows).toEqual([]);
  });

  test('a numeric TABLE column applies unit and digit grouping just like a FIELD item', () => {
    const page = {
      items: [
        tableItem({
          columns: [
            {
              code: 'qty',
              label: '数量',
              type: 'NUMBER',
              isNumeric: true,
              unit: '個',
              unitPosition: 'AFTER',
              showUnit: true,
              digitGrouping: true,
              fontSizePt: 10,
              wrap: true,
              textAlign: 'RIGHT',
            },
          ],
        }),
      ],
    };
    const record = {
      line_items: {
        type: 'SUBTABLE',
        value: [{ value: { qty: { type: 'NUMBER', value: '12345' } } }],
      },
    };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].rows).toEqual([['12,345個']]);
  });

  test('a numeric TABLE column without showUnit/digitGrouping enabled renders the plain value', () => {
    const page = {
      items: [
        tableItem({
          columns: [
            {
              code: 'qty',
              label: '数量',
              type: 'NUMBER',
              isNumeric: true,
              unit: '個',
              unitPosition: 'AFTER',
              showUnit: false,
              digitGrouping: false,
              fontSizePt: 10,
              wrap: true,
              textAlign: 'RIGHT',
            },
          ],
        }),
      ],
    };
    const record = {
      line_items: {
        type: 'SUBTABLE',
        value: [{ value: { qty: { type: 'NUMBER', value: '12345' } } }],
      },
    };

    const model = ReportModel.buildPageModel(page, record);
    expect(model.rows[0].cells[0].rows).toEqual([['12345']]);
  });
});
