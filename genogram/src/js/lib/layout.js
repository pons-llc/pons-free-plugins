(function (root) {
  'use strict';

  // ジェノグラムの自動配置。DOMに依存しない純粋な計算で、人物IDごとの中心座標を返す。
  // 1. 世代: 子 ≥ 親+1、夫婦は同じ世代、親は子の1つ上まで引き下げる、を収束(または回数上限)まで繰り返す。
  // 2. 同じ世代で夫婦の線でつながる人を「横並びの組(chain)」にまとめる。
  // 3. 上の世代から: 組を親の位置の順に並べ、親の真下を希望位置として重ならないように置く。
  //    下の世代から: 子がいる組は子の中心の真上を希望位置として置き直す。
  // 4. 手動の位置(pos)がある人はその位置を使う。

  const SLOT_W = 120; // 1人分の横幅(記号+左右の余白)
  const CHAIN_GAP = 30; // 別の組との間に追加する余白
  const GEN_H = 160; // 世代間の縦の間隔
  const MARGIN_X = 70; // 左端の人の中心のx
  const MARGIN_Y = 70; // 最上段の人の中心のy
  const BOTTOM_SPACE = 90; // 最下段の記号の下に描く名前・備考の分

  const parentsOf = (person, unionById) => {
    const union = unionById.get(person.parentUnionId);
    if (union) {
      return [union.a, union.b];
    }
    return person.parentId ? [person.parentId] : [];
  };

  const computeGenerations = (model) => {
    const persons = model.persons || [];
    const unions = model.unions || [];
    const unionById = new Map(unions.map((u) => [u.id, u]));
    const gen = new Map(persons.map((p) => [p.id, 0]));
    const childrenOf = new Map();
    const parentLists = new Map();
    persons.forEach((p) => {
      const parents = parentsOf(p, unionById).filter((id) => gen.has(id));
      parentLists.set(p.id, parents);
      parents.forEach((parentId) => {
        if (!childrenOf.has(parentId)) {
          childrenOf.set(parentId, []);
        }
        childrenOf.get(parentId).push(p.id);
      });
    });

    // 循環した入力(手で書き換えたJSON等)では値が増え続けるため、回数上限で打ち切る。
    const maxIterations = persons.length * 4 + 10;
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;
      const raise = (id, value) => {
        if (gen.get(id) < value) {
          gen.set(id, value);
          changed = true;
        }
      };
      persons.forEach((p) => {
        const parents = parentLists.get(p.id);
        if (parents.length > 0) {
          raise(p.id, Math.max(...parents.map((id) => gen.get(id))) + 1);
        }
      });
      unions.forEach((u) => {
        if (gen.has(u.a) && gen.has(u.b)) {
          const g = Math.max(gen.get(u.a), gen.get(u.b));
          raise(u.a, g);
          raise(u.b, g);
        }
      });
      childrenOf.forEach((children, parentId) => {
        raise(parentId, Math.min(...children.map((id) => gen.get(id))) - 1);
      });
      if (!changed) {
        break;
      }
    }

    if (gen.size > 0) {
      const min = Math.min(...gen.values());
      gen.forEach((value, id) => gen.set(id, value - min));
    }
    return gen;
  };

  // 順番を保ったまま、重ならないように各項目の左端を決める。重なった項目どうしは1つの塊にまとめ、
  // 塊の位置を「各項目の希望位置からのずれの二乗和」が最小になる位置(希望位置の平均)に置く。
  // items: [{ desired: 希望する左端, width }] → 左端の配列
  const resolveOverlaps = (items) => {
    const clusters = [];
    items.forEach((item, index) => {
      let cluster = {
        first: index,
        count: 1,
        sum: item.desired,
        width: item.width,
        left: item.desired,
      };
      while (clusters.length > 0) {
        const prev = clusters[clusters.length - 1];
        if (prev.left + prev.width <= cluster.left) {
          break;
        }
        clusters.pop();
        const sum = prev.sum + (cluster.sum - cluster.count * prev.width);
        const count = prev.count + cluster.count;
        cluster = {
          first: prev.first,
          count,
          sum,
          width: prev.width + cluster.width,
          left: sum / count,
        };
      }
      clusters.push(cluster);
    });

    const lefts = [];
    clusters.forEach((cluster) => {
      let x = cluster.left;
      for (let i = 0; i < cluster.count; i++) {
        lefts.push(x);
        x += items[cluster.first + i].width;
      }
    });
    return lefts;
  };

  // 夫婦の線でつながる人の並び順。相手が最も多い人を中央に置き、相手を左右交互に置く。
  // 相手のさらに別の相手は、その相手の外側に置く。2人だけの組は男性を左・女性を右にする。
  const orderChain = (ids, unions, genderOf) => {
    if (ids.length <= 1) {
      return ids.slice();
    }
    const inChain = new Set(ids);
    const partners = new Map(ids.map((id) => [id, []]));
    unions.forEach((u) => {
      if (inChain.has(u.a) && inChain.has(u.b)) {
        partners.get(u.a).push(u.b);
        partners.get(u.b).push(u.a);
      }
    });
    if (ids.length === 2 && genderOf) {
      const rank = { male: 0, unknown: 1, female: 2 };
      const [x, y] = ids;
      return rank[genderOf(y)] < rank[genderOf(x)] ? [y, x] : [x, y];
    }

    let center = ids[0];
    ids.forEach((id) => {
      if (partners.get(id).length > partners.get(center).length) {
        center = id;
      }
    });

    const order = [center];
    const placed = new Set([center]);
    const queue = [];
    partners.get(center).forEach((partnerId, i) => {
      if (placed.has(partnerId)) {
        return;
      }
      const side = i % 2 === 0 ? -1 : 1;
      if (side < 0) {
        order.unshift(partnerId);
      } else {
        order.push(partnerId);
      }
      placed.add(partnerId);
      queue.push([partnerId, side]);
    });
    while (queue.length > 0) {
      const [id, side] = queue.shift();
      partners.get(id).forEach((partnerId) => {
        if (placed.has(partnerId)) {
          return;
        }
        if (side < 0) {
          order.unshift(partnerId);
        } else {
          order.push(partnerId);
        }
        placed.add(partnerId);
        queue.push([partnerId, side]);
      });
    }
    ids.forEach((id) => {
      if (!placed.has(id)) {
        order.push(id);
      }
    });
    return order;
  };

  // 同じ世代の人を、夫婦の線でつながる組ごとに分ける(persons配列の順で最初に出てくる人の順)。
  const buildChains = (rowIds, unions) => {
    const inRow = new Set(rowIds);
    const parent = new Map(rowIds.map((id) => [id, id]));
    const find = (id) => {
      let r = id;
      while (parent.get(r) !== r) {
        r = parent.get(r);
      }
      return r;
    };
    unions.forEach((u) => {
      if (inRow.has(u.a) && inRow.has(u.b)) {
        parent.set(find(u.a), find(u.b));
      }
    });
    const groups = new Map();
    rowIds.forEach((id) => {
      const r = find(id);
      if (!groups.has(r)) {
        groups.set(r, []);
      }
      groups.get(r).push(id);
    });
    return Array.from(groups.values());
  };

  const chainWidth = (chain) => chain.length * SLOT_W + CHAIN_GAP;

  const layout = (model) => {
    const persons = model.persons || [];
    const unions = model.unions || [];
    if (persons.length === 0) {
      return {
        nodes: {},
        width: MARGIN_X * 2,
        height: MARGIN_Y + BOTTOM_SPACE,
      };
    }
    const personById = new Map(persons.map((p) => [p.id, p]));
    const unionById = new Map(unions.map((u) => [u.id, u]));
    const indexOf = new Map(persons.map((p, i) => [p.id, i]));
    const genderOf = (id) => personById.get(id).gender;
    const gens = computeGenerations(model);
    const maxGen = Math.max(...gens.values());

    const rows = [];
    for (let g = 0; g <= maxGen; g++) {
      const rowIds = persons
        .filter((p) => gens.get(p.id) === g)
        .map((p) => p.id);
      rows.push(
        buildChains(rowIds, unions).map((ids) =>
          orderChain(ids, unions, genderOf),
        ),
      );
    }

    const x = new Map(); // 人物の中心のx(自動配置)
    const place = (chains, lefts) => {
      chains.forEach((chain, i) => {
        chain.forEach((id, j) => {
          x.set(id, lefts[i] + j * SLOT_W + SLOT_W / 2);
        });
      });
    };

    const parentAnchor = (id) => {
      const parents = parentsOf(personById.get(id), unionById);
      if (parents.length === 0 || !parents.every((p) => x.has(p))) {
        return null;
      }
      return parents.reduce((sum, p) => sum + x.get(p), 0) / parents.length;
    };

    // 上の世代から: 親の位置の順に並べ、親の真下に置く。
    rows.forEach((chains, g) => {
      const entries = chains.map((chain) => {
        const anchored = [];
        chain.forEach((id, j) => {
          const anchor = gens.get(id) === g ? parentAnchor(id) : null;
          if (anchor !== null) {
            anchored.push({ anchor, offset: j * SLOT_W + SLOT_W / 2 });
          }
        });
        const firstIndex = Math.min(...chain.map((id) => indexOf.get(id)));
        if (anchored.length === 0) {
          return { chain, key: null, firstIndex, desired: null };
        }
        const key =
          anchored.reduce((s, a) => s + a.anchor, 0) / anchored.length;
        const desired =
          anchored.reduce((s, a) => s + (a.anchor - a.offset), 0) /
          anchored.length;
        return { chain, key, firstIndex, desired };
      });
      const withAnchor = entries
        .filter((e) => e.key !== null)
        .sort((p, q) => p.key - q.key || p.firstIndex - q.firstIndex);
      const withoutAnchor = entries
        .filter((e) => e.key === null)
        .sort((p, q) => p.firstIndex - q.firstIndex);
      const ordered = withAnchor.concat(withoutAnchor);
      let prevEnd = 0;
      const items = ordered.map((e) => {
        const desired = e.desired !== null ? e.desired : prevEnd;
        prevEnd = desired + chainWidth(e.chain);
        return { desired, width: chainWidth(e.chain) };
      });
      rows[g] = ordered.map((e) => e.chain);
      place(rows[g], resolveOverlaps(items));
    });

    // 子の一覧(親の位置ごと): 夫婦の子・片親の子
    const childrenOfUnion = new Map();
    const childrenOfPerson = new Map();
    persons.forEach((p) => {
      const map = p.parentUnionId ? childrenOfUnion : childrenOfPerson;
      const key = p.parentUnionId || p.parentId;
      if (!key) {
        return;
      }
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(p.id);
    });
    const childCenter = (ids) => {
      const xs = ids.map((id) => x.get(id));
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    };

    // 下の世代から: 子がいる組は、子の中心の真上に置き直す。
    for (let g = maxGen - 1; g >= 0; g--) {
      const chains = rows[g];
      const items = chains.map((chain) => {
        const position = new Map(chain.map((id, j) => [id, j]));
        const wishes = [];
        unions.forEach((u) => {
          const children = childrenOfUnion.get(u.id);
          if (children && position.has(u.a) && position.has(u.b)) {
            const offset =
              ((position.get(u.a) + position.get(u.b)) / 2) * SLOT_W +
              SLOT_W / 2;
            wishes.push(childCenter(children) - offset);
          }
        });
        chain.forEach((id, j) => {
          const children = childrenOfPerson.get(id);
          if (children) {
            wishes.push(childCenter(children) - (j * SLOT_W + SLOT_W / 2));
          }
        });
        const currentLeft = x.get(chain[0]) - SLOT_W / 2;
        const desired =
          wishes.length > 0
            ? wishes.reduce((s, w) => s + w, 0) / wishes.length
            : currentLeft;
        return { desired, width: chainWidth(chain) };
      });
      place(chains, resolveOverlaps(items));
    }

    const minX = Math.min(...x.values());
    const nodes = {};
    persons.forEach((p) => {
      const g = gens.get(p.id);
      const auto = {
        x: x.get(p.id) - minX + MARGIN_X,
        y: MARGIN_Y + g * GEN_H,
      };
      nodes[p.id] = p.pos
        ? { x: p.pos.x, y: p.pos.y, gen: g, manual: true }
        : { x: auto.x, y: auto.y, gen: g, manual: false };
    });

    const values = Object.values(nodes);
    const width = Math.max(...values.map((n) => n.x)) + MARGIN_X;
    const height = Math.max(...values.map((n) => n.y)) + BOTTOM_SPACE;
    return { nodes, width, height };
  };

  const Layout = {
    SLOT_W,
    CHAIN_GAP,
    GEN_H,
    MARGIN_X,
    MARGIN_Y,
    BOTTOM_SPACE,
    computeGenerations,
    resolveOverlaps,
    orderChain,
    buildChains,
    layout,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Layout;
  } else {
    root.Genogram = root.Genogram || {};
    root.Genogram.Layout = Layout;
  }
})(typeof window !== 'undefined' ? window : globalThis);
