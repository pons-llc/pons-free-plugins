'use strict';

const FieldHighlight = require('../js/lib/field-highlight');

const BOTH = {
  content: { borderColor: '#e74c3c' },
  label: { color: '#c0392b', fontWeight: 'bold' },
};
const LABEL_ONLY = { label: { color: '#c0392b', fontWeight: 'bold' } };

describe('highlightStyle(未解決の指摘があるフィールドの強調。setFieldStyle用)', () => {
  test('通常のフィールドは枠線(content)とフィールド名(label)を強調する', () => {
    expect(FieldHighlight.highlightStyle({ type: 'SINGLE_LINE_TEXT' }, 'detail')).toEqual(BOTH);
    expect(FieldHighlight.highlightStyle({ type: 'NUMBER' }, 'edit')).toEqual(BOTH);
  });

  test('setFieldStyle非対応のフィールド(テーブル・関連レコード一覧など)はnull', () => {
    ['SUBTABLE', 'REFERENCE_TABLE', 'GROUP', 'STATUS', 'STATUS_ASSIGNEE'].forEach((type) => {
      expect(FieldHighlight.highlightStyle({ type }, 'detail')).toBeNull();
    });
    expect(FieldHighlight.highlightStyle(undefined, 'detail')).toBeNull();
  });

  test('詳細画面ではリッチエディターのcontentが非対応なのでフィールド名のみ', () => {
    expect(FieldHighlight.highlightStyle({ type: 'RICH_TEXT' }, 'detail')).toEqual(LABEL_ONLY);
  });

  test('追加・編集画面ではリッチエディター・計算・自動計算の文字列(1行)がフィールド名のみ', () => {
    expect(FieldHighlight.highlightStyle({ type: 'RICH_TEXT' }, 'edit')).toEqual(LABEL_ONLY);
    expect(FieldHighlight.highlightStyle({ type: 'CALC' }, 'edit')).toEqual(LABEL_ONLY);
    expect(
      FieldHighlight.highlightStyle({ type: 'SINGLE_LINE_TEXT', expression: '数値*2' }, 'edit'),
    ).toEqual(LABEL_ONLY);
    // 詳細画面では計算フィールドも枠線を付けられる。
    expect(FieldHighlight.highlightStyle({ type: 'CALC' }, 'detail')).toEqual(BOTH);
  });
});

describe('unresolvedFieldCodes', () => {
  test('未解決の指摘があるフィールド(行単位の指摘はテーブル)のコードを重複なく返す', () => {
    const items = [
      { targetCode: '件名', resolved: false },
      { targetCode: '件名', resolved: false },
      { targetCode: '金額', resolved: true },
      { targetCode: '明細', targetRowId: '3', resolved: false },
    ];
    expect(FieldHighlight.unresolvedFieldCodes(items)).toEqual(['件名', '明細']);
  });
});
