const { composeInsertedValue } = require('../js/lib/insert-composer.js');

describe('composeInsertedValue', () => {
  test('既存値が空の場合、区切り文字を挟まずそのまま設定する', () => {
    expect(
      composeInsertedValue({
        currentValue: '',
        insertText: '追記する内容',
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('追記する内容');
  });

  test('既存値がundefinedの場合も同様に扱う(追加画面での未入力)', () => {
    expect(
      composeInsertedValue({
        currentValue: undefined,
        insertText: '追記する内容',
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('追記する内容');
  });

  test('MULTI_LINE_TEXTは改行区切りで末尾に追記する', () => {
    expect(
      composeInsertedValue({
        currentValue: '既存の内容',
        insertText: '追記する内容',
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('既存の内容\n追記する内容');
  });

  test('RICH_TEXTは<br>区切りで末尾に追記する', () => {
    expect(
      composeInsertedValue({
        currentValue: '<p>既存</p>',
        insertText: '追記',
        targetFieldType: 'RICH_TEXT',
      }),
    ).toBe('<p>既存</p><br>追記');
  });

  test('insertTextが空文字列の場合は既存値をそのまま返す(サブテーブル0件など)', () => {
    expect(
      composeInsertedValue({
        currentValue: '既存の内容',
        insertText: '',
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('既存の内容');
  });

  test('既存値・insertTextともに空の場合は空文字列を返す', () => {
    expect(
      composeInsertedValue({
        currentValue: '',
        insertText: '',
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('');
  });

  test('mode: OVERWRITEの場合、既存値を破棄してinsertTextに置き換える', () => {
    expect(
      composeInsertedValue({
        currentValue: '既存の内容',
        insertText: '新しい内容',
        targetFieldType: 'MULTI_LINE_TEXT',
        mode: 'OVERWRITE',
      }),
    ).toBe('新しい内容');
  });

  test('mode: OVERWRITEでもinsertTextが空文字列の場合は既存値をそのまま返す', () => {
    expect(
      composeInsertedValue({
        currentValue: '既存の内容',
        insertText: '',
        targetFieldType: 'MULTI_LINE_TEXT',
        mode: 'OVERWRITE',
      }),
    ).toBe('既存の内容');
  });

  test('modeを指定しない場合は従来どおりAPPEND(追記)として扱う', () => {
    expect(
      composeInsertedValue({
        currentValue: '既存の内容',
        insertText: '追記する内容',
        targetFieldType: 'MULTI_LINE_TEXT',
      }),
    ).toBe('既存の内容\n追記する内容');
  });
});
