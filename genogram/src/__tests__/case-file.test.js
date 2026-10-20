'use strict';

const Model = require('../js/lib/model');
const CaseFile = require('../js/lib/case-file');

const sample = () =>
  Model.normalize({
    persons: [{ id: 'a', name: '佐藤 美咲', gender: 'female', isClient: true }],
    memos: [{ id: 'm', targetId: 'a', text: '初回面談' }],
  });

describe('serialize / parse(ケースファイル)', () => {
  test('ケース名・保存日時と一緒に書き出し、読み込むと同じモデルに戻る', () => {
    const text = CaseFile.serialize(sample(), {
      caseName: '佐藤 美咲さん',
      savedAt: '2026-10-20T03:00:00.000Z',
    });
    const json = JSON.parse(text);
    expect(json.format).toBe(CaseFile.FORMAT);
    expect(json.version).toBe(1);
    expect(json.caseName).toBe('佐藤 美咲さん');
    expect(json.savedAt).toBe('2026-10-20T03:00:00.000Z');

    const result = CaseFile.parse(text);
    expect(result.ok).toBe(true);
    expect(result.caseName).toBe('佐藤 美咲さん');
    expect(result.model).toEqual(sample());
  });

  test('kintoneのフィールドの値(モデルのJSONそのもの)も読み込める', () => {
    const result = CaseFile.parse(Model.serialize(sample()));
    expect(result.ok).toBe(true);
    expect(result.caseName).toBe('');
    expect(result.model.persons[0].name).toBe('佐藤 美咲');
  });

  test('読み込み時も正規化する(壊れた参照は捨てる)', () => {
    const text = JSON.stringify({
      format: CaseFile.FORMAT,
      version: 1,
      caseName: 'x',
      genogram: {
        persons: [{ id: 'a' }],
        unions: [{ id: 'u', a: 'a', b: 'nobody' }],
      },
    });
    const result = CaseFile.parse(text);
    expect(result.ok).toBe(true);
    expect(result.model.unions).toEqual([]);
  });

  test('JSONでない・ジェノグラムのデータでないファイルはok:false', () => {
    ['', 'abc', '[]', '{"foo": 1}', '{"format": "other"}'].forEach((text) => {
      const result = CaseFile.parse(text);
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  test('ケース名は文字列以外なら空、長すぎれば切り詰める', () => {
    const base = { format: CaseFile.FORMAT, version: 1, genogram: {} };
    expect(CaseFile.parse(JSON.stringify({ ...base, caseName: 5 })).caseName).toBe('');
    expect(
      CaseFile.parse(JSON.stringify({ ...base, caseName: 'あ'.repeat(500) }))
        .caseName.length,
    ).toBe(CaseFile.CASE_NAME_MAX);
  });
});

describe('fileName', () => {
  const date = new Date(2026, 9, 5, 12, 0);

  test('ケース名_日付.json(ローカル日付)', () => {
    expect(CaseFile.fileName('佐藤 美咲さん', date)).toBe(
      '佐藤 美咲さん_20261005.json',
    );
  });

  test('ファイル名に使えない文字は _ に置き換え、空なら「ジェノグラム」', () => {
    expect(CaseFile.fileName('a/b\\c:d*e?f"g<h>i|j', date)).toBe(
      'a_b_c_d_e_f_g_h_i_j_20261005.json',
    );
    expect(CaseFile.fileName('   ', date)).toBe('ジェノグラム_20261005.json');
  });

  test('拡張子を変えられる(画像用)', () => {
    expect(CaseFile.fileName('ケース', date, 'png')).toBe('ケース_20261005.png');
  });
});
