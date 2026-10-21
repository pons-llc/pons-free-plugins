(function (root) {
  'use strict';

  // 「選択肢の変更」の値: 変更後の並び順どおりの [{ from, label }] 。
  //   from  … 変更前の選択肢名(追加する選択肢は空文字)
  //   label … 変更後の選択肢名
  // 一覧に無い既存の選択肢は削除になる。
  //
  // 検証環境で確認した挙動(2026-10-21、アプリ791):
  //   - 並べ替え・追加: 既存レコードの値・絞り込み条件は変わらず、グラフは新しい選択肢の順に並ぶ
  //   - 名前の変更(キー=変更前の名前、label=変更後の名前): 既存レコードの値も、一覧・グラフの
  //     絞り込み条件(filterCond)もkintoneが新しい名前に書き換える
  //   - 削除: 既存レコードの値は残り、絞り込み条件も古い名前のまま。グラフでは末尾に並ぶ
  // そのため名前の変更は「削除+追加」ではなく、キーに変更前の名前を指定して送る。

  const str = (v) => (v === undefined || v === null ? '' : String(v));

  // 画面の行 [{ from, label, deleted }] を値にする。
  const normalizeRows = (rows) =>
    (rows || [])
      .filter((row) => !row.deleted)
      .map((row) => ({ from: str(row.from), label: str(row.label).trim() }))
      .filter((entry) => entry.from !== '' || entry.label !== '');

  const isEntry = (v) =>
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof v.from === 'string' &&
    typeof v.label === 'string';

  // currentLabelsを渡すと、対象フィールドの現在の選択肢に照らした検証も行う。
  const validateEntries = (entries, currentLabels) => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return '選択肢を1つ以上指定してください。';
    }
    if (!entries.every(isEntry)) {
      return '選択肢の指定が正しくありません。';
    }
    if (entries.some((x) => x.label.trim() === '')) {
      return '空の選択肢名は指定できません。';
    }
    const labels = entries.map((x) => x.label);
    const dup = labels.find((l, i) => labels.indexOf(l) !== i);
    if (dup !== undefined) {
      return `選択肢「${dup}」が重複しています。`;
    }
    const froms = entries.map((x) => x.from).filter((f) => f !== '');
    const dupFrom = froms.find((f, i) => froms.indexOf(f) !== i);
    if (dupFrom !== undefined) {
      return `既存の選択肢「${dupFrom}」が2回指定されています。`;
    }
    if (!currentLabels) {
      return '';
    }
    const missing = froms.find((f) => !currentLabels.includes(f));
    if (missing !== undefined) {
      return `変更元の選択肢「${missing}」が見つかりません。依頼後に選択肢が変更された可能性があります。`;
    }
    // 追加・名前変更の結果が「別の既存の選択肢の名前」になると、入れ替え・統合になり
    // 既存レコードの値が意図せず変わるため認めない(名前変更はkintoneがレコードの値も書き換える)。
    const clash = entries.find(
      (x) => x.label !== x.from && currentLabels.includes(x.label),
    );
    if (clash) {
      return `「${clash.label}」は既存の選択肢名のため、追加・名前の変更には使えません。`;
    }
    return '';
  };

  const renamed = (entries) =>
    entries.filter((x) => x.from !== '' && x.from !== x.label);

  const deletedLabels = (beforeLabels, entries) => {
    const used = new Set(entries.map((x) => x.from));
    return (beforeLabels || []).filter((l) => !used.has(l));
  };

  const isNoop = (beforeLabels, entries) =>
    Array.isArray(beforeLabels) &&
    beforeLabels.length === entries.length &&
    entries.every((x, i) => x.from === beforeLabels[i] && x.label === x.from);

  // 選択肢の変更後の初期値。名前の変更は追従し、削除された選択肢は外す
  // (外さないとAPIが「初期値が選択肢にない」エラーになる)。変わらなければnull。
  const nextDefault = (def, entries) => {
    if (!Object.prototype.hasOwnProperty.call(def, 'defaultValue')) {
      return null;
    }
    const map = {};
    entries.forEach((x) => {
      if (x.from !== '') {
        map[x.from] = x.label;
      }
    });
    const current = def.defaultValue;
    if (Array.isArray(current)) {
      const next = current
        .filter((v) => map[v] !== undefined)
        .map((v) => map[v]);
      return JSON.stringify(next) === JSON.stringify(current) ? null : next;
    }
    if (current === '') {
      return null;
    }
    if (map[current] !== undefined) {
      return map[current] === current ? null : map[current];
    }
    return def.type === 'RADIO_BUTTON' ? entries[0].label : '';
  };

  const formatDefault = (v) => {
    if (Array.isArray(v)) {
      return v.length === 0 ? '(なし)' : v.join('、');
    }
    return v === '' ? '(なし)' : v;
  };

  const buildOptionsPatch = (entries, def) => {
    const options = {};
    entries.forEach((x, index) => {
      // キーは変更前の名前(名前の変更)、追加は変更後の名前(「フィールドの設定を変更するAPI」の仕様)。
      options[x.from || x.label] = { label: x.label, index: String(index) };
    });
    const patch = { options };
    const notes = [];
    const fixed = nextDefault(def, entries);
    if (fixed !== null) {
      patch.defaultValue = fixed;
      notes.push(
        `選択肢の変更に合わせて初期値を「${formatDefault(fixed)}」にしました。`,
      );
    }
    return { patch, notes };
  };

  const describe = (beforeLabels, entries) => {
    const lines = entries.map((x) => {
      if (x.from === '') {
        return `${x.label}(追加)`;
      }
      return x.from === x.label
        ? x.label
        : `${x.from} → ${x.label}(名前を変更)`;
    });
    deletedLabels(beforeLabels, entries).forEach((l) =>
      lines.push(`${l}(削除)`),
    );
    return lines.join('\n');
  };

  const OptionChanges = {
    normalizeRows,
    validateEntries,
    renamed,
    deletedLabels,
    isNoop,
    buildOptionsPatch,
    describe,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptionChanges;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.OptionChanges = OptionChanges;
  }
})(typeof window !== 'undefined' ? window : globalThis);
