(function (root) {
  'use strict';

  // 一覧の作成・修正・削除(PUT /k/v1/preview/app/views.json)。
  // このAPIは「送らなかった一覧は削除」される仕様のため、毎回、反映直前に取得した全一覧を送り返す。
  // GETで返ってきた一覧(id・builtinTypeを含む)をそのままPUTしても変更されないこと、一覧名を変えても
  // idは変わらないこと、存在しないフィールドを使った条件・同じ名前の一覧はkintoneがエラーにすることを
  // 検証環境で確認済み(2026-10-21)。
  const VIEW_OPERATIONS = [
    { id: 'viewCreate', name: '一覧の作成' },
    { id: 'viewUpdate', name: '一覧の修正' },
    { id: 'viewDelete', name: '一覧の削除' },
  ];
  const VIEW_OPERATION_IDS = VIEW_OPERATIONS.map((op) => op.id);

  // 一覧名の上限(一覧の設定を変更するAPI: views.<name>.name は64文字以内)。
  const MAX_NAME_LENGTH = 64;

  const isViewOperation = (op) => VIEW_OPERATION_IDS.includes(op);

  const operationName = (op) =>
    (VIEW_OPERATIONS.find((o) => o.id === op) || { name: op }).name;

  // 「（作業者が自分）」(builtinType: ASSIGNEE)はプロセス管理の標準の一覧のため、カスタマイズ形式は
  // 変更にkintoneシステム管理権限が必要でHTMLを扱うため、どちらも修正・削除の対象にしない。
  const isEditable = (view) => !view.builtinType && view.type !== 'CUSTOM';

  const editableViews = (views) =>
    Object.keys(views || {})
      .map((key) => views[key])
      .filter(isEditable)
      .sort((a, b) => Number(a.index) - Number(b.index));

  const isPlainObject = (v) =>
    !!v && typeof v === 'object' && !Array.isArray(v);

  const validateName = (name) => {
    if (typeof name !== 'string' || name.trim() === '') {
      return '一覧名を入力してください。';
    }
    if (name.length > MAX_NAME_LENGTH) {
      return `一覧名は${MAX_NAME_LENGTH}文字以内で入力してください。`;
    }
    return '';
  };

  const validateValue = (op, value) => {
    if (op === 'viewDelete') {
      return value === null ? '' : '設定値が正しくありません。';
    }
    if (!isViewOperation(op)) {
      return `未対応の変更内容です: ${op}`;
    }
    if (!isPlainObject(value)) {
      return '一覧の設定が正しくありません。';
    }
    const nameError = validateName(value.name);
    if (nameError) {
      return nameError;
    }
    if (
      typeof value.filterCond !== 'string' ||
      typeof value.sort !== 'string' ||
      typeof value.sourceUrl !== 'string'
    ) {
      return '一覧の絞り込み条件・並び順が正しくありません。';
    }
    if (op === 'viewCreate') {
      if (
        !Array.isArray(value.fields) ||
        value.fields.length === 0 ||
        !value.fields.every((f) => typeof f === 'string' && f !== '')
      ) {
        return '一覧に表示するフィールドを1つ以上選んでください。';
      }
    }
    return '';
  };

  const currentValue = (view) => ({
    name: view.name,
    filterCond: view.filterCond || '',
    sort: view.sort || '',
  });

  const findKeyById = (views, id) =>
    Object.keys(views || {}).find(
      (key) => String(views[key].id) === String(id),
    );

  const nameTaken = (views, name, exceptKey) =>
    Object.keys(views || {}).some(
      (key) => key !== exceptKey && (views[key].name || key) === name,
    );

  const fail = (error) => ({ ok: false, error });

  // change: { operation, view: { id, name }, before, after }。previewViewsは反映直前の全一覧。
  const buildViewsPayload = (change, previewViews) => {
    const views = { ...(previewViews || {}) };
    const { operation, after } = change;
    const notes = [];

    if (operation === 'viewCreate') {
      if (nameTaken(views, after.name, null)) {
        return fail(`「${after.name}」と同じ名前の一覧が既にあります。`);
      }
      const maxIndex = Object.keys(views).reduce(
        (max, key) => Math.max(max, Number(views[key].index)),
        -1,
      );
      views[after.name] = {
        type: 'LIST',
        name: after.name,
        index: String(maxIndex + 1),
        fields: after.fields.slice(),
        filterCond: after.filterCond,
        sort: after.sort,
      };
      return { ok: true, views, notes };
    }

    const key = findKeyById(views, change.view.id);
    if (!key) {
      return fail(
        `対象の一覧「${change.view.name}」が見つかりません。依頼後に削除された可能性があります。`,
      );
    }
    if (!isEditable(views[key])) {
      return fail(
        `一覧「${views[key].name}」は、標準の一覧またはカスタマイズ形式のため変更できません。`,
      );
    }
    if (operation === 'viewDelete') {
      delete views[key];
      return { ok: true, views, notes };
    }
    if (nameTaken(views, after.name, key)) {
      return fail(`「${after.name}」と同じ名前の一覧が既にあります。`);
    }
    const current = currentValue(views[key]);
    if (
      change.before &&
      JSON.stringify(current) !== JSON.stringify(change.before)
    ) {
      notes.push(
        `依頼後に一覧の設定が変更されていました(反映直前: ${describe(current).replace(/\n/g, ' / ')})。依頼内容で上書きしました。`,
      );
    }
    // キーは変更前の一覧名(名前の変更は name に新しい名前を指定する。APIの仕様)。
    views[key] = {
      ...views[key],
      name: after.name,
      filterCond: after.filterCond,
      sort: after.sort,
    };
    return { ok: true, views, notes };
  };

  const describe = (value) => {
    if (value === null || value === undefined) {
      return '一覧を削除';
    }
    const lines = [
      `一覧名: ${value.name}`,
      `絞り込み条件: ${value.filterCond || '(すべてのレコード)'}`,
      `並び順: ${value.sort || '(指定なし)'}`,
    ];
    if (Array.isArray(value.fields)) {
      lines.push(`表示するフィールド: ${value.fields.join('、')}`);
    }
    return lines.join('\n');
  };

  const warningsFor = (op) => {
    switch (op) {
      case 'viewDelete':
        return [
          '一覧を削除すると元に戻せません。この一覧をブックマークやリンクで開いている人は開けなくなります。',
        ];
      case 'viewUpdate':
        return [
          'この一覧を使っている人の表示(絞り込み・並び順)が変わります。表示するフィールドは変更しません。',
        ];
      default:
        return [];
    }
  };

  // 一覧に表示できないフィールド(グループ・テーブル・関連レコード一覧・カテゴリー)。テーブル内のフィールドも扱わない。
  const NOT_LISTABLE = new Set([
    'GROUP',
    'SUBTABLE',
    'REFERENCE_TABLE',
    'CATEGORY',
  ]);
  // ステータス・作業者はプロセス管理が無効のアプリでもフィールド定義に含まれるが、一覧に入れると
  // 「プロセス管理機能が無効に設定されています」エラーになる(実環境で確認)ため、無効なら除く。
  const PROCESS_TYPES = new Set(['STATUS', 'STATUS_ASSIGNEE']);

  // フォームのレイアウト(GET .../form/layout.json の layout)に置かれたフィールドコードを配置順に並べる。
  const layoutCodes = (layout) => {
    const codes = [];
    (layout || []).forEach((row) => {
      if (row.type === 'GROUP') {
        codes.push(...layoutCodes(row.layout));
      } else if (row.type === 'ROW') {
        (row.fields || []).forEach((f) => f.code && codes.push(f.code));
      }
    });
    return codes;
  };

  // 一覧の作成で選べる表示フィールドの候補と、初期値でチェックするフィールド。
  // 並びは「レコード番号 → フォームの配置順 → 配置されていないもの(作成者・更新日時等)」。
  // 初期値は、作成者・更新者・作成日時・更新日時などフォームに置かれていないものを除く。
  const listableFields = (properties, layout, processEnabled) => {
    const defs = Object.keys(properties || {})
      .map((code) => properties[code])
      .filter(
        (def) =>
          !NOT_LISTABLE.has(def.type) &&
          (processEnabled || !PROCESS_TYPES.has(def.type)),
      );
    const placed = layoutCodes(layout);
    const rank = (def) => {
      if (def.type === 'RECORD_NUMBER') {
        return -1;
      }
      const i = placed.indexOf(def.code);
      return i === -1 ? placed.length : i;
    };
    const fields = defs
      .map((def, i) => ({ def, i }))
      .sort((a, b) => rank(a.def) - rank(b.def) || a.i - b.i)
      .map(({ def }) => ({ code: def.code, label: def.label, type: def.type }));
    const defaultChecked = fields
      .filter(
        (f) =>
          f.type === 'RECORD_NUMBER' ||
          PROCESS_TYPES.has(f.type) ||
          placed.includes(f.code),
      )
      .map((f) => f.code);
    return { fields, defaultChecked };
  };

  const ViewChanges = {
    listableFields,
    VIEW_OPERATIONS,
    VIEW_OPERATION_IDS,
    isViewOperation,
    operationName,
    editableViews,
    validateValue,
    currentValue,
    buildViewsPayload,
    describe,
    warningsFor,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewChanges;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.ViewChanges = ViewChanges;
  }
})(typeof window !== 'undefined' ? window : globalThis);
