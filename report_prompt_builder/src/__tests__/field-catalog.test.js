'use strict';

const FieldCatalog = require('../js/lib/field-catalog');

describe('categoryForType', () => {
  test.each([
    ['SINGLE_LINE_TEXT', 'TEXT'],
    ['MULTI_LINE_TEXT', 'TEXT'],
    ['RICH_TEXT', 'TEXT'],
    ['LINK', 'TEXT'],
    ['CALC', 'TEXT'],
    ['RECORD_NUMBER', 'TEXT'],
    ['STATUS', 'TEXT'],
    ['STATUS_ASSIGNEE', 'TEXT'],
    ['CATEGORY', 'TEXT'],
    ['NUMBER', 'NUMBER'],
    ['DATE', 'DATE'],
    ['DATETIME', 'DATETIME'],
    ['CREATED_TIME', 'DATETIME'],
    ['UPDATED_TIME', 'DATETIME'],
    ['TIME', 'TIME'],
    ['DROP_DOWN', 'CHOICE'],
    ['RADIO_BUTTON', 'CHOICE'],
    ['CHECK_BOX', 'MULTI_CHOICE'],
    ['MULTI_SELECT', 'MULTI_CHOICE'],
    ['USER_SELECT', 'ENTITY'],
    ['ORGANIZATION_SELECT', 'ENTITY'],
    ['GROUP_SELECT', 'ENTITY'],
    ['CREATOR', 'ENTITY'],
    ['MODIFIER', 'ENTITY'],
  ])('%s -> %s', (type, expected) => {
    expect(FieldCatalog.categoryForType(type)).toBe(expected);
  });

  test.each(['SUBTABLE', 'REFERENCE_TABLE', 'FILE', 'GROUP', 'UNKNOWN_TYPE'])(
    '%s -> null (not selectable as a report value)',
    (type) => {
      expect(FieldCatalog.categoryForType(type)).toBeNull();
    },
  );
});

describe('isSelectableField / isSubtableField', () => {
  test('a normal value field is selectable', () => {
    expect(FieldCatalog.isSelectableField({ type: 'SINGLE_LINE_TEXT' })).toBe(
      true,
    );
  });

  test.each(['SUBTABLE', 'REFERENCE_TABLE', 'FILE', 'GROUP'])(
    '%s is not selectable',
    (type) => {
      expect(FieldCatalog.isSelectableField({ type })).toBe(false);
    },
  );

  test('SUBTABLE is recognized as a table field', () => {
    expect(FieldCatalog.isSubtableField({ type: 'SUBTABLE' })).toBe(true);
    expect(FieldCatalog.isSubtableField({ type: 'SINGLE_LINE_TEXT' })).toBe(
      false,
    );
  });
});

describe('isNumericField', () => {
  test('NUMBER type is numeric', () => {
    expect(FieldCatalog.isNumericField({ type: 'NUMBER' })).toBe(true);
  });

  test.each(['NUMBER', 'NUMBER_DIGIT'])(
    'CALC with format %s is numeric',
    (format) => {
      expect(FieldCatalog.isNumericField({ type: 'CALC', format })).toBe(true);
    },
  );

  test.each([
    'DATE',
    'DATETIME',
    'TIME',
    'HOUR_MINUTE',
    'DAY_HOUR_MINUTE',
    undefined,
  ])('CALC with format %s is not numeric', (format) => {
    expect(FieldCatalog.isNumericField({ type: 'CALC', format })).toBe(false);
  });

  test('non-NUMBER/CALC types are not numeric', () => {
    expect(FieldCatalog.isNumericField({ type: 'SINGLE_LINE_TEXT' })).toBe(
      false,
    );
  });
});

describe('listSelectableFields', () => {
  test('filters out table/unsupported fields and marks non-numeric fields', () => {
    const formFields = {
      customer_name: {
        code: 'customer_name',
        label: '取引先名',
        type: 'SINGLE_LINE_TEXT',
      },
      line_items: {
        code: 'line_items',
        label: '明細',
        type: 'SUBTABLE',
        fields: {},
      },
      attachment: { code: 'attachment', label: '添付', type: 'FILE' },
    };

    expect(FieldCatalog.listSelectableFields(formFields)).toEqual([
      {
        code: 'customer_name',
        label: '取引先名',
        type: 'SINGLE_LINE_TEXT',
        isNumeric: false,
      },
    ]);
  });

  test('a NUMBER field carries unit/unitPosition/digit through for later formatting', () => {
    const formFields = {
      price: {
        code: 'price',
        label: '金額',
        type: 'NUMBER',
        unit: '円',
        unitPosition: 'AFTER',
        digit: true,
      },
    };

    expect(FieldCatalog.listSelectableFields(formFields)).toEqual([
      {
        code: 'price',
        label: '金額',
        type: 'NUMBER',
        isNumeric: true,
        unit: '円',
        unitPosition: 'AFTER',
        digit: true,
      },
    ]);
  });

  test('a NUMBER field with no unit/digit configured defaults to empty unit, AFTER position, digit off', () => {
    const formFields = {
      qty: { code: 'qty', label: '数量', type: 'NUMBER' },
    };

    expect(FieldCatalog.listSelectableFields(formFields)).toEqual([
      {
        code: 'qty',
        label: '数量',
        type: 'NUMBER',
        isNumeric: true,
        unit: '',
        unitPosition: 'AFTER',
        digit: false,
      },
    ]);
  });

  test('a numeric CALC field is also marked isNumeric with unit metadata', () => {
    const formFields = {
      total: {
        code: 'total',
        label: '合計',
        type: 'CALC',
        format: 'NUMBER_DIGIT',
        unit: '円',
        unitPosition: 'AFTER',
      },
    };

    const [result] = FieldCatalog.listSelectableFields(formFields);
    expect(result.isNumeric).toBe(true);
    expect(result.unit).toBe('円');
  });
});

describe('listTableFields', () => {
  test('extracts SUBTABLE fields with their selectable inner columns', () => {
    const formFields = {
      line_items: {
        code: 'line_items',
        label: '明細',
        type: 'SUBTABLE',
        fields: {
          item_name: {
            code: 'item_name',
            label: '品名',
            type: 'SINGLE_LINE_TEXT',
          },
          qty: { code: 'qty', label: '数量', type: 'NUMBER' },
        },
      },
      customer_name: {
        code: 'customer_name',
        label: '取引先名',
        type: 'SINGLE_LINE_TEXT',
      },
    };

    expect(FieldCatalog.listTableFields(formFields)).toEqual([
      {
        code: 'line_items',
        label: '明細',
        columns: [
          {
            code: 'item_name',
            label: '品名',
            type: 'SINGLE_LINE_TEXT',
            isNumeric: false,
          },
          {
            code: 'qty',
            label: '数量',
            type: 'NUMBER',
            isNumeric: true,
            unit: '',
            unitPosition: 'AFTER',
            digit: false,
          },
        ],
      },
    ]);
  });
});

describe('listFileFields', () => {
  test('extracts FILE fields only, ignoring other selectable/table fields', () => {
    const formFields = {
      seal_image: {
        code: 'seal_image',
        label: '押印済みPDF',
        type: 'FILE',
      },
      customer_name: {
        code: 'customer_name',
        label: '取引先名',
        type: 'SINGLE_LINE_TEXT',
      },
      line_items: {
        code: 'line_items',
        label: '明細',
        type: 'SUBTABLE',
        fields: {},
      },
    };

    expect(FieldCatalog.listFileFields(formFields)).toEqual([
      { code: 'seal_image', label: '押印済みPDF' },
    ]);
  });

  test('returns an empty array when the app has no FILE field', () => {
    const formFields = {
      customer_name: {
        code: 'customer_name',
        label: '取引先名',
        type: 'SINGLE_LINE_TEXT',
      },
    };

    expect(FieldCatalog.listFileFields(formFields)).toEqual([]);
  });
});
