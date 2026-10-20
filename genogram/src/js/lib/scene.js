(function (root) {
  'use strict';

  // モデルと自動配置の結果から、SVGに描く図形の一覧(描画命令)を作る。DOMには依存しない。
  // 各要素は { tag, attrs, text?, title?, target? }。
  // - attrsには数値・固定の文字列(クラス名・色など)だけを入れ、利用者の入力値は入れない。
  //   名前・備考などの入力値はtext/titleに入れ、描画側でtextContentとして設定する(XSS対策)。
  // - targetはクリックで編集対象を特定するための { type: 'person'|'union'|'relation'|'household', id }。

  const SIZE = 40; // 記号の大きさ
  const CLIENT_GAP = 5; // 本人の二重線の間隔
  // 記号の下端から夫婦の線までの距離。記号の下に描く名前(1行目)・備考(2行目)と重ならないよう、その下を通す。
  const UNION_DROP = 44;
  const SIBLING_RISE = 30; // 子の記号の上端から兄弟線までの距離
  const NAME_MAX = 10;
  const NOTE_MAX = 12;
  const DASH = { dashed: '6 4', dotted: '2 4' };
  const CHILD_DASH = {
    biological: undefined,
    adopted: DASH.dashed,
    foster: DASH.dotted,
  };
  const MIN_WIDTH = 240;
  const MIN_HEIGHT = 160;

  const truncate = (text, max) => {
    const chars = Array.from(text || '');
    if (chars.length <= max) {
      return { text: chars.join(''), truncated: false };
    }
    return { text: chars.slice(0, max - 1).join('') + '…', truncated: true };
  };

  const round = (n) => Math.round(n * 10) / 10;

  // 描画側(renderer.js)がsetAttributeしてよい属性名の許可リスト。イベントハンドラー(on*)・
  // href・styleは含めない。
  const SAFE_ATTRS = new Set([
    'class',
    'x',
    'y',
    'width',
    'height',
    'rx',
    'cx',
    'cy',
    'r',
    'd',
    'points',
    'x1',
    'y1',
    'x2',
    'y2',
    'fill',
    'stroke-dasharray',
    'xmlns',
    'viewBox',
    'role',
  ]);
  const isSafeAttrName = (name) => SAFE_ATTRS.has(name);

  const buildScene = (model, layoutResult, options) => {
    const opts = options || {};
    // 強調する人物(複数選択可)。selectedId(1人)も受け付ける。
    const selectedIds = new Set(opts.selectedIds || []);
    if (opts.selectedId) {
      selectedIds.add(opts.selectedId);
    }
    const nodes = (layoutResult && layoutResult.nodes) || {};
    const persons = model.persons || [];
    const personById = new Map(persons.map((p) => [p.id, p]));
    const items = [];
    const householdLabels = [];
    const bounds = { maxX: 0, maxY: 0 };
    const extend = (x, y) => {
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    };
    const halfOf = (id) =>
      SIZE / 2 +
      (personById.get(id) && personById.get(id).isClient ? CLIENT_GAP : 0);

    // ---- 同居(世帯)の枠: いちばん下(背景)に描く ----
    // 1つの長方形で囲むと、元配偶者など同居していない人まで枠に入ってしまうため、世代(段)ごとに
    // メンバーの左端〜右端を囲み、段どうしを階段状につないだ1つの輪郭にする。
    (model.households || []).forEach((h, index) => {
      const members = h.members.filter((id) => nodes[id]);
      if (members.length === 0) {
        return;
      }
      const pad = 14 + (index % 3) * 6;
      const rows = [];
      members
        .map((id) => nodes[id])
        .sort((p, q) => p.y - q.y)
        .forEach((n) => {
          const row = rows[rows.length - 1];
          if (row && Math.abs(row.y - n.y) < 1) {
            row.left = Math.min(row.left, n.x);
            row.right = Math.max(row.right, n.x);
          } else {
            rows.push({ y: n.y, left: n.x, right: n.x });
          }
        });
      const l = rows.map((row) => row.left - SIZE / 2 - pad);
      const r = rows.map((row) => row.right + SIZE / 2 + pad);
      const top = rows[0].y - SIZE / 2 - pad - 14;
      // b[i]: i段目の下端(最後の段は名前・備考の下まで、それ以外は次の段との中間)
      const b = rows.map((row, i) =>
        i < rows.length - 1
          ? (row.y + rows[i + 1].y) / 2
          : row.y + SIZE / 2 + pad + 46,
      );
      const points = [[l[0], top]];
      rows.forEach((row, i) => {
        points.push([r[i], i === 0 ? top : b[i - 1]]);
        points.push([r[i], b[i]]);
      });
      for (let i = rows.length - 1; i >= 0; i--) {
        points.push([l[i], b[i]]);
        points.push([l[i], i === 0 ? top : b[i - 1]]);
      }
      const d =
        points
          .map(
            ([px, py], i) => `${i === 0 ? 'M' : 'L'}${round(px)} ${round(py)}`,
          )
          .join(' ') + ' Z';
      items.push({
        tag: 'path',
        attrs: { class: 'g-household', d },
        target: { type: 'household', id: h.id },
      });
      const label = truncate(h.label, 16);
      // 世帯名は関係の線などに隠れないよう、最後(最前面)に描く
      householdLabels.push({
        tag: 'text',
        attrs: {
          class: 'g-household-label',
          x: round(l[0] + 8),
          y: round(top + 14),
        },
        text: label.text,
        title: label.truncated ? h.label : undefined,
        target: { type: 'household', id: h.id },
      });
      extend(Math.max(...r), b[b.length - 1]);
    });

    // ---- 情緒的関係 ----
    (model.relations || []).forEach((r) => {
      const a = nodes[r.a];
      const b = nodes[r.b];
      if (!a || !b) {
        return;
      }
      let start;
      let end;
      let control;
      if (Math.abs(a.y - b.y) < 1) {
        // 同じ段: 間の人に重ならないよう、記号の上側を弧でつなぐ
        start = { x: a.x, y: a.y - halfOf(r.a) - 2 };
        end = { x: b.x, y: b.y - halfOf(r.b) - 2 };
        control = {
          x: (a.x + b.x) / 2,
          y: a.y - SIZE / 2 - 30 - Math.min(Math.abs(a.x - b.x) * 0.15, 60),
        };
      } else {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const ra = halfOf(r.a) + 6;
        const rb = halfOf(r.b) + 6;
        start = { x: a.x + ux * ra, y: a.y + uy * ra };
        end = { x: b.x - ux * rb, y: b.y - uy * rb };
        control = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      }
      const at = (t) => ({
        x:
          (1 - t) * (1 - t) * start.x +
          2 * (1 - t) * t * control.x +
          t * t * end.x,
        y:
          (1 - t) * (1 - t) * start.y +
          2 * (1 - t) * t * control.y +
          t * t * end.y,
      });
      const tangent = (t) => {
        const tx =
          2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x);
        const ty =
          2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y);
        const len = Math.hypot(tx, ty) || 1;
        return { x: tx / len, y: ty / len };
      };
      const samples = 24;
      const points = [];
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const p = at(t);
        if (r.kind === 'conflict' && i > 0 && i < samples) {
          const tg = tangent(t);
          const sign = i % 2 === 0 ? 1 : -1;
          points.push({ x: p.x - tg.y * 6 * sign, y: p.y + tg.x * 6 * sign });
        } else {
          points.push(p);
        }
      }
      const d =
        'M' + points.map((p) => `${round(p.x)} ${round(p.y)}`).join(' L');
      const attrs = { class: `g-rel g-rel-${r.kind}`, d };
      if (r.kind === 'distant') {
        attrs['stroke-dasharray'] = DASH.dotted;
      }
      items.push({
        tag: 'path',
        attrs,
        target: { type: 'relation', id: r.id },
      });
      if (r.kind === 'cutoff') {
        const mid = at(0.5);
        const tg = tangent(0.5);
        [-4, 4].forEach((offset) => {
          const cx = mid.x + tg.x * offset;
          const cy = mid.y + tg.y * offset;
          items.push({
            tag: 'line',
            attrs: {
              class: 'g-cutoff-bar',
              x1: round(cx - tg.y * 8),
              y1: round(cy + tg.x * 8),
              x2: round(cx + tg.y * 8),
              y2: round(cy - tg.x * 8),
            },
            target: { type: 'relation', id: r.id },
          });
        });
      }
      items.push({
        tag: 'path',
        attrs: { class: 'g-hit', d },
        target: { type: 'relation', id: r.id },
      });
    });

    // ---- 夫婦の線 ----
    const unionAnchor = new Map(); // 夫婦ID → 子へ下ろす線の起点
    (model.unions || []).forEach((u) => {
      const a = nodes[u.a];
      const b = nodes[u.b];
      if (!a || !b) {
        return;
      }
      const wide = Math.abs(a.x - b.x) > 180 ? 12 : 0;
      const dropY =
        Math.max(a.y + halfOf(u.a), b.y + halfOf(u.b)) + UNION_DROP + wide;
      const d = `M${round(a.x)} ${round(a.y + halfOf(u.a))} V${round(dropY)} H${round(b.x)} V${round(b.y + halfOf(u.b))}`;
      const attrs = { class: 'g-union', d };
      if (u.status === 'cohabiting') {
        attrs['stroke-dasharray'] = DASH.dashed;
      }
      items.push({ tag: 'path', attrs, target: { type: 'union', id: u.id } });
      items.push({
        tag: 'path',
        attrs: { class: 'g-hit', d },
        target: { type: 'union', id: u.id },
      });
      const mx = (a.x + b.x) / 2;
      const slashCount = { separated: 1, divorced: 2 }[u.status] || 0;
      for (let i = 0; i < slashCount; i++) {
        const dx = (i - (slashCount - 1) / 2) * 8;
        items.push({
          tag: 'line',
          attrs: {
            class: 'g-slash',
            x1: round(mx + dx - 5),
            y1: round(dropY + 9),
            x2: round(mx + dx + 5),
            y2: round(dropY - 9),
          },
          target: { type: 'union', id: u.id },
        });
      }
      unionAnchor.set(u.id, { x: mx, y: dropY });
      extend(Math.max(a.x, b.x), dropY);
    });

    // ---- 親子の線 ----
    const groups = new Map(); // 起点キー → { origin, children: [] }
    persons.forEach((p) => {
      if (!nodes[p.id]) {
        return;
      }
      let key = '';
      let origin = null;
      if (p.parentUnionId && unionAnchor.has(p.parentUnionId)) {
        key = `u:${p.parentUnionId}`;
        origin = unionAnchor.get(p.parentUnionId);
      } else if (p.parentId && nodes[p.parentId]) {
        key = `p:${p.parentId}`;
        const parent = nodes[p.parentId];
        origin = { x: parent.x, y: parent.y + halfOf(p.parentId) };
      }
      if (!origin) {
        return;
      }
      if (!groups.has(key)) {
        groups.set(key, { origin, children: [] });
      }
      groups.get(key).children.push(p);
    });
    groups.forEach(({ origin, children }) => {
      const tops = children.map((c) => nodes[c.id].y - halfOf(c.id));
      const sibY = Math.min(...tops) - SIBLING_RISE;
      const xs = children.map((c) => nodes[c.id].x).concat([origin.x]);
      items.push({
        tag: 'line',
        attrs: {
          class: 'g-descent',
          x1: round(origin.x),
          y1: round(origin.y),
          x2: round(origin.x),
          y2: round(sibY),
        },
      });
      items.push({
        tag: 'line',
        attrs: {
          class: 'g-sibling',
          x1: round(Math.min(...xs)),
          y1: round(sibY),
          x2: round(Math.max(...xs)),
          y2: round(sibY),
        },
      });
      children.forEach((c) => {
        const n = nodes[c.id];
        const attrs = {
          class: 'g-child',
          x1: round(n.x),
          y1: round(sibY),
          x2: round(n.x),
          y2: round(n.y - halfOf(c.id)),
        };
        if (CHILD_DASH[c.childType]) {
          attrs['stroke-dasharray'] = CHILD_DASH[c.childType];
        }
        items.push({
          tag: 'line',
          attrs,
          target: { type: 'person', id: c.id },
        });
      });
    });

    // ---- 人物 ----
    const memoCounts = new Map();
    (model.memos || []).forEach((m) => {
      if (m.targetId) {
        memoCounts.set(m.targetId, (memoCounts.get(m.targetId) || 0) + 1);
      }
    });

    const shape = (p, n, half, extraClass) => {
      const cls = `g-person g-${p.gender}${extraClass}`;
      const target = { type: 'person', id: p.id };
      if (p.gender === 'male') {
        return {
          tag: 'rect',
          attrs: {
            class: cls,
            x: round(n.x - half),
            y: round(n.y - half),
            width: half * 2,
            height: half * 2,
          },
          target,
        };
      }
      if (p.gender === 'female') {
        return {
          tag: 'circle',
          attrs: { class: cls, cx: round(n.x), cy: round(n.y), r: half },
          target,
        };
      }
      const h = half + 3; // ひし形は同じ幅だと小さく見えるため少し大きくする
      return {
        tag: 'polygon',
        attrs: {
          class: cls,
          points: [
            [n.x, n.y - h],
            [n.x + h, n.y],
            [n.x, n.y + h],
            [n.x - h, n.y],
          ]
            .map(([px, py]) => `${round(px)},${round(py)}`)
            .join(' '),
        },
        target,
      };
    };

    persons.forEach((p) => {
      const n = nodes[p.id];
      if (!n) {
        return;
      }
      const selected = selectedIds.has(p.id) ? ' is-selected' : '';
      if (p.isClient) {
        items.push(
          shape(p, n, SIZE / 2 + CLIENT_GAP, ` g-client-outer${selected}`),
        );
      }
      items.push(shape(p, n, SIZE / 2, selected));
      if (p.deceased) {
        const h = SIZE / 2;
        [
          [n.x - h, n.y - h, n.x + h, n.y + h],
          [n.x + h, n.y - h, n.x - h, n.y + h],
        ].forEach(([x1, y1, x2, y2]) => {
          items.push({
            tag: 'line',
            attrs: {
              class: 'g-deceased',
              x1: round(x1),
              y1: round(y1),
              x2: round(x2),
              y2: round(y2),
            },
            target: { type: 'person', id: p.id },
          });
        });
      }
      if (p.age) {
        items.push({
          tag: 'text',
          attrs: { class: 'g-age', x: round(n.x), y: round(n.y + 5) },
          text: truncate(p.age, 5).text,
          target: { type: 'person', id: p.id },
        });
      }
      const labelTop = n.y + halfOf(p.id);
      if (p.name) {
        const name = truncate(p.name, NAME_MAX);
        items.push({
          tag: 'text',
          attrs: { class: 'g-name', x: round(n.x), y: round(labelTop + 17) },
          text: name.text,
          title: name.truncated ? p.name : undefined,
          target: { type: 'person', id: p.id },
        });
      }
      if (p.note) {
        const note = truncate(p.note, NOTE_MAX);
        items.push({
          tag: 'text',
          attrs: {
            class: 'g-note',
            x: round(n.x),
            y: round(labelTop + (p.name ? 33 : 17)),
          },
          text: note.text,
          title: note.truncated ? p.note : undefined,
          target: { type: 'person', id: p.id },
        });
      }
      const count = memoCounts.get(p.id);
      if (count) {
        const bx = n.x + SIZE / 2 + 2;
        const by = n.y - SIZE / 2 - 2;
        items.push({
          tag: 'circle',
          attrs: { class: 'g-memo-badge', cx: round(bx), cy: round(by), r: 9 },
          target: { type: 'memo', id: p.id },
        });
        items.push({
          tag: 'text',
          attrs: { class: 'g-memo-badge-text', x: round(bx), y: round(by + 4) },
          text: String(count),
          target: { type: 'memo', id: p.id },
        });
      }
      extend(n.x + SIZE, labelTop + 45);
    });

    householdLabels.forEach((item) => items.push(item));

    const width = Math.max(
      MIN_WIDTH,
      (layoutResult && layoutResult.width) || 0,
      bounds.maxX + 30,
    );
    const height = Math.max(
      MIN_HEIGHT,
      (layoutResult && layoutResult.height) || 0,
      bounds.maxY + 20,
    );
    return { width: Math.ceil(width), height: Math.ceil(height), items };
  };

  const Scene = { SIZE, DASH, truncate, isSafeAttrName, buildScene };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scene;
  } else {
    root.Genogram = root.Genogram || {};
    root.Genogram.Scene = Scene;
  }
})(typeof window !== 'undefined' ? window : globalThis);
