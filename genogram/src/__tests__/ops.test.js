'use strict';

const Model = require('../js/lib/model');
const Ops = require('../js/lib/ops');

const sequentialIds = () => {
  let n = 0;
  return (prefix) => `${prefix}${++n}`;
};

const familyModel = () =>
  Model.normalize({
    persons: [
      { id: 'f', name: '父', gender: 'male' },
      { id: 'm', name: '母', gender: 'female' },
      { id: 'c1', name: '長男', gender: 'male', parentUnionId: 'u1' },
      { id: 'c2', name: '長女', gender: 'female', parentUnionId: 'u1' },
      { id: 'c3', name: '次男', gender: 'male', parentUnionId: 'u1' },
    ],
    unions: [{ id: 'u1', a: 'f', b: 'm', status: 'married' }],
    relations: [{ id: 'r1', a: 'f', b: 'c1', kind: 'conflict' }],
    households: [{ id: 'h1', label: '同居', members: ['f', 'c1'] }],
    memos: [
      { id: 'm1', targetId: 'f', text: '父へのメモ' },
      { id: 'm2', targetId: '', text: '全体メモ' },
    ],
  });

describe('addPerson / updatePerson', () => {
  test('既定値付きで追加し、IDを返す', () => {
    const model = Model.empty();
    const id = Ops.addPerson(model, { name: '太郎' }, sequentialIds());
    expect(id).toBe('p1');
    expect(model.persons[0]).toMatchObject({
      id: 'p1',
      name: '太郎',
      gender: 'unknown',
      childType: 'biological',
    });
  });

  test('更新は正規化され、idは変えられない', () => {
    const model = familyModel();
    Ops.updatePerson(model, 'f', { id: 'zzz', name: '父(更新)', gender: 'x' });
    const p = model.persons.find((x) => x.id === 'f');
    expect(p.name).toBe('父(更新)');
    expect(p.gender).toBe('unknown');
  });
});

describe('removePerson', () => {
  test('その人を含む夫婦・関係・世帯の所属・メモを削除し、子は親未設定になる', () => {
    const model = familyModel();
    Ops.removePerson(model, 'f');
    expect(model.persons.map((p) => p.id)).toEqual(['m', 'c1', 'c2', 'c3']);
    expect(model.unions).toEqual([]);
    expect(model.relations).toEqual([]);
    expect(model.households).toEqual([
      { id: 'h1', label: '同居', members: ['c1'] },
    ]);
    expect(model.memos.map((m) => m.id)).toEqual(['m2']);
    model.persons.forEach((p) => expect(p.parentUnionId).toBe(''));
  });

  test('片親として参照されていたら親未設定になる', () => {
    const model = Model.normalize({
      persons: [{ id: 'a' }, { id: 'b', parentId: 'a' }],
    });
    Ops.removePerson(model, 'a');
    expect(model.persons[0].parentId).toBe('');
  });

  test('世帯のメンバーが0人になったら世帯ごと削除する', () => {
    const model = familyModel();
    Ops.removePerson(model, 'f');
    Ops.removePerson(model, 'c1');
    expect(model.households).toEqual([]);
  });
});

describe('addUnion', () => {
  test('2人の夫婦を追加する', () => {
    const model = Model.normalize({ persons: [{ id: 'a' }, { id: 'b' }] });
    const id = Ops.addUnion(model, 'a', 'b', 'cohabiting', sequentialIds());
    expect(model.unions).toEqual([
      { id, a: 'a', b: 'b', status: 'cohabiting', note: '' },
    ]);
  });

  test('同じ2人の夫婦が既にあれば既存のIDを返し、増やさない', () => {
    const model = familyModel();
    expect(Ops.addUnion(model, 'm', 'f', 'married')).toBe('u1');
    expect(model.unions.length).toBe(1);
  });

  test('同一人物・存在しない人物はnull', () => {
    const model = familyModel();
    expect(Ops.addUnion(model, 'f', 'f')).toBeNull();
    expect(Ops.addUnion(model, 'f', 'nobody')).toBeNull();
  });

  test('removeUnionで夫婦を消すと、その子は親未設定になる', () => {
    const model = familyModel();
    Ops.removeUnion(model, 'u1');
    expect(model.unions).toEqual([]);
    expect(model.persons.filter((p) => p.parentUnionId)).toEqual([]);
  });
});

describe('クイック操作', () => {
  test('addPartner: 性別を反対にした相手と婚姻の夫婦を作る', () => {
    const model = Model.normalize({
      persons: [{ id: 'a', gender: 'female' }],
    });
    const { personId, unionId } = Ops.addPartner(model, 'a', sequentialIds());
    const partner = model.persons.find((p) => p.id === personId);
    expect(partner.gender).toBe('male');
    expect(model.unions[0]).toMatchObject({
      id: unionId,
      a: 'a',
      b: personId,
      status: 'married',
    });
  });

  test('addChild: 夫婦があれば最後の夫婦の子、無ければ片親の子', () => {
    const model = familyModel();
    const ids = sequentialIds();
    const id1 = Ops.addChild(model, 'f', ids);
    expect(model.persons.find((p) => p.id === id1).parentUnionId).toBe('u1');

    const id2 = Ops.addChild(model, 'c1', ids);
    const child = model.persons.find((p) => p.id === id2);
    expect(child.parentId).toBe('c1');
    expect(child.parentUnionId).toBe('');
  });

  test('addParents: 父・母と夫婦を作り、本人の親にする', () => {
    const model = Model.normalize({ persons: [{ id: 'a' }] });
    const result = Ops.addParents(model, 'a', sequentialIds());
    expect(result).not.toBeNull();
    const genders = model.persons
      .filter((p) => p.id !== 'a')
      .map((p) => p.gender);
    expect(genders).toEqual(['male', 'female']);
    expect(model.persons.find((p) => p.id === 'a').parentUnionId).toBe(
      result.unionId,
    );
  });

  test('addParents: 既に親がいればnullで何もしない', () => {
    const model = familyModel();
    expect(Ops.addParents(model, 'c1')).toBeNull();
    expect(model.persons.length).toBe(5);
  });
});

describe('moveSibling', () => {
  test('同じ親の兄弟と並び順を入れ替える', () => {
    const model = familyModel();
    Ops.moveSibling(model, 'c3', -1);
    expect(model.persons.map((p) => p.id)).toEqual([
      'f',
      'm',
      'c1',
      'c3',
      'c2',
    ]);
  });

  test('端なら何もしない', () => {
    const model = familyModel();
    Ops.moveSibling(model, 'c1', -1);
    expect(model.persons.map((p) => p.id)).toEqual([
      'f',
      'm',
      'c1',
      'c2',
      'c3',
    ]);
  });
});

describe('親の候補(循環の防止)', () => {
  test('自分・自分の子孫・自分を含む夫婦は親の候補にならない', () => {
    const model = familyModel();
    // c1 の子として g を追加
    Ops.addChild(model, 'c1', () => 'g');
    const options = Ops.parentOptions(model, 'c1');
    expect(options.persons.map((p) => p.id)).toEqual(['f', 'm', 'c2', 'c3']);
    expect(options.unions.map((u) => u.id)).toEqual(['u1']);

    const optionsForFather = Ops.parentOptions(model, 'f');
    // 父の子孫(c1,c2,c3,g)と、父を含む夫婦u1は除外
    expect(optionsForFather.persons.map((p) => p.id)).toEqual(['m']);
    expect(optionsForFather.unions).toEqual([]);
  });
});

describe('世帯・関係・メモ', () => {
  test('addHouseholdは存在する人物だけを登録する', () => {
    const model = familyModel();
    const id = Ops.addHousehold(model, '母子', ['m', 'c2', 'x'], () => 'h9');
    expect(model.households.find((h) => h.id === id).members).toEqual([
      'm',
      'c2',
    ]);
  });

  test('addRelationは同一人物ならnull', () => {
    const model = familyModel();
    expect(Ops.addRelation(model, 'f', 'f', 'close')).toBeNull();
    const id = Ops.addRelation(model, 'm', 'c2', 'close', () => 'r9');
    expect(model.relations.find((r) => r.id === id).kind).toBe('close');
  });

  test('addMemoは本文が空ならnull、あれば末尾に追加する', () => {
    const model = familyModel();
    expect(Ops.addMemo(model, { text: '  ' })).toBeNull();
    const id = Ops.addMemo(
      model,
      {
        targetId: 'm',
        text: '母と面談',
        author: { code: 'sato', name: '佐藤' },
        at: '2026-10-20T00:00:00.000Z',
      },
      () => 'm9',
    );
    expect(model.memos[model.memos.length - 1]).toEqual({
      id,
      targetId: 'm',
      text: '母と面談',
      author: { code: 'sato', name: '佐藤' },
      at: '2026-10-20T00:00:00.000Z',
    });
  });
});

describe('位置', () => {
  test('setPositionは10px単位に丸め、clearPositionsで全員の手動位置を消す', () => {
    const model = familyModel();
    Ops.setPosition(model, 'f', 123, 46);
    expect(model.persons[0].pos).toEqual({ x: 120, y: 50 });
    Ops.clearPositions(model);
    expect(model.persons.every((p) => p.pos === undefined)).toBe(true);
  });

  test('clearPositionsに人物IDを渡すと、その人たちの手動位置だけを消す', () => {
    const model = familyModel();
    Ops.setPosition(model, 'f', 100, 100);
    Ops.setPosition(model, 'm', 200, 100);
    Ops.clearPositions(model, ['f']);
    expect(model.persons[0].pos).toBeUndefined();
    expect(model.persons[1].pos).toEqual({ x: 200, y: 100 });
  });

  describe('moveGroup(複数選択して移動)', () => {
    // 移動開始時点の各人の位置(自動配置・手動位置のどちらでも、表示中の座標)
    const startNodes = {
      f: { x: 100, y: 70 },
      m: { x: 220, y: 70 },
      c1: { x: 160, y: 230 },
    };

    test('選んだ全員を同じだけ動かし、相対位置を保つ(10px単位)', () => {
      const model = familyModel();
      Ops.moveGroup(model, ['f', 'm'], startNodes, 53, 21);
      const pos = Object.fromEntries(
        model.persons.filter((p) => p.pos).map((p) => [p.id, p.pos]),
      );
      expect(pos).toEqual({
        f: { x: 150, y: 90 },
        m: { x: 270, y: 90 },
      });
    });

    test('左上にはみ出す場合は、いちばん端の人が余白(30)で止まるよう移動量をそろえて抑える', () => {
      const model = familyModel();
      Ops.moveGroup(model, ['f', 'm', 'c1'], startNodes, -500, -500);
      const byId = Object.fromEntries(model.persons.map((p) => [p.id, p]));
      expect(byId.f.pos).toEqual({ x: 30, y: 30 });
      expect(byId.m.pos.x - byId.f.pos.x).toBe(120);
      expect(byId.c1.pos.y - byId.f.pos.y).toBe(160);
    });

    test('開始位置が分からない人・存在しない人は無視する', () => {
      const model = familyModel();
      Ops.moveGroup(model, ['f', 'c2', 'nobody'], startNodes, 10, 0);
      const moved = model.persons.filter((p) => p.pos).map((p) => p.id);
      expect(moved).toEqual(['f']);
    });
  });
});

describe('defaultIdGenerator', () => {
  test('接頭辞付きで毎回異なるIDを返す', () => {
    const a = Ops.defaultIdGenerator('p');
    const b = Ops.defaultIdGenerator('p');
    expect(a).toMatch(/^p[0-9a-z]+$/);
    expect(a).not.toBe(b);
  });
});
