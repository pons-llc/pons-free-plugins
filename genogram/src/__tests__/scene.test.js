'use strict';

const Model = require('../js/lib/model');
const Layout = require('../js/lib/layout');
const Scene = require('../js/lib/scene');

const build = (raw) => {
  const model = Model.normalize(raw);
  return Scene.buildScene(model, Layout.layout(model));
};

const ofClass = (scene, cls) =>
  scene.items.filter((item) =>
    String(item.attrs.class || '')
      .split(' ')
      .includes(cls),
  );

const personShapes = (scene, id) =>
  scene.items.filter(
    (item) =>
      item.target &&
      item.target.type === 'person' &&
      item.target.id === id &&
      ['rect', 'circle', 'polygon'].includes(item.tag),
  );

describe('人物の記号', () => {
  test('男性は四角、女性は円、不明はひし形', () => {
    const scene = build({
      persons: [
        { id: 'a', gender: 'male' },
        { id: 'b', gender: 'female' },
        { id: 'c', gender: 'unknown' },
      ],
    });
    expect(personShapes(scene, 'a').map((s) => s.tag)).toEqual(['rect']);
    expect(personShapes(scene, 'b').map((s) => s.tag)).toEqual(['circle']);
    expect(personShapes(scene, 'c').map((s) => s.tag)).toEqual(['polygon']);
  });

  test('本人は記号を二重にする', () => {
    const scene = build({
      persons: [{ id: 'a', gender: 'female', isClient: true }],
    });
    expect(personShapes(scene, 'a').length).toBe(2);
  });

  test('死亡は×(2本の線)を重ねる', () => {
    const scene = build({ persons: [{ id: 'a', deceased: true }] });
    expect(ofClass(scene, 'g-deceased').length).toBe(2);
  });

  test('年齢は記号の中、名前と備考は記号の下に文字として出す', () => {
    const scene = build({
      persons: [{ id: 'a', name: '山田太郎', age: '45', note: '会社員' }],
    });
    const texts = scene.items.filter((i) => i.tag === 'text');
    expect(texts.map((t) => t.text)).toEqual(
      expect.arrayContaining(['45', '山田太郎', '会社員']),
    );
  });

  test('長い名前は省略し、全文はtitle(ツールチップ)に入れる', () => {
    const long = 'あ'.repeat(30);
    const scene = build({ persons: [{ id: 'a', name: long }] });
    const nameText = ofClass(scene, 'g-name')[0];
    expect(nameText.text.length).toBeLessThan(long.length);
    expect(nameText.text.endsWith('…')).toBe(true);
    expect(nameText.title).toBe(long);
  });

  test('利用者が入力した文字列は属性に入れない(textContentでのみ描画する前提)', () => {
    const evil = '"><script>alert(1)</script>';
    const scene = build({
      persons: [{ id: 'a', name: evil, note: evil, age: evil }],
      households: [{ id: 'h', label: evil, members: ['a'] }],
    });
    scene.items.forEach((item) => {
      Object.values(item.attrs).forEach((value) => {
        expect(String(value)).not.toContain('script');
      });
    });
  });

  test('メモがある人には件数バッジを出す', () => {
    const model = Model.normalize({
      persons: [{ id: 'a' }, { id: 'b' }],
      memos: [
        { id: 'm1', targetId: 'a', text: 'x' },
        { id: 'm2', targetId: 'a', text: 'y' },
        { id: 'm3', targetId: '', text: 'z' },
      ],
    });
    const scene = Scene.buildScene(model, Layout.layout(model));
    const badges = ofClass(scene, 'g-memo-badge-text');
    expect(badges.length).toBe(1);
    expect(badges[0].text).toBe('2');
  });
});

describe('選択の強調', () => {
  test('selectedIdsに含まれる人の記号すべてにis-selectedを付ける(複数選択)', () => {
    const model = Model.normalize({
      persons: [{ id: 'a', isClient: true }, { id: 'b' }, { id: 'c' }],
    });
    const scene = Scene.buildScene(model, Layout.layout(model), {
      selectedIds: ['a', 'b'],
    });
    const selected = (id) =>
      personShapes(scene, id).every((s) =>
        s.attrs.class.split(' ').includes('is-selected'),
      );
    expect(selected('a')).toBe(true);
    expect(personShapes(scene, 'a').length).toBe(2);
    expect(selected('b')).toBe(true);
    expect(selected('c')).toBe(false);
  });

  test('従来のselectedId(1人)も使える', () => {
    const model = Model.normalize({ persons: [{ id: 'a' }, { id: 'b' }] });
    const scene = Scene.buildScene(model, Layout.layout(model), {
      selectedId: 'b',
    });
    expect(ofClass(scene, 'is-selected').map((s) => s.target.id)).toEqual([
      'b',
    ]);
  });
});

describe('夫婦の線', () => {
  const couple = (status) =>
    build({
      persons: [
        { id: 'a', gender: 'male' },
        { id: 'b', gender: 'female' },
      ],
      unions: [{ id: 'u', a: 'a', b: 'b', status }],
    });

  test('婚姻は実線、斜線なし', () => {
    const scene = couple('married');
    const line = ofClass(scene, 'g-union')[0];
    expect(line.attrs['stroke-dasharray']).toBeUndefined();
    expect(line.target).toEqual({ type: 'union', id: 'u' });
    expect(ofClass(scene, 'g-slash').length).toBe(0);
  });

  test('別居は斜線1本、離婚は斜線2本', () => {
    expect(ofClass(couple('separated'), 'g-slash').length).toBe(1);
    expect(ofClass(couple('divorced'), 'g-slash').length).toBe(2);
  });

  test('内縁・事実婚は破線', () => {
    const line = ofClass(couple('cohabiting'), 'g-union')[0];
    expect(line.attrs['stroke-dasharray']).toBeTruthy();
  });
});

describe('親子の線', () => {
  test('夫婦の子は兄弟線でつなぎ、養子は破線・里子は点線', () => {
    const scene = build({
      persons: [
        { id: 'f' },
        { id: 'm' },
        { id: 'c1', parentUnionId: 'u' },
        { id: 'c2', parentUnionId: 'u', childType: 'adopted' },
        { id: 'c3', parentUnionId: 'u', childType: 'foster' },
      ],
      unions: [{ id: 'u', a: 'f', b: 'm' }],
    });
    const childLines = ofClass(scene, 'g-child');
    const byId = Object.fromEntries(
      childLines.map((line) => [line.target.id, line]),
    );
    expect(byId.c1.attrs['stroke-dasharray']).toBeUndefined();
    expect(byId.c2.attrs['stroke-dasharray']).toBe(Scene.DASH.dashed);
    expect(byId.c3.attrs['stroke-dasharray']).toBe(Scene.DASH.dotted);
    expect(ofClass(scene, 'g-sibling').length).toBe(1);
  });

  test('片親の子も線を引く', () => {
    const scene = build({
      persons: [{ id: 'p' }, { id: 'c', parentId: 'p' }],
    });
    expect(ofClass(scene, 'g-child').length).toBe(1);
  });
});

describe('情緒的関係', () => {
  test('種類ごとにクラスを付け、断絶は縦線2本を足す', () => {
    const kinds = ['close', 'conflict', 'distant', 'cutoff'];
    kinds.forEach((kind) => {
      const scene = build({
        persons: [{ id: 'a' }, { id: 'b' }],
        relations: [{ id: 'r', a: 'a', b: 'b', kind }],
      });
      const rel = ofClass(scene, `g-rel-${kind}`);
      expect(rel.length).toBeGreaterThan(0);
      expect(rel[0].target).toEqual({ type: 'relation', id: 'r' });
      if (kind === 'cutoff') {
        expect(ofClass(scene, 'g-cutoff-bar').length).toBe(2);
      }
    });
  });
});

describe('同居(世帯)', () => {
  // pathの "Mx y Lx y ... Z" から頂点を取り出す
  const polygonOf = (d) =>
    d
      .replace(/[MLZ]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number)
      .reduce((points, value, i, all) => {
        if (i % 2 === 0) {
          points.push({ x: value, y: all[i + 1] });
        }
        return points;
      }, []);
  const inside = (point, polygon) => {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      ) {
        result = !result;
      }
    }
    return result;
  };
  const corners = (n) => [
    { x: n.x - Scene.SIZE / 2, y: n.y - Scene.SIZE / 2 },
    { x: n.x + Scene.SIZE / 2, y: n.y - Scene.SIZE / 2 },
    { x: n.x - Scene.SIZE / 2, y: n.y + Scene.SIZE / 2 },
    { x: n.x + Scene.SIZE / 2, y: n.y + Scene.SIZE / 2 },
  ];

  test('メンバー全員の記号を囲む枠と世帯名を出す', () => {
    const model = Model.normalize({
      persons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      unions: [{ id: 'u', a: 'a', b: 'b' }],
      households: [{ id: 'h', label: '同居', members: ['a', 'b'] }],
    });
    const layout = Layout.layout(model);
    const scene = Scene.buildScene(model, layout);
    const outline = polygonOf(ofClass(scene, 'g-household')[0].attrs.d);
    ['a', 'b'].forEach((id) => {
      corners(layout.nodes[id]).forEach((corner) => {
        expect(inside(corner, outline)).toBe(true);
      });
    });
    expect(ofClass(scene, 'g-household-label')[0].text).toBe('同居');
  });

  test('枠は最背面、世帯名は最前面に描く(関係の線などに隠れない)', () => {
    const scene = build({
      persons: [{ id: 'a' }, { id: 'b' }],
      relations: [{ id: 'r', a: 'a', b: 'b', kind: 'conflict' }],
      households: [{ id: 'h', label: '本人世帯', members: ['a', 'b'] }],
    });
    const indexOf = (cls) =>
      scene.items.findIndex((item) =>
        String(item.attrs.class).split(' ').includes(cls),
      );
    expect(indexOf('g-household')).toBe(0);
    expect(indexOf('g-household-label')).toBe(scene.items.length - 1);
  });

  test('世代ごとに囲むため、別の世代にいるメンバー以外の人は枠に入らない', () => {
    // 母(m)が元夫(ex)・今の夫(np)の間にいて、同居は 母・今の夫・子(k) の場合、
    // 1つの長方形だと元夫(ex)も入ってしまう。元夫は母の左、子は元夫との子として左寄りに並ぶ。
    const model = Model.normalize({
      persons: [
        { id: 'm', gender: 'female' },
        { id: 'ex', gender: 'male' },
        { id: 'np', gender: 'male' },
        { id: 'k', parentUnionId: 'u1' },
        { id: 'k2', parentUnionId: 'u2' },
      ],
      unions: [
        { id: 'u1', a: 'm', b: 'ex', status: 'divorced' },
        { id: 'u2', a: 'm', b: 'np' },
      ],
      households: [{ id: 'h', label: '同居', members: ['m', 'np', 'k'] }],
    });
    const layout = Layout.layout(model);
    const scene = Scene.buildScene(model, layout);
    const outline = polygonOf(ofClass(scene, 'g-household')[0].attrs.d);
    ['m', 'np', 'k'].forEach((id) => {
      corners(layout.nodes[id]).forEach((corner) => {
        expect(inside(corner, outline)).toBe(true);
      });
    });
    // 元夫は母の左、子kは2行目。元夫は1行目の範囲(母〜今の夫)の外。
    expect(layout.nodes.ex.x).toBeLessThan(layout.nodes.m.x);
    expect(inside(layout.nodes.ex, outline)).toBe(false);
  });
});

describe('属性名', () => {
  test('描画命令の属性名はすべて描画側の許可リスト(isSafeAttrName)を通る', () => {
    // x1/y1 等の数字を含む属性名が許可リストで落ちると、線が座標なしで描かれて見えなくなる
    const scene = build({
      persons: [
        { id: 'f', gender: 'male', deceased: true, isClient: true },
        { id: 'm', gender: 'female' },
        { id: 'c', parentUnionId: 'u', childType: 'adopted' },
      ],
      unions: [{ id: 'u', a: 'f', b: 'm', status: 'divorced' }],
      relations: [{ id: 'r', a: 'f', b: 'c', kind: 'cutoff' }],
      households: [{ id: 'h', label: 'x', members: ['f', 'c'] }],
      memos: [{ id: 'mm', targetId: 'f', text: 'x' }],
    });
    const names = new Set();
    scene.items.forEach((item) =>
      Object.keys(item.attrs).forEach((key) => names.add(key)),
    );
    ['x1', 'y1', 'x2', 'y2', 'stroke-dasharray', 'd', 'points'].forEach((key) =>
      expect(names.has(key)).toBe(true),
    );
    names.forEach((key) => expect(Scene.isSafeAttrName(key)).toBe(true));
    ['onclick', 'href', 'xlink:href', 'style'].forEach((key) =>
      expect(Scene.isSafeAttrName(key)).toBe(false),
    );
  });
});

describe('全体の大きさ', () => {
  test('空のモデルでも最小の大きさを持つ', () => {
    const scene = build({});
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
    expect(scene.items).toEqual([]);
  });

  test('手動で右下に動かした人も含む大きさになる', () => {
    const scene = build({ persons: [{ id: 'a', pos: { x: 900, y: 700 } }] });
    expect(scene.width).toBeGreaterThan(900);
    expect(scene.height).toBeGreaterThan(700);
  });
});
