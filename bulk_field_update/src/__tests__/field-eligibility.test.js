'use strict';

const {
  isEligibleField,
  collectLookupCopyDestinationCodes,
  listEligibleFields,
  inputKindOf,
} = require('../js/lib/field-eligibility');

describe('isEligibleField', () => {
  test('文字列(1行)は対象', () => {
    expect(isEligibleField({ type: 'SINGLE_LINE_TEXT', code: 'text1' })).toBe(
      true,
    );
  });

  test.each([
    'RECORD_NUMBER',
    'CREATOR',
    'CREATED_TIME',
    'MODIFIER',
    'UPDATED_TIME',
    'CALC',
    'CATEGORY',
    'STATUS',
    'STATUS_ASSIGNEE',
    'REFERENCE_TABLE',
    'GROUP',
    'SUBTABLE',
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
    'FILE',
  ])('%sは対象外', (type) => {
    expect(isEligibleField({ type, code: 'f' })).toBe(false);
  });

  test('lookupが設定されているフィールド(ルックアップフィールド自体)は対象外', () => {
    expect(
      isEligibleField({
        type: 'SINGLE_LINE_TEXT',
        code: 'lookup1',
        lookup: { relatedApp: { app: '1' } },
      }),
    ).toBe(false);
  });

  test('フィールド定義が無い/コード無しの場合は対象外', () => {
    expect(isEligibleField(null)).toBe(false);
    expect(isEligibleField(undefined)).toBe(false);
    expect(isEligibleField({ type: 'SINGLE_LINE_TEXT' })).toBe(false);
  });
});

describe('listEligibleFields', () => {
  test('対象外フィールドを除いた配列を返す', () => {
    const formFields = {
      text1: { type: 'SINGLE_LINE_TEXT', code: 'text1' },
      recordNum: { type: 'RECORD_NUMBER', code: 'recordNum' },
      table1: { type: 'SUBTABLE', code: 'table1' },
      user1: { type: 'USER_SELECT', code: 'user1' },
    };
    const result = listEligibleFields(formFields);
    expect(result.map((f) => f.code)).toEqual(['text1']);
  });

  test('ルックアップフィールドの「ほかのフィールドのコピー」のコピー先フィールドも対象外にする', () => {
    const formFields = {
      lookup1: {
        type: 'SINGLE_LINE_TEXT',
        code: 'lookup1',
        lookup: {
          relatedApp: { app: '1' },
          fieldMappings: [
            { field: 'copyDest1', relatedField: 'sourceField1' },
            { field: 'copyDest2', relatedField: 'sourceField2' },
          ],
        },
      },
      copyDest1: { type: 'SINGLE_LINE_TEXT', code: 'copyDest1' },
      copyDest2: { type: 'NUMBER', code: 'copyDest2' },
      unrelated1: { type: 'SINGLE_LINE_TEXT', code: 'unrelated1' },
    };
    const result = listEligibleFields(formFields);
    expect(result.map((f) => f.code)).toEqual(['unrelated1']);
  });

  test('formFieldsが無い場合は空配列', () => {
    expect(listEligibleFields(null)).toEqual([]);
    expect(listEligibleFields(undefined)).toEqual([]);
  });
});

describe('collectLookupCopyDestinationCodes', () => {
  test('ルックアップフィールドのfieldMappingsからコピー先フィールドコードを集める', () => {
    const formFields = {
      lookup1: {
        type: 'SINGLE_LINE_TEXT',
        code: 'lookup1',
        lookup: {
          fieldMappings: [
            { field: 'copyDest1', relatedField: 'sourceField1' },
            { field: 'copyDest2', relatedField: 'sourceField2' },
          ],
        },
      },
      normal1: { type: 'SINGLE_LINE_TEXT', code: 'normal1' },
    };
    const codes = collectLookupCopyDestinationCodes(formFields);
    expect(codes).toEqual(new Set(['copyDest1', 'copyDest2']));
  });

  test('ルックアップフィールドが無い場合は空集合', () => {
    const formFields = {
      normal1: { type: 'SINGLE_LINE_TEXT', code: 'normal1' },
    };
    expect(collectLookupCopyDestinationCodes(formFields)).toEqual(new Set());
  });

  test('fieldMappingsが未設定のルックアップフィールドがあっても例外を投げない', () => {
    const formFields = {
      lookup1: {
        type: 'SINGLE_LINE_TEXT',
        code: 'lookup1',
        lookup: { relatedApp: { app: '1' } },
      },
    };
    expect(collectLookupCopyDestinationCodes(formFields)).toEqual(new Set());
  });

  test('formFieldsが無い場合は空集合', () => {
    expect(collectLookupCopyDestinationCodes(null)).toEqual(new Set());
    expect(collectLookupCopyDestinationCodes(undefined)).toEqual(new Set());
  });
});

describe('inputKindOf', () => {
  test('ラジオボタン・ドロップダウンはSINGLE_CHOICE', () => {
    expect(inputKindOf('RADIO_BUTTON')).toBe('SINGLE_CHOICE');
    expect(inputKindOf('DROP_DOWN')).toBe('SINGLE_CHOICE');
  });

  test('チェックボックス・複数選択はMULTI_CHOICE', () => {
    expect(inputKindOf('CHECK_BOX')).toBe('MULTI_CHOICE');
    expect(inputKindOf('MULTI_SELECT')).toBe('MULTI_CHOICE');
  });

  test('日付・時刻・日時はそれぞれ専用の種類', () => {
    expect(inputKindOf('DATE')).toBe('DATE');
    expect(inputKindOf('TIME')).toBe('TIME');
    expect(inputKindOf('DATETIME')).toBe('DATETIME');
  });

  test('数値はNUMBER', () => {
    expect(inputKindOf('NUMBER')).toBe('NUMBER');
  });

  test('複数行文字列・リッチエディターはTEXTAREA', () => {
    expect(inputKindOf('MULTI_LINE_TEXT')).toBe('TEXTAREA');
    expect(inputKindOf('RICH_TEXT')).toBe('TEXTAREA');
  });

  test('それ以外(文字列1行・リンク等)はTEXT', () => {
    expect(inputKindOf('SINGLE_LINE_TEXT')).toBe('TEXT');
    expect(inputKindOf('LINK')).toBe('TEXT');
  });
});
