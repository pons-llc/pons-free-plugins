const Csv = require('../js/lib/csv');

const result = () => ({
  runId: 'run-1',
  labels: { submitted: '提出済', unsubmitted: '未提出' },
  targets: [
    { appId: '571', label: '面談' },
    { appId: '572', label: '教室' },
  ],
  rows: [
    {
      key: 'A-001',
      name: '山田花子',
      targets: [
        { submitted: true, count: 1, lastDate: '2026-05-01' },
        { submitted: false, count: 0, lastDate: null },
      ],
    },
  ],
});

describe('escapeCell', () => {
  test('普通の値はそのまま', () => {
    expect(Csv.escapeCell('山田花子')).toBe('山田花子');
    expect(Csv.escapeCell(123)).toBe('123');
  });

  test('null/undefinedは空文字', () => {
    expect(Csv.escapeCell(null)).toBe('');
    expect(Csv.escapeCell(undefined)).toBe('');
  });

  test('カンマ・改行を含む値は引用符で囲む', () => {
    expect(Csv.escapeCell('山田, 花子')).toBe('"山田, 花子"');
    expect(Csv.escapeCell('1行目\n2行目')).toBe('"1行目\n2行目"');
  });

  test('ダブルクォートは2つ重ねる', () => {
    expect(Csv.escapeCell('彼女は"花子"です')).toBe('"彼女は""花子""です"');
  });

  test('数式として解釈されうる値はシングルクォートで無害化する(CSVインジェクション対策)', () => {
    expect(Csv.escapeCell('=1+1')).toBe("'=1+1");
    expect(Csv.escapeCell('+15550000')).toBe("'+15550000");
    expect(Csv.escapeCell('-1')).toBe("'-1");
    expect(Csv.escapeCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  test('無害化した値がカンマを含むなら引用符も付く', () => {
    expect(Csv.escapeCell('=CMD|"calc"!A1')).toBe('"\'=CMD|""calc""!A1"');
  });
});

describe('buildCsv', () => {
  test('対象アプリごとに 状況/件数/最終提出日 の3列を並べる', () => {
    const lines = Csv.buildCsv(result()).split('\r\n');
    expect(lines[0]).toBe(
      '突合キー,氏名,面談_状況,面談_件数,面談_最終提出日,教室_状況,教室_件数,教室_最終提出日',
    );
    expect(lines[1]).toBe('A-001,山田花子,提出済,1,2026-05-01,未提出,0,');
  });

  test('行を渡せば絞り込み後の内容だけを出力する', () => {
    const csv = Csv.buildCsv(result(), []);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  test('設定したラベルを使う', () => {
    const data = result();
    data.labels = { submitted: '済', unsubmitted: '未' };
    const lines = Csv.buildCsv(data).split('\r\n');
    expect(lines[1]).toContain('済');
    expect(lines[1]).toContain('未');
  });

  test('行やターゲットが空でも見出しだけ出す', () => {
    expect(Csv.buildCsv({ targets: [], rows: [] })).toBe('突合キー,氏名');
    expect(Csv.buildCsv(null)).toBe('突合キー,氏名');
  });

  test('改行はCRLF', () => {
    expect(Csv.buildCsv(result())).toContain('\r\n');
  });
});

describe('withBom / buildFileName', () => {
  test('BOMを先頭に付ける', () => {
    expect(Csv.withBom('a,b')).toBe('\ufeffa,b');
  });

  test('実行IDを含むファイル名になる', () => {
    expect(Csv.buildFileName({ runId: 'run-1' })).toBe(
      'cross-app-check_run-1.csv',
    );
    expect(Csv.buildFileName(null)).toBe('cross-app-check_run.csv');
  });
});
