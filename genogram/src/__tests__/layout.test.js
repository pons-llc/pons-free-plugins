'use strict';

const Model = require('../js/lib/model');
const Layout = require('../js/lib/layout');

const { SLOT_W, GEN_H, MARGIN_X, MARGIN_Y } = Layout;

describe('computeGenerations', () => {
  test('子は親の1つ下、夫婦は同じ世代', () => {
    const model = Model.normalize({
      persons: [
        { id: 'gf' },
        { id: 'gm' },
        { id: 'f', parentUnionId: 'u0' },
        { id: 'm' },
        { id: 'c', parentUnionId: 'u1' },
      ],
      unions: [
        { id: 'u0', a: 'gf', b: 'gm' },
        { id: 'u1', a: 'f', b: 'm' },
      ],
    });
    const gens = Layout.computeGenerations(model);
    expect(gens.get('gf')).toBe(0);
    expect(gens.get('gm')).toBe(0);
    expect(gens.get('f')).toBe(1);
    expect(gens.get('m')).toBe(1);
    expect(gens.get('c')).toBe(2);
  });

  test('子しか登録されていない親は、子の1つ上まで引き下げる', () => {
    // 曾祖父(ggf)→祖父(gf)→息子(son)の3世代目に嫁いだ妻(wife)の母(wm)は、
    // 0段目ではなく妻の1つ上(1段目)に置く。
    const model = Model.normalize({
      persons: [
        { id: 'ggf' },
        { id: 'gf', parentId: 'ggf' },
        { id: 'son', parentId: 'gf' },
        { id: 'wm' },
        { id: 'wife', parentId: 'wm' },
      ],
      unions: [{ id: 'u1', a: 'son', b: 'wife' }],
    });
    const gens = Layout.computeGenerations(model);
    expect(gens.get('son')).toBe(2);
    expect(gens.get('wife')).toBe(2);
    expect(gens.get('wm')).toBe(1);
  });

  test('親のいない人が下の世代の人と結婚したら、相手の世代にそろう', () => {
    const model = Model.normalize({
      persons: [{ id: 'gf' }, { id: 'son', parentId: 'gf' }, { id: 'wife' }],
      unions: [{ id: 'u1', a: 'son', b: 'wife' }],
    });
    const gens = Layout.computeGenerations(model);
    expect(gens.get('wife')).toBe(1);
  });

  test('循環した親子関係でも止まり、すべての人に世代を返す', () => {
    // normalizeは循環を除去しないため、手書きのJSONを想定して直接与える
    const model = {
      persons: [
        { id: 'a', parentId: 'b', parentUnionId: '' },
        { id: 'b', parentId: 'a', parentUnionId: '' },
      ],
      unions: [],
    };
    const gens = Layout.computeGenerations(model);
    expect(gens.size).toBe(2);
    expect(Number.isFinite(gens.get('a'))).toBe(true);
    expect(Math.min(...gens.values())).toBe(0);
  });
});

describe('resolveOverlaps', () => {
  test('重ならなければ希望位置のまま', () => {
    expect(
      Layout.resolveOverlaps([
        { desired: 0, width: 100 },
        { desired: 200, width: 100 },
      ]),
    ).toEqual([0, 200]);
  });

  test('重なったら、まとめて平均位置に置く(順番は保つ)', () => {
    // 2つとも希望位置100 → 合体した塊(幅200)の左端の希望は (100 + (100-100)) / 2 = 50
    expect(
      Layout.resolveOverlaps([
        { desired: 100, width: 100 },
        { desired: 100, width: 100 },
      ]),
    ).toEqual([50, 150]);
  });

  test('連鎖的に合体する', () => {
    const lefts = Layout.resolveOverlaps([
      { desired: 0, width: 100 },
      { desired: 50, width: 100 },
      { desired: 100, width: 100 },
    ]);
    expect(lefts).toEqual([-50, 50, 150]);
  });

  test('空配列', () => {
    expect(Layout.resolveOverlaps([])).toEqual([]);
  });
});

describe('orderChain(複数の相手がいる人)', () => {
  test('相手が最も多い人を中央に、相手を左右交互に置く', () => {
    const model = Model.normalize({
      persons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      unions: [
        { id: 'u1', a: 'a', b: 'b', status: 'divorced' },
        { id: 'u2', a: 'a', b: 'c' },
      ],
    });
    const order = Layout.orderChain(['a', 'b', 'c'], model.unions);
    expect(order).toEqual(['b', 'a', 'c']);
  });
});

describe('layout', () => {
  const nuclear = () =>
    Model.normalize({
      persons: [
        { id: 'f', gender: 'male' },
        { id: 'm', gender: 'female' },
        { id: 'c1', parentUnionId: 'u1' },
        { id: 'c2', parentUnionId: 'u1' },
        { id: 'c3', parentUnionId: 'u1' },
      ],
      unions: [{ id: 'u1', a: 'f', b: 'm' }],
    });

  test('空のモデル', () => {
    const result = Layout.layout(Model.empty());
    expect(result.nodes).toEqual({});
  });

  test('夫婦は隣に並び、子は夫婦の中央の下に配列順で並ぶ', () => {
    const { nodes } = Layout.layout(nuclear());
    expect(nodes.m.x - nodes.f.x).toBe(SLOT_W);
    expect(nodes.f.y).toBe(MARGIN_Y);
    expect(nodes.c1.y).toBe(MARGIN_Y + GEN_H);
    expect(nodes.c1.x).toBeLessThan(nodes.c2.x);
    expect(nodes.c2.x).toBeLessThan(nodes.c3.x);
    const parentMid = (nodes.f.x + nodes.m.x) / 2;
    const childMid = (nodes.c1.x + nodes.c3.x) / 2;
    expect(childMid).toBeCloseTo(parentMid);
  });

  test('いちばん左の人の中心はMARGIN_X', () => {
    const { nodes } = Layout.layout(nuclear());
    const minX = Math.min(...Object.values(nodes).map((n) => n.x));
    expect(minX).toBe(MARGIN_X);
  });

  test('同じ世代の人どうしは重ならない', () => {
    const model = Model.normalize({
      persons: [
        { id: 'gf' },
        { id: 'gm' },
        { id: 'a', parentUnionId: 'u0' },
        { id: 'aw' },
        { id: 'b', parentUnionId: 'u0' },
        { id: 'bw' },
        { id: 'a1', parentUnionId: 'ua' },
        { id: 'a2', parentUnionId: 'ua' },
        { id: 'a3', parentUnionId: 'ua' },
        { id: 'b1', parentUnionId: 'ub' },
        { id: 'b2', parentUnionId: 'ub' },
      ],
      unions: [
        { id: 'u0', a: 'gf', b: 'gm' },
        { id: 'ua', a: 'a', b: 'aw' },
        { id: 'ub', a: 'b', b: 'bw' },
      ],
    });
    const { nodes } = Layout.layout(model);
    const byY = {};
    Object.values(nodes).forEach((n) => {
      (byY[n.y] = byY[n.y] || []).push(n.x);
    });
    Object.values(byY).forEach((xs) => {
      xs.sort((p, q) => p - q);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(SLOT_W);
      }
    });
    // aの子(a1-a3)はbの子(b1-b2)より左
    expect(nodes.a3.x).toBeLessThan(nodes.b1.x);
  });

  test('手動の位置(pos)がある人はその位置を使う', () => {
    const model = nuclear();
    model.persons[0].pos = { x: 500, y: 600 };
    const { nodes } = Layout.layout(model);
    expect(nodes.f).toMatchObject({ x: 500, y: 600 });
  });

  test('width/heightは全員を含む', () => {
    const { nodes, width, height } = Layout.layout(nuclear());
    Object.values(nodes).forEach((n) => {
      expect(n.x).toBeLessThan(width);
      expect(n.y).toBeLessThan(height);
    });
  });
});
