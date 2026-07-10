const {
  renderFileName,
  buildFileName,
  dedupeFileNames,
} = require('../js/lib/filename-template');

describe('renderFileName', () => {
  test('{フィールドコード}のプレースホルダーを値へ置換する', () => {
    expect(
      renderFileName('{customer_name}_請求書', {
        customer_name: '株式会社サンプル',
      }),
    ).toBe('株式会社サンプル_請求書');
  });

  test('複数のプレースホルダーを置換できる', () => {
    expect(
      renderFileName('{customer_name}_{invoice_date}', {
        customer_name: 'サンプル',
        invoice_date: '2026-07-09',
      }),
    ).toBe('サンプル_2026-07-09');
  });

  test('値が存在しないプレースホルダーは空文字列に置換する', () => {
    expect(renderFileName('{unknown}_請求書', {})).toBe('_請求書');
  });

  test('プレースホルダーがないテンプレートはそのまま返す', () => {
    expect(renderFileName('固定ファイル名', { a: '1' })).toBe('固定ファイル名');
  });
});

describe('buildFileName: サニタイズと拡張子付与', () => {
  test('Windows/macOSで使用できない文字を除去する', () => {
    const result = buildFileName('{name}', { name: 'A/B\\C:D*E?F"G<H>I|J' });
    expect(result).toBe('ABCDEFGHIJ.xlsx');
  });

  test('.xlsx拡張子が付いていなければ付与する', () => {
    expect(buildFileName('請求書_{n}', { n: '1' })).toBe('請求書_1.xlsx');
  });

  test('既に.xlsxが付いていれば二重に付与しない(大文字小文字を無視)', () => {
    expect(buildFileName('請求書.xlsx', {})).toBe('請求書.xlsx');
    expect(buildFileName('請求書.XLSX', {})).toBe('請求書.XLSX');
  });

  test('前後の空白・ドットを取り除く', () => {
    expect(buildFileName('  . 請求書 .  ', {})).toBe('請求書.xlsx');
  });

  test('サニタイズ結果が空文字列になる場合はデフォルト名にフォールバックする', () => {
    expect(buildFileName('///', {})).toBe('record.xlsx');
  });

  test('長すぎるファイル名は切り詰める', () => {
    const longName = 'あ'.repeat(300);
    const result = buildFileName(longName, {});
    // 拡張子込みで200文字以内に収める
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('.xlsx')).toBe(true);
  });
});

describe('dedupeFileNames: 同名衝突の解消', () => {
  test('重複がなければそのまま返す', () => {
    expect(dedupeFileNames(['a.xlsx', 'b.xlsx'])).toEqual(['a.xlsx', 'b.xlsx']);
  });

  test('重複するファイル名には連番を付与する', () => {
    expect(dedupeFileNames(['a.xlsx', 'a.xlsx', 'a.xlsx'])).toEqual([
      'a.xlsx',
      'a(2).xlsx',
      'a(3).xlsx',
    ]);
  });

  test('拡張子がないファイル名にも対応する', () => {
    expect(dedupeFileNames(['a', 'a'])).toEqual(['a', 'a(2)']);
  });

  test('複数グループの重複をそれぞれ独立して連番付与する', () => {
    expect(dedupeFileNames(['a.xlsx', 'b.xlsx', 'a.xlsx', 'b.xlsx'])).toEqual([
      'a.xlsx',
      'b.xlsx',
      'a(2).xlsx',
      'b(2).xlsx',
    ]);
  });
});
