(function (root) {
  'use strict';

  // エディターから呼ぶモデル操作。渡したモデルをその場で書き換える(エディターは1つのモデルを持ち続け、
  // 保存時にまとめてJSONにする)。IDの生成はテストで差し替えられるよう、最後の引数で受け取る。

  const Model =
    typeof module !== 'undefined' && module.exports
      ? require('./model')
      : root.Genogram.Model;

  let counter = 0;
  const defaultIdGenerator = (prefix) => {
    counter = (counter + 1) % 1296;
    return (
      prefix +
      Date.now().toString(36) +
      counter.toString(36).padStart(2, '0') +
      Math.floor(Math.random() * 1296)
        .toString(36)
        .padStart(2, '0')
    );
  };

  const findPerson = (model, id) => model.persons.find((p) => p.id === id);
  const hasPerson = (model, id) => !!findPerson(model, id);

  const unionsOf = (model, personId) =>
    model.unions.filter((u) => u.a === personId || u.b === personId);

  // ---- 人物 ----

  const addPerson = (model, fields, idGen = defaultIdGenerator) => {
    const id = idGen('p');
    model.persons.push(Model.normalizePerson({ ...(fields || {}), id }));
    return id;
  };

  const updatePerson = (model, id, fields) => {
    const index = model.persons.findIndex((p) => p.id === id);
    if (index < 0) {
      return;
    }
    const merged = { ...model.persons[index], ...(fields || {}), id };
    model.persons[index] = Model.normalizePerson(merged);
  };

  const removePerson = (model, id) => {
    const removedUnionIds = new Set(unionsOf(model, id).map((u) => u.id));
    model.persons = model.persons.filter((p) => p.id !== id);
    model.unions = model.unions.filter((u) => !removedUnionIds.has(u.id));
    model.persons.forEach((p) => {
      if (removedUnionIds.has(p.parentUnionId)) {
        p.parentUnionId = '';
      }
      if (p.parentId === id) {
        p.parentId = '';
      }
    });
    model.relations = model.relations.filter((r) => r.a !== id && r.b !== id);
    model.households = model.households
      .map((h) => ({ ...h, members: h.members.filter((m) => m !== id) }))
      .filter((h) => h.members.length > 0);
    model.memos = model.memos.filter((m) => m.targetId !== id);
  };

  // 同じ親(夫婦/片親/親なし)の兄弟の中で、並び順を1つ前(-1)・後(+1)の兄弟と入れ替える。
  const moveSibling = (model, id, direction) => {
    const index = model.persons.findIndex((p) => p.id === id);
    if (index < 0) {
      return;
    }
    const key = (p) => `${p.parentUnionId}\n${p.parentId}`;
    const myKey = key(model.persons[index]);
    for (
      let j = index + direction;
      j >= 0 && j < model.persons.length;
      j += direction
    ) {
      if (key(model.persons[j]) === myKey) {
        const tmp = model.persons[j];
        model.persons[j] = model.persons[index];
        model.persons[index] = tmp;
        return;
      }
    }
  };

  // 子孫(子・孫…)のIDの集合。循環した入力でも止まる。
  const descendantsOf = (model, id) => {
    const result = new Set();
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift();
      const unionIds = new Set(unionsOf(model, current).map((u) => u.id));
      model.persons.forEach((p) => {
        const isChild = p.parentId === current || unionIds.has(p.parentUnionId);
        if (isChild && !result.has(p.id) && p.id !== id) {
          result.add(p.id);
          queue.push(p.id);
        }
      });
    }
    return result;
  };

  // 人物フォームの「親」の候補。自分・自分の子孫・自分か子孫を含む夫婦は除く(親子関係の循環を防ぐ)。
  const parentOptions = (model, personId) => {
    const excluded = descendantsOf(model, personId);
    excluded.add(personId);
    return {
      unions: model.unions.filter(
        (u) => !excluded.has(u.a) && !excluded.has(u.b),
      ),
      persons: model.persons.filter((p) => !excluded.has(p.id)),
    };
  };

  // ---- 夫婦・パートナー ----

  const addUnion = (model, a, b, status, idGen = defaultIdGenerator) => {
    if (a === b || !hasPerson(model, a) || !hasPerson(model, b)) {
      return null;
    }
    const existing = model.unions.find(
      (u) => (u.a === a && u.b === b) || (u.a === b && u.b === a),
    );
    if (existing) {
      return existing.id;
    }
    const id = idGen('u');
    model.unions.push({
      id,
      a,
      b,
      status: Model.UNION_STATUSES.includes(status) ? status : 'married',
      note: '',
    });
    return id;
  };

  const updateUnion = (model, id, fields) => {
    const union = model.unions.find((u) => u.id === id);
    if (!union) {
      return;
    }
    if (Model.UNION_STATUSES.includes(fields.status)) {
      union.status = fields.status;
    }
    if (typeof fields.note === 'string') {
      union.note = fields.note.slice(0, Model.LIMITS.note);
    }
  };

  const removeUnion = (model, id) => {
    model.unions = model.unions.filter((u) => u.id !== id);
    model.persons.forEach((p) => {
      if (p.parentUnionId === id) {
        p.parentUnionId = '';
      }
    });
  };

  const OPPOSITE = { male: 'female', female: 'male', unknown: 'unknown' };

  const addPartner = (model, personId, idGen = defaultIdGenerator) => {
    const person = findPerson(model, personId);
    if (!person) {
      return null;
    }
    const newId = addPerson(model, { gender: OPPOSITE[person.gender] }, idGen);
    const unionId = addUnion(model, personId, newId, 'married', idGen);
    return { personId: newId, unionId };
  };

  const addChild = (model, personId, idGen = defaultIdGenerator) => {
    if (!hasPerson(model, personId)) {
      return null;
    }
    const unions = unionsOf(model, personId);
    const fields =
      unions.length > 0
        ? { parentUnionId: unions[unions.length - 1].id }
        : { parentId: personId };
    return addPerson(model, fields, idGen);
  };

  const addParents = (model, personId, idGen = defaultIdGenerator) => {
    const person = findPerson(model, personId);
    if (!person || person.parentUnionId || person.parentId) {
      return null;
    }
    const fatherId = addPerson(model, { gender: 'male' }, idGen);
    const motherId = addPerson(model, { gender: 'female' }, idGen);
    const unionId = addUnion(model, fatherId, motherId, 'married', idGen);
    // addPersonでpersons配列の参照は変わらないため、取得済みのpersonをそのまま書き換えられる
    person.parentUnionId = unionId;
    return { fatherId, motherId, unionId };
  };

  // ---- 情緒的関係 ----

  const addRelation = (model, a, b, kind, idGen = defaultIdGenerator) => {
    if (a === b || !hasPerson(model, a) || !hasPerson(model, b)) {
      return null;
    }
    const id = idGen('r');
    model.relations.push({
      id,
      a,
      b,
      kind: Model.RELATION_KINDS.includes(kind) ? kind : 'close',
      note: '',
    });
    return id;
  };

  const updateRelation = (model, id, fields) => {
    const relation = model.relations.find((r) => r.id === id);
    if (!relation) {
      return;
    }
    if (Model.RELATION_KINDS.includes(fields.kind)) {
      relation.kind = fields.kind;
    }
    if (typeof fields.note === 'string') {
      relation.note = fields.note.slice(0, Model.LIMITS.note);
    }
  };

  const removeRelation = (model, id) => {
    model.relations = model.relations.filter((r) => r.id !== id);
  };

  // ---- 同居(世帯) ----

  const validMembers = (model, members) =>
    Array.from(new Set((members || []).filter((m) => hasPerson(model, m))));

  const addHousehold = (model, label, members, idGen = defaultIdGenerator) => {
    const valid = validMembers(model, members);
    if (valid.length === 0) {
      return null;
    }
    const id = idGen('h');
    model.households.push({
      id,
      label: String(label || '').slice(0, Model.LIMITS.label),
      members: valid,
    });
    return id;
  };

  const updateHousehold = (model, id, label, members) => {
    const household = model.households.find((h) => h.id === id);
    if (!household) {
      return;
    }
    household.label = String(label || '').slice(0, Model.LIMITS.label);
    household.members = validMembers(model, members);
    if (household.members.length === 0) {
      removeHousehold(model, id);
    }
  };

  const removeHousehold = (model, id) => {
    model.households = model.households.filter((h) => h.id !== id);
  };

  // ---- メモ ----

  const addMemo = (model, memo, idGen = defaultIdGenerator) => {
    const text = String((memo && memo.text) || '');
    if (text.trim() === '') {
      return null;
    }
    const id = idGen('m');
    const author = (memo && memo.author) || {};
    model.memos.push({
      id,
      targetId: hasPerson(model, memo.targetId) ? memo.targetId : '',
      text: text.slice(0, Model.LIMITS.memo),
      author: {
        code: String(author.code || ''),
        name: String(author.name || ''),
      },
      at: String(memo.at || ''),
    });
    return id;
  };

  const removeMemo = (model, id) => {
    model.memos = model.memos.filter((m) => m.id !== id);
  };

  // ---- 位置 ----

  const GRID = 10;

  const setPosition = (model, id, x, y) => {
    const person = findPerson(model, id);
    if (!person || !Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    person.pos = {
      x: Math.round(x / GRID) * GRID,
      y: Math.round(y / GRID) * GRID,
    };
  };

  // ids を渡したときはその人たちだけ、省略時は全員の手動位置を消して自動配置に戻す。
  const clearPositions = (model, ids) => {
    const only = ids ? new Set(ids) : null;
    model.persons.forEach((p) => {
      if (!only || only.has(p.id)) {
        delete p.pos;
      }
    });
  };

  const MIN_POS = 30; // 図の左端・上端からの最小の余白

  // 複数選択した人をまとめて動かす。startNodes は移動開始時点の表示座標({ id: { x, y } })。
  // 相対位置を崩さないよう、各人の座標ではなく移動量を10px単位に丸める。左上にはみ出す場合は、
  // いちばん端の人が余白で止まるよう、全員の移動量をそろえて抑える。
  const moveGroup = (model, ids, startNodes, dx, dy) => {
    const targets = (ids || []).filter(
      (id) => startNodes[id] && findPerson(model, id),
    );
    if (targets.length === 0 || !Number.isFinite(dx) || !Number.isFinite(dy)) {
      return;
    }
    const minX = Math.min(...targets.map((id) => startNodes[id].x));
    const minY = Math.min(...targets.map((id) => startNodes[id].y));
    const moveX = Math.max(Math.round(dx / GRID) * GRID, MIN_POS - minX);
    const moveY = Math.max(Math.round(dy / GRID) * GRID, MIN_POS - minY);
    targets.forEach((id) => {
      findPerson(model, id).pos = {
        x: startNodes[id].x + moveX,
        y: startNodes[id].y + moveY,
      };
    });
  };

  const Ops = {
    defaultIdGenerator,
    addPerson,
    updatePerson,
    removePerson,
    moveSibling,
    descendantsOf,
    parentOptions,
    unionsOf,
    addUnion,
    updateUnion,
    removeUnion,
    addPartner,
    addChild,
    addParents,
    addRelation,
    updateRelation,
    removeRelation,
    addHousehold,
    updateHousehold,
    removeHousehold,
    addMemo,
    removeMemo,
    setPosition,
    clearPositions,
    moveGroup,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Ops;
  } else {
    root.Genogram = root.Genogram || {};
    root.Genogram.Ops = Ops;
  }
})(typeof window !== 'undefined' ? window : globalThis);
