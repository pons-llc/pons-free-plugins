'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const fieldItem = (overrides) => ({
  kind: 'FIELD',
  code: 'shomei',
  label: '件名',
  type: 'SINGLE_LINE_TEXT',
  showLabel: true,
  fontSizePt: 11,
  wrap: true,
  row: 1,
  colStart: 1,
  colSpan: 12,
  ...overrides,
});

const tableItem = (overrides) => ({
  kind: 'TABLE',
  code: 'line_items',
  label: '明細',
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
  ],
  ...overrides,
});

const textItem = (overrides) => ({
  kind: 'TEXT',
  text: '御見積書',
  fontSizePt: 18,
  wrap: true,
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

const baseConfig = () => ({
  outputModes: { individual: true, bulk: false },
  pages: [{ items: [fieldItem()] }],
  images: {},
});

describe('validateConfig', () => {
  test('accepts a minimal valid config', () => {
    expect(ConfigValidation.validateConfig(baseConfig())).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects when neither individual nor bulk output is enabled', () => {
    const config = baseConfig();
    config.outputModes = { individual: false, bulk: false };
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('出力方法')]),
    );
  });

  test('accepts saveToAttachment disabled with no fieldCode selected', () => {
    const config = baseConfig();
    config.saveToAttachment = { enabled: false, fieldCode: '' };
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('accepts saveToAttachment enabled with a fieldCode selected', () => {
    const config = baseConfig();
    config.saveToAttachment = { enabled: true, fieldCode: 'pdf_field' };
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('rejects saveToAttachment enabled with no fieldCode selected', () => {
    const config = baseConfig();
    config.saveToAttachment = { enabled: true, fieldCode: '' };
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('添付ファイル')]),
    );
  });

  test('rejects when there are no pages', () => {
    const config = baseConfig();
    config.pages = [];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('ページ')]),
    );
  });

  test('rejects a page with no items placed on the grid', () => {
    const config = baseConfig();
    config.pages = [{ items: [] }];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
  });

  test.each([0, 13, -1])(
    'rejects colStart out of the 1-12 range (%i)',
    (colStart) => {
      const config = baseConfig();
      config.pages = [{ items: [fieldItem({ colStart, colSpan: 1 })] }];
      expect(ConfigValidation.validateConfig(config).valid).toBe(false);
    },
  );

  test('rejects colStart + colSpan exceeding 12 columns', () => {
    const config = baseConfig();
    config.pages = [{ items: [fieldItem({ colStart: 8, colSpan: 6 })] }];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('12列')]),
    );
  });

  test('rejects two items in the same row whose columns overlap', () => {
    const config = baseConfig();
    config.pages = [
      {
        items: [
          fieldItem({ code: 'a', row: 1, colStart: 1, colSpan: 8 }),
          fieldItem({ code: 'b', row: 1, colStart: 6, colSpan: 6 }),
        ],
      },
    ];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('重なっ')]),
    );
  });

  test('accepts an IMAGE item overlapping a FIELD item in the same row (images can be layered on top)', () => {
    const config = baseConfig();
    config.images = { img_1: 'data:image/png;base64,AAAA' };
    config.pages = [
      {
        items: [
          fieldItem({ code: 'a', row: 1, colStart: 1, colSpan: 8 }),
          imageItem({ row: 1, colStart: 1, colSpan: 3 }),
        ],
      },
    ];
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('accepts two IMAGE items overlapping each other in the same row', () => {
    const config = baseConfig();
    config.images = { img_1: 'data:image/png;base64,AAAA' };
    config.pages = [
      {
        items: [
          imageItem({ row: 1, colStart: 1, colSpan: 3 }),
          imageItem({ row: 1, colStart: 2, colSpan: 3 }),
        ],
      },
    ];
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('accepts two items in the same row that fit side by side without overlapping', () => {
    const config = baseConfig();
    config.pages = [
      {
        items: [
          fieldItem({ code: 'a', row: 1, colStart: 1, colSpan: 6 }),
          fieldItem({ code: 'b', row: 1, colStart: 7, colSpan: 6 }),
        ],
      },
    ];
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('items in different rows never conflict even with the same columns', () => {
    const config = baseConfig();
    config.pages = [
      {
        items: [
          fieldItem({ code: 'a', row: 1, colStart: 1, colSpan: 12 }),
          fieldItem({ code: 'b', row: 2, colStart: 1, colSpan: 12 }),
        ],
      },
    ];
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('rejects a TABLE item with no columns selected', () => {
    const config = baseConfig();
    config.pages = [{ items: [tableItem({ columns: [] })] }];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('列')]),
    );
  });

  test('rejects a font size outside the sane 6-72pt range', () => {
    const config = baseConfig();
    config.pages = [{ items: [fieldItem({ fontSizePt: 200 })] }];
    expect(ConfigValidation.validateConfig(config).valid).toBe(false);
  });

  test('accepts a page combining a full-width field row and a table row', () => {
    const config = baseConfig();
    config.pages = [{ items: [fieldItem(), tableItem()] }];
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('rejects a TABLE column whose font size is outside the sane 6-72pt range', () => {
    const config = baseConfig();
    config.pages = [
      {
        items: [
          tableItem({
            columns: [
              {
                code: 'item_name',
                label: '品名',
                type: 'SINGLE_LINE_TEXT',
                isNumeric: false,
                fontSizePt: 200,
                wrap: true,
                textAlign: 'LEFT',
              },
            ],
          }),
        ],
      },
    ];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('品名')]),
    );
  });

  test('rejects a TEXT item with blank (or whitespace-only) text', () => {
    const config = baseConfig();
    config.pages = [{ items: [textItem({ text: '   ' })] }];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('自由テキスト')]),
    );
  });

  test('accepts a TEXT item with non-blank text', () => {
    const config = baseConfig();
    config.pages = [{ items: [textItem()] }];
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('rejects a row padding outside the 0-100px range', () => {
    const config = baseConfig();
    config.pages = [{ items: [fieldItem()], rowPadding: { 1: 500 } }];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('余白')]),
    );
  });

  test('accepts a row padding within range, and no rowPadding at all', () => {
    const config = baseConfig();
    config.pages = [{ items: [fieldItem()], rowPadding: { 1: 20 } }];
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);

    const configNoPadding = baseConfig();
    expect(ConfigValidation.validateConfig(configNoPadding).valid).toBe(true);
  });

  test('accepts an IMAGE item referencing an existing image (no fontSizePt required)', () => {
    const config = baseConfig();
    config.images = { img_1: 'data:image/png;base64,AAAA' };
    config.pages = [{ items: [imageItem({ imageId: 'img_1' })] }];
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('rejects an IMAGE item with no imageId set', () => {
    const config = baseConfig();
    config.pages = [{ items: [imageItem({ imageId: '' })] }];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('画像')]),
    );
  });

  test('rejects an IMAGE item whose imageId has no matching entry in config.images', () => {
    const config = baseConfig();
    config.images = {};
    config.pages = [{ items: [imageItem({ imageId: 'missing_id' })] }];
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('画像')]),
    );
  });

  test('rejects when the total serialized config size exceeds the safety budget', () => {
    const config = baseConfig();
    // 1文字1バイトのASCII(base64相当)を大量に詰めて、安全上限(約200,000文字相当)を超えさせる。
    config.images = { img_1: 'A'.repeat(250000) };
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('サイズ')]),
    );
  });

  test('accepts a config with a modestly-sized image well under the budget', () => {
    const config = baseConfig();
    config.images = { img_1: `data:image/png;base64,${'A'.repeat(1000)}` };
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });
});
