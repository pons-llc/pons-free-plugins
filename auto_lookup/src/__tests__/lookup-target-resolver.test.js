'use strict';

const LookupTargetResolver = require('../js/lib/lookup-target-resolver');

const formFields = {
  lookup_customer: {
    type: 'SINGLE_LINE_TEXT',
    code: 'lookup_customer',
    lookup: { relatedApp: {} },
  },
  plain_text: { type: 'SINGLE_LINE_TEXT', code: 'plain_text' },
  history: {
    type: 'SUBTABLE',
    code: 'history',
    fields: {
      lookup_item: {
        type: 'SINGLE_LINE_TEXT',
        code: 'lookup_item',
        lookup: { relatedApp: {} },
      },
      note: { type: 'SINGLE_LINE_TEXT', code: 'note' },
    },
  },
  plain_table: {
    type: 'SUBTABLE',
    code: 'plain_table',
    fields: {
      note: { type: 'SINGLE_LINE_TEXT', code: 'note' },
    },
  },
};

describe('LookupTargetResolver.resolveLookupTargets', () => {
  test('resolves a plain lookup field to a FIELD target', () => {
    const targets = LookupTargetResolver.resolveLookupTargets(
      ['lookup_customer'],
      formFields,
    );
    expect(targets).toEqual([{ kind: 'FIELD', fieldCode: 'lookup_customer' }]);
  });

  test('ignores a selected field that is not actually a lookup field', () => {
    const targets = LookupTargetResolver.resolveLookupTargets(
      ['plain_text'],
      formFields,
    );
    expect(targets).toEqual([]);
  });

  test('resolves a subtable field to a SUBTABLE_COLUMN target for each lookup column inside it', () => {
    const targets = LookupTargetResolver.resolveLookupTargets(
      ['history'],
      formFields,
    );
    expect(targets).toEqual([
      {
        kind: 'SUBTABLE_COLUMN',
        subtableFieldCode: 'history',
        columnCode: 'lookup_item',
      },
    ]);
  });

  test('resolves to no targets when the subtable has no lookup columns', () => {
    const targets = LookupTargetResolver.resolveLookupTargets(
      ['plain_table'],
      formFields,
    );
    expect(targets).toEqual([]);
  });

  test('ignores a target field code that does not exist in the form fields', () => {
    const targets = LookupTargetResolver.resolveLookupTargets(
      ['not_exist'],
      formFields,
    );
    expect(targets).toEqual([]);
  });

  test('resolves multiple selected target field codes together', () => {
    const targets = LookupTargetResolver.resolveLookupTargets(
      ['lookup_customer', 'history'],
      formFields,
    );
    expect(targets).toEqual([
      { kind: 'FIELD', fieldCode: 'lookup_customer' },
      {
        kind: 'SUBTABLE_COLUMN',
        subtableFieldCode: 'history',
        columnCode: 'lookup_item',
      },
    ]);
  });

  test('returns an empty array when targetFieldCodes is empty', () => {
    expect(LookupTargetResolver.resolveLookupTargets([], formFields)).toEqual(
      [],
    );
  });
});
