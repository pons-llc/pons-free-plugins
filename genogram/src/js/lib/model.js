(function (root) {
  'use strict';

  // ジェノグラムのデータ(JSON)の読み込み・正規化・書き出し。
  // 文字列(複数行)フィールドの値は利用者が直接書き換えることもできるため、読み込むたびに必ず正規化し、
  // 壊れた参照(存在しない人物を指す夫婦・関係・親)や未知の値を取り除いてから描画・編集する。

  const VERSION = 1;

  const GENDERS = ['male', 'female', 'unknown'];
  const UNION_STATUSES = ['married', 'cohabiting', 'separated', 'divorced'];
  const RELATION_KINDS = ['close', 'conflict', 'distant', 'cutoff'];
  const CHILD_TYPES = ['biological', 'adopted', 'foster'];

  const LABELS = {
    gender: { male: '男性', female: '女性', unknown: '不明・その他' },
    unionStatus: {
      married: '婚姻',
      cohabiting: '内縁・事実婚・交際',
      separated: '別居',
      divorced: '離婚',
    },
    relationKind: {
      close: '親密',
      conflict: '対立',
      distant: '疎遠',
      cutoff: '断絶',
    },
    childType: { biological: '実子', adopted: '養子', foster: '里子' },
  };

  const LIMITS = {
    id: 40,
    name: 100,
    age: 20,
    note: 500,
    label: 100,
    memo: 2000,
    userCode: 128,
    userName: 128,
    at: 40,
  };

  const empty = () => ({
    version: VERSION,
    persons: [],
    unions: [],
    relations: [],
    households: [],
    memos: [],
  });

  const str = (value, limit) =>
    typeof value === 'string' ? value.slice(0, limit) : '';

  // 年齢は手書きのJSONで数値として書かれることがあるため、数値も文字列にそろえる。
  const strOrNumber = (value, limit) =>
    typeof value === 'number' && Number.isFinite(value)
      ? String(value).slice(0, limit)
      : str(value, limit);

  const oneOf = (value, allowed, fallback) =>
    allowed.includes(value) ? value : fallback;

  const arr = (value) => (Array.isArray(value) ? value : []);

  const isObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  const normalizePos = (pos) => {
    if (!isObject(pos)) {
      return undefined;
    }
    const { x, y } = pos;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return undefined;
    }
    return { x, y };
  };

  const normalizePerson = (p) => {
    const person = {
      id: str(p.id, LIMITS.id),
      name: str(p.name, LIMITS.name),
      gender: oneOf(p.gender, GENDERS, 'unknown'),
      age: strOrNumber(p.age, LIMITS.age),
      deceased: p.deceased === true,
      isClient: p.isClient === true,
      note: str(p.note, LIMITS.note),
      parentUnionId: str(p.parentUnionId, LIMITS.id),
      parentId: str(p.parentId, LIMITS.id),
      childType: oneOf(p.childType, CHILD_TYPES, 'biological'),
    };
    const pos = normalizePos(p.pos);
    if (pos) {
      person.pos = pos;
    }
    return person;
  };

  // 同じidの要素は先に出てきたものだけを残す。
  const uniqueById = (items) => {
    const seen = new Set();
    return items.filter((item) => {
      if (!item.id || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  };

  const normalize = (raw) => {
    const src = isObject(raw) ? raw : {};
    const model = empty();

    model.persons = uniqueById(
      arr(src.persons).filter(isObject).map(normalizePerson),
    );
    const personIds = new Set(model.persons.map((p) => p.id));

    const pairKeys = new Set();
    model.unions = uniqueById(
      arr(src.unions)
        .filter(isObject)
        .map((u) => ({
          id: str(u.id, LIMITS.id),
          a: str(u.a, LIMITS.id),
          b: str(u.b, LIMITS.id),
          status: oneOf(u.status, UNION_STATUSES, 'married'),
          note: str(u.note, LIMITS.note),
        })),
    ).filter((u) => {
      if (!personIds.has(u.a) || !personIds.has(u.b) || u.a === u.b) {
        return false;
      }
      const key = [u.a, u.b].sort().join('\n');
      if (pairKeys.has(key)) {
        return false;
      }
      pairKeys.add(key);
      return true;
    });
    const unionById = new Map(model.unions.map((u) => [u.id, u]));

    model.persons.forEach((p) => {
      const union = unionById.get(p.parentUnionId);
      if (!union || union.a === p.id || union.b === p.id) {
        p.parentUnionId = '';
      }
      if (
        p.parentUnionId ||
        !personIds.has(p.parentId) ||
        p.parentId === p.id
      ) {
        p.parentId = '';
      }
    });

    model.relations = uniqueById(
      arr(src.relations)
        .filter(isObject)
        .map((r) => ({
          id: str(r.id, LIMITS.id),
          a: str(r.a, LIMITS.id),
          b: str(r.b, LIMITS.id),
          kind: oneOf(r.kind, RELATION_KINDS, 'close'),
          note: str(r.note, LIMITS.note),
        })),
    ).filter((r) => personIds.has(r.a) && personIds.has(r.b) && r.a !== r.b);

    model.households = uniqueById(
      arr(src.households)
        .filter(isObject)
        .map((h) => ({
          id: str(h.id, LIMITS.id),
          label: str(h.label, LIMITS.label),
          members: Array.from(
            new Set(
              arr(h.members).filter(
                (m) => typeof m === 'string' && personIds.has(m),
              ),
            ),
          ),
        })),
    ).filter((h) => h.members.length > 0);

    model.memos = uniqueById(
      arr(src.memos)
        .filter(isObject)
        .map((m) => {
          const author = isObject(m.author) ? m.author : {};
          const targetId = str(m.targetId, LIMITS.id);
          return {
            id: str(m.id, LIMITS.id),
            targetId: personIds.has(targetId) ? targetId : '',
            text: str(m.text, LIMITS.memo),
            author: {
              code: str(author.code, LIMITS.userCode),
              name: str(author.name, LIMITS.userName),
            },
            at: str(m.at, LIMITS.at),
          };
        }),
    ).filter((m) => m.text.trim() !== '');

    return model;
  };

  // 戻り値: { ok: true, model } | { ok: false, error }
  const parse = (raw) => {
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      return { ok: true, model: empty() };
    }
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch (e) {
      return { ok: false, error: e.message };
    }
    if (!isObject(data)) {
      return { ok: false, error: 'JSONの最上位がオブジェクトではありません' };
    }
    return { ok: true, model: normalize(data) };
  };

  const serialize = (model) => JSON.stringify(normalize(model));

  const pad = (n) => String(n).padStart(2, '0');

  const formatDateTime = (iso) => {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const Model = {
    VERSION,
    GENDERS,
    UNION_STATUSES,
    RELATION_KINDS,
    CHILD_TYPES,
    LABELS,
    LIMITS,
    empty,
    normalize,
    normalizePerson,
    parse,
    serialize,
    formatDateTime,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Model;
  } else {
    root.Genogram = root.Genogram || {};
    root.Genogram.Model = Model;
  }
})(typeof window !== 'undefined' ? window : globalThis);
