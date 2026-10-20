'use strict';

const Model = require('../js/lib/model');

describe('parse', () => {
  test('空文字・空白・null・undefinedは空のモデル', () => {
    ['', '   \n', null, undefined].forEach((raw) => {
      const result = Model.parse(raw);
      expect(result.ok).toBe(true);
      expect(result.model).toEqual(Model.empty());
    });
  });

  test('JSONとして読めない値はok:false(エディターで上書きしないため)', () => {
    const result = Model.parse('{"persons": [');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('オブジェクト以外(配列・数値・文字列)はok:false', () => {
    ['[]', '1', '"abc"', 'null'].forEach((raw) => {
      expect(Model.parse(raw).ok).toBe(false);
    });
  });

  test('正しいJSONは正規化して返す', () => {
    const raw = JSON.stringify({
      version: 1,
      persons: [{ id: 'p1', name: '太郎', gender: 'male' }],
    });
    const result = Model.parse(raw);
    expect(result.ok).toBe(true);
    expect(result.model.persons[0]).toMatchObject({
      id: 'p1',
      name: '太郎',
      gender: 'male',
      age: '',
      deceased: false,
      isClient: false,
      note: '',
      parentUnionId: '',
      parentId: '',
      childType: 'biological',
    });
    expect(result.model.persons[0].pos).toBeUndefined();
  });
});

describe('normalize', () => {
  test('未知の値は既定値に、文字列以外の名前は空文字にする', () => {
    const model = Model.normalize({
      persons: [
        {
          id: 'p1',
          name: 123,
          gender: 'alien',
          childType: 'x',
          deceased: 'yes',
        },
      ],
    });
    expect(model.persons[0].name).toBe('');
    expect(model.persons[0].gender).toBe('unknown');
    expect(model.persons[0].childType).toBe('biological');
    expect(model.persons[0].deceased).toBe(false);
  });

  test('年齢は数値でも文字列にそろえる', () => {
    const model = Model.normalize({ persons: [{ id: 'p1', age: 45 }] });
    expect(model.persons[0].age).toBe('45');
  });

  test('idが無い・重複する人物は捨てる', () => {
    const model = Model.normalize({
      persons: [{ id: 'p1' }, { id: 'p1', name: '重複' }, { name: 'idなし' }],
    });
    expect(model.persons.map((p) => p.id)).toEqual(['p1']);
  });

  test('存在しない人物を指す夫婦・自分自身との夫婦・同じ組の重複は捨てる', () => {
    const model = Model.normalize({
      persons: [{ id: 'a' }, { id: 'b' }],
      unions: [
        { id: 'u1', a: 'a', b: 'b', status: 'divorced' },
        { id: 'u2', a: 'a', b: 'zzz' },
        { id: 'u3', a: 'a', b: 'a' },
        { id: 'u4', a: 'b', b: 'a' },
      ],
    });
    expect(model.unions).toEqual([
      { id: 'u1', a: 'a', b: 'b', status: 'divorced', note: '' },
    ]);
  });

  test('存在しない夫婦・人物を親に指していたら親未設定にする', () => {
    const model = Model.normalize({
      persons: [
        { id: 'a', parentUnionId: 'nope' },
        { id: 'b', parentId: 'nope' },
        { id: 'c', parentId: 'c' },
      ],
    });
    model.persons.forEach((p) => {
      expect(p.parentUnionId).toBe('');
      expect(p.parentId).toBe('');
    });
  });

  test('両方の親が指定されていたら夫婦(parentUnionId)を優先する', () => {
    const model = Model.normalize({
      persons: [
        { id: 'a' },
        { id: 'b' },
        { id: 'c', parentUnionId: 'u1', parentId: 'a' },
      ],
      unions: [{ id: 'u1', a: 'a', b: 'b' }],
    });
    expect(model.persons[2].parentUnionId).toBe('u1');
    expect(model.persons[2].parentId).toBe('');
  });

  test('自分が含まれる夫婦を親にはできない', () => {
    const model = Model.normalize({
      persons: [{ id: 'a', parentUnionId: 'u1' }, { id: 'b' }],
      unions: [{ id: 'u1', a: 'a', b: 'b' }],
    });
    expect(model.persons[0].parentUnionId).toBe('');
  });

  test('関係は種類を検証し、存在しない人物を含むものは捨てる', () => {
    const model = Model.normalize({
      persons: [{ id: 'a' }, { id: 'b' }],
      relations: [
        { id: 'r1', a: 'a', b: 'b', kind: 'conflict' },
        { id: 'r2', a: 'a', b: 'b', kind: 'weird' },
        { id: 'r3', a: 'a', b: 'x', kind: 'close' },
      ],
    });
    expect(model.relations).toEqual([
      { id: 'r1', a: 'a', b: 'b', kind: 'conflict', note: '' },
      { id: 'r2', a: 'a', b: 'b', kind: 'close', note: '' },
    ]);
  });

  test('世帯は存在する人物だけを重複なく残し、メンバーが0人なら捨てる', () => {
    const model = Model.normalize({
      persons: [{ id: 'a' }, { id: 'b' }],
      households: [
        { id: 'h1', label: '同居', members: ['a', 'b', 'a', 'x'] },
        { id: 'h2', label: '空', members: ['x'] },
      ],
    });
    expect(model.households).toEqual([
      { id: 'h1', label: '同居', members: ['a', 'b'] },
    ]);
  });

  test('メモは本文が空のものを捨て、存在しない人物宛てはレコード全体宛てにする', () => {
    const model = Model.normalize({
      persons: [{ id: 'a' }],
      memos: [
        {
          id: 'm1',
          targetId: 'a',
          text: '本人と面談',
          author: { code: 'u1', name: '佐藤' },
          at: '2026-10-20T00:00:00.000Z',
        },
        { id: 'm2', targetId: 'gone', text: '削除済みの人へのメモ' },
        { id: 'm3', text: '   ' },
      ],
    });
    expect(model.memos).toEqual([
      {
        id: 'm1',
        targetId: 'a',
        text: '本人と面談',
        author: { code: 'u1', name: '佐藤' },
        at: '2026-10-20T00:00:00.000Z',
      },
      {
        id: 'm2',
        targetId: '',
        text: '削除済みの人へのメモ',
        author: { code: '', name: '' },
        at: '',
      },
    ]);
  });

  test('文字列は長さを制限する', () => {
    const model = Model.normalize({
      persons: [{ id: 'a', name: 'あ'.repeat(500), note: 'い'.repeat(5000) }],
    });
    expect(model.persons[0].name.length).toBe(Model.LIMITS.name);
    expect(model.persons[0].note.length).toBe(Model.LIMITS.note);
  });

  test('pos は有限の数値の組だけ残す', () => {
    const model = Model.normalize({
      persons: [
        { id: 'a', pos: { x: 10, y: 20 } },
        { id: 'b', pos: { x: 'a', y: 1 } },
        { id: 'c', pos: { x: Infinity, y: 1 } },
      ],
    });
    expect(model.persons[0].pos).toEqual({ x: 10, y: 20 });
    expect(model.persons[1].pos).toBeUndefined();
    expect(model.persons[2].pos).toBeUndefined();
  });

  test('配列でない項目は空配列にする', () => {
    expect(Model.normalize({ persons: 'x', unions: {} })).toEqual(
      Model.empty(),
    );
  });
});

describe('serialize', () => {
  test('正規化したJSON文字列を返し、parseで同じモデルに戻る', () => {
    const model = Model.normalize({
      persons: [{ id: 'a', name: '花子', gender: 'female' }],
    });
    const raw = Model.serialize(model);
    expect(Model.parse(raw).model).toEqual(model);
    expect(JSON.parse(raw).version).toBe(1);
  });
});

describe('formatDateTime', () => {
  test('ローカル時刻のYYYY/MM/DD HH:mmにする', () => {
    const iso = new Date(2026, 9, 5, 8, 3).toISOString();
    expect(Model.formatDateTime(iso)).toBe('2026/10/05 08:03');
  });

  test('不正な値は空文字', () => {
    expect(Model.formatDateTime('')).toBe('');
    expect(Model.formatDateTime('abc')).toBe('');
  });
});
