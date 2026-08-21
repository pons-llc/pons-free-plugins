'use strict';

const ConfigStore = require('../js/lib/config-store');

const samplePages = () => [
  {
    items: [
      {
        kind: 'FIELD',
        code: 'shomei',
        label: '件名',
        type: 'SINGLE_LINE_TEXT',
        showLabel: true,
        fontSizePt: 14,
        wrap: true,
        row: 1,
        colStart: 1,
        colSpan: 12,
      },
      {
        kind: 'TABLE',
        code: 'line_items',
        label: '明細',
        fontSizePt: 10,
        wrap: false,
        row: 2,
        colStart: 1,
        colSpan: 12,
        columns: [
          { code: 'item_name', label: '品名', type: 'SINGLE_LINE_TEXT' },
        ],
      },
    ],
    rowPadding: { 1: 8 },
  },
];

describe('load', () => {
  test('returns defaults when nothing is saved yet (getConfig() returns null)', () => {
    expect(ConfigStore.load(null)).toEqual({
      outputModes: { individual: true, bulk: false },
      pages: [],
      images: {},
      saveToAttachment: {
        enabled: false,
        fieldCode: '',
        fileNamePrefix: '帳票',
      },
    });
  });

  test('parses a previously saved config back into an object', () => {
    const saved = {
      outputModes: JSON.stringify({ individual: false, bulk: true }),
      pages: JSON.stringify(samplePages()),
      saveToAttachment: JSON.stringify({ enabled: true, fieldCode: 'pdf' }),
    };

    expect(ConfigStore.load(saved)).toEqual({
      outputModes: { individual: false, bulk: true },
      pages: samplePages(),
      images: {},
      saveToAttachment: { enabled: true, fieldCode: 'pdf' },
    });
  });

  test('falls back to defaults for individual keys with malformed JSON', () => {
    expect(
      ConfigStore.load({
        outputModes: 'not json',
        pages: 'also not json',
        saveToAttachment: 'not json either',
      }),
    ).toEqual({
      outputModes: { individual: true, bulk: false },
      pages: [],
      images: {},
      saveToAttachment: {
        enabled: false,
        fieldCode: '',
        fileNamePrefix: '帳票',
      },
    });
  });

  test('collects image_-prefixed keys into an images map, keyed by the id after the prefix', () => {
    const saved = {
      image_img_1: 'data:image/png;base64,AAAA',
      image_img_2: 'data:image/jpeg;base64,BBBB',
      outputModes: JSON.stringify({ individual: true, bulk: false }),
    };

    expect(ConfigStore.load(saved).images).toEqual({
      img_1: 'data:image/png;base64,AAAA',
      img_2: 'data:image/jpeg;base64,BBBB',
    });
  });

  test('ignores non-image_-prefixed keys when building the images map', () => {
    const saved = {
      pages: JSON.stringify(samplePages()),
      outputModes: JSON.stringify({ individual: true, bulk: false }),
    };

    expect(ConfigStore.load(saved).images).toEqual({});
  });

  test('normalizes pages saved under the old (pre-grid) schema instead of crashing later', () => {
    // 旧AIプロンプト版はpageが{pageSize,orientation,fields,tables}という形で、itemsを持たない。
    const saved = {
      outputModes: JSON.stringify({ individual: true, bulk: false }),
      pages: JSON.stringify([
        { pageSize: 'A4', orientation: 'PORTRAIT', fields: [], tables: [] },
      ]),
    };

    expect(ConfigStore.load(saved).pages).toEqual([
      { items: [], rowPadding: {} },
    ]);
  });

  test('normalizes a page whose items is missing or not an array', () => {
    const saved = {
      pages: JSON.stringify([{}, { items: 'not-an-array' }, null]),
    };

    expect(ConfigStore.load(saved).pages).toEqual([
      { items: [], rowPadding: {} },
      { items: [], rowPadding: {} },
      { items: [], rowPadding: {} },
    ]);
  });

  test('normalizes rowPadding that is missing or not an object', () => {
    const saved = {
      pages: JSON.stringify([
        { items: [] },
        { items: [], rowPadding: 'not-an-object' },
        { items: [], rowPadding: [1, 2] },
      ]),
    };

    // 配列(typeof 'object')はrowPaddingとして無効なため空オブジェクトに正規化される。
    const result = ConfigStore.load(saved).pages;
    expect(result[0].rowPadding).toEqual({});
    expect(result[1].rowPadding).toEqual({});
    expect(result[2].rowPadding).toEqual({});
  });

  test('preserves a valid rowPadding object as-is', () => {
    const saved = {
      pages: JSON.stringify([{ items: [], rowPadding: { 2: 16 } }]),
    };

    expect(ConfigStore.load(saved).pages[0].rowPadding).toEqual({ 2: 16 });
  });
});

describe('serialize', () => {
  test('stringifies both outputModes and pages', () => {
    const config = {
      outputModes: { individual: true, bulk: true },
      pages: samplePages(),
      images: {},
    };

    const serialized = ConfigStore.serialize(config);

    expect(JSON.parse(serialized.outputModes)).toEqual({
      individual: true,
      bulk: true,
    });
    expect(JSON.parse(serialized.pages)).toEqual(config.pages);
  });

  test('flattens each image into its own image_-prefixed key, as a plain (non-JSON) string', () => {
    const config = {
      outputModes: { individual: true, bulk: false },
      pages: [],
      images: {
        img_1: 'data:image/png;base64,AAAA',
        img_2: 'data:image/jpeg;base64,BBBB',
      },
    };

    const serialized = ConfigStore.serialize(config);

    expect(serialized.image_img_1).toBe('data:image/png;base64,AAAA');
    expect(serialized.image_img_2).toBe('data:image/jpeg;base64,BBBB');
  });

  test('round-trips images through serialize -> load unchanged', () => {
    const config = {
      outputModes: { individual: true, bulk: false },
      pages: [],
      images: { img_1: 'data:image/png;base64,AAAA' },
    };

    const roundTripped = ConfigStore.load(ConfigStore.serialize(config));
    expect(roundTripped.images).toEqual(config.images);
  });

  test('round-trips saveToAttachment through serialize -> load unchanged', () => {
    const config = {
      outputModes: { individual: true, bulk: false },
      pages: [],
      images: {},
      saveToAttachment: { enabled: true, fieldCode: 'pdf_field' },
    };

    const roundTripped = ConfigStore.load(ConfigStore.serialize(config));
    expect(roundTripped.saveToAttachment).toEqual(config.saveToAttachment);
  });

  test('defaults saveToAttachment to disabled when omitted from config', () => {
    const config = {
      outputModes: { individual: true, bulk: false },
      pages: [],
      images: {},
    };

    const roundTripped = ConfigStore.load(ConfigStore.serialize(config));
    expect(roundTripped.saveToAttachment).toEqual({
      enabled: false,
      fieldCode: '',
      fileNamePrefix: '帳票',
    });
  });
});
