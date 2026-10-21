(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Operations = isNode
    ? require('./operations.js')
    : root.AppSettingsRequest.Operations;
  const TargetFields = isNode
    ? require('./target-fields.js')
    : root.AppSettingsRequest.TargetFields;
  const ViewChanges = isNode
    ? require('./view-changes.js')
    : root.AppSettingsRequest.ViewChanges;

  // 変更内容JSON(asr_change_json)。反映時の唯一の情報源で、編集画面・CSV読み込み・REST APIで
  // 書き換えられ得るため、parseChange()で形式・値の型を厳密に検証し、既知のプロパティだけを取り出す。
  const FORMAT = 'kintone-app-settings-request';
  const VERSION = 1;

  const str = (v) => (v === undefined || v === null ? '' : String(v));
  const isPositiveInteger = (v) => /^[1-9][0-9]*$/.test(v);

  // 対象は「フィールド」(field)か「一覧」(view)のどちらか。使わない側は空文字で持つ。
  const buildChange = ({ app, field, view, operation, before, after }) => {
    const f = field || {};
    const v = view || {};
    return {
      format: FORMAT,
      version: VERSION,
      app: {
        id: str(app.id),
        name: str(app.name),
        guestSpaceId: str(app.guestSpaceId),
      },
      field: {
        code: str(f.code),
        label: str(f.label),
        type: str(f.type),
        subtableCode: str(f.subtableCode),
      },
      view: { id: str(v.id), name: str(v.name) },
      operation,
      before,
      after,
    };
  };

  const serialize = (change) => JSON.stringify(change, null, 2);

  const fail = (error) => ({ ok: false, error });

  const parseChange = (text) => {
    if (!text || !String(text).trim()) {
      return fail('変更内容が入力されていません。');
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return fail('変更内容(JSON)の形式が正しくありません。');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return fail('変更内容(JSON)の形式が正しくありません。');
    }
    if (data.format !== FORMAT || data.version !== VERSION) {
      return fail('このプラグインで作成した変更内容ではありません。');
    }
    const app = data.app || {};
    const field = data.field || {};
    const view = data.view || {};
    if (typeof app.id !== 'string' || !isPositiveInteger(app.id)) {
      return fail('変更内容の対象アプリIDが正しくありません。');
    }
    if (
      typeof app.guestSpaceId !== 'string' ||
      (app.guestSpaceId !== '' && !isPositiveInteger(app.guestSpaceId))
    ) {
      return fail('変更内容のゲストスペースIDが正しくありません。');
    }
    if (ViewChanges.isViewOperation(data.operation)) {
      return parseViewChange(data, app, view);
    }
    if (
      typeof field.code !== 'string' ||
      field.code === '' ||
      typeof field.type !== 'string' ||
      field.type === '' ||
      typeof field.subtableCode !== 'string'
    ) {
      return fail('変更内容の対象フィールドが正しくありません。');
    }
    const error = Operations.validateValue(data.operation, data.after);
    if (error) {
      return fail(error);
    }
    return {
      ok: true,
      change: buildChange({
        app,
        field,
        operation: data.operation,
        before: sameShape(data.before, data.after) ? data.before : null,
        after: data.after,
      }),
    };
  };

  const isViewSnapshot = (v) =>
    !!v &&
    typeof v === 'object' &&
    typeof v.name === 'string' &&
    typeof v.filterCond === 'string' &&
    typeof v.sort === 'string';

  const parseViewChange = (data, app, view) => {
    const op = data.operation;
    if (op === 'viewCreate') {
      if (view.id !== undefined && view.id !== '') {
        return fail('変更内容の対象の一覧が正しくありません。');
      }
    } else if (
      typeof view.id !== 'string' ||
      !isPositiveInteger(view.id) ||
      typeof view.name !== 'string'
    ) {
      return fail('変更内容の対象の一覧が正しくありません。');
    }
    const error = ViewChanges.validateValue(op, data.after);
    if (error) {
      return fail(error);
    }
    const after =
      data.after === null
        ? null
        : {
            name: data.after.name,
            filterCond: data.after.filterCond,
            sort: data.after.sort,
            ...(op === 'viewCreate'
              ? { fields: data.after.fields.slice() }
              : {}),
            sourceUrl: data.after.sourceUrl,
          };
    const before =
      op !== 'viewCreate' && isViewSnapshot(data.before)
        ? {
            name: data.before.name,
            filterCond: data.before.filterCond,
            sort: data.before.sort,
          }
        : null;
    return {
      ok: true,
      change: buildChange({ app, view, operation: op, before, after }),
    };
  };

  // before(依頼時の値)は表示と注記にしか使わないため、afterと同じ形でなければnullにして扱う。
  const sameShape = (before, after) => {
    if (before === null || before === undefined || after === null) {
      return false;
    }
    if (Array.isArray(after)) {
      return (
        Array.isArray(before) && before.every((v) => typeof v === 'string')
      );
    }
    if (typeof after === 'object') {
      return (
        typeof before === 'object' &&
        !Array.isArray(before) &&
        typeof before.min === 'string' &&
        typeof before.max === 'string'
      );
    }
    return typeof before === typeof after;
  };

  const fieldText = (field) => {
    const base = `${field.label}(${field.code})`;
    return field.subtableCode
      ? `テーブル(${field.subtableCode}) > ${base}`
      : base;
  };

  // 反映APIのリクエスト(app・revisionは呼び出し側で付ける)を、反映直前の対象アプリのフィールド定義
  // (動作テスト環境のproperties)から組み立てる。
  const buildApplyRequest = (change, properties) => {
    const { field, operation, after } = change;
    const def = TargetFields.findField(
      properties,
      field.code,
      field.subtableCode,
    );
    if (!def) {
      return fail(
        `対象フィールド「${fieldText(field)}」が見つかりません。依頼後に削除・移動された可能性があります。`,
      );
    }
    if (def.type !== field.type) {
      return fail(
        `対象フィールド「${fieldText(field)}」の種類が依頼時(${field.type})から変わっています(現在: ${def.type})。`,
      );
    }
    const error = Operations.validateValue(operation, after, def, {
      existingCodes: TargetFields.collectCodes(properties),
    });
    if (error) {
      return fail(error);
    }

    const notes = [];
    const current = Operations.currentValue(operation, def);
    if (
      operation !== 'delete' &&
      JSON.stringify(current) !== JSON.stringify(change.before)
    ) {
      notes.push(
        `依頼後に設定が変更されていました(依頼時: ${Operations.formatValue(operation, change.before)} / 反映直前: ${Operations.formatValue(operation, current)})。依頼内容で上書きしました。`,
      );
    }

    if (operation === 'delete') {
      return {
        ok: true,
        method: 'DELETE',
        body: { fields: [field.code] },
        notes,
      };
    }

    const built = Operations.buildPropertyPatch(operation, after, def);
    const fieldProps = { type: def.type, ...built.patch };
    const propertiesBody = field.subtableCode
      ? {
          [field.subtableCode]: {
            type: 'SUBTABLE',
            fields: { [field.code]: fieldProps },
          },
        }
      : { [field.code]: fieldProps };
    return {
      ok: true,
      method: 'PUT',
      body: { properties: propertiesBody },
      notes: notes.concat(built.notes),
    };
  };

  // 一覧の変更を反映するリクエスト(PUT preview/app/views.json の views)を、反映直前の全一覧から組み立てる。
  const buildViewApplyRequest = (change, previewViews) => {
    const built = ViewChanges.buildViewsPayload(change, previewViews);
    if (!built.ok) {
      return built;
    }
    return {
      ok: true,
      method: 'PUT',
      body: { views: built.views },
      notes: built.notes,
    };
  };

  const viewTargetText = (change) =>
    change.operation === 'viewCreate'
      ? `新しい一覧「${change.after ? change.after.name : ''}」`
      : `一覧「${change.view.name}」`;

  const summarizeView = (change) => ({
    appText: `${change.app.name}(アプリID: ${change.app.id})`,
    targetLabel: '対象の一覧',
    targetText: viewTargetText(change),
    operationName: ViewChanges.operationName(change.operation),
    beforeText:
      change.operation === 'viewCreate'
        ? '-'
        : change.before
          ? ViewChanges.describe(change.before)
          : '(不明)',
    afterText: ViewChanges.describe(change.after),
    warnings: ViewChanges.warningsFor(change.operation),
  });

  const summarize = (change) =>
    ViewChanges.isViewOperation(change.operation)
      ? summarizeView(change)
      : summarizeField(change);

  const summarizeField = (change) => ({
    appText: `${change.app.name}(アプリID: ${change.app.id})`,
    targetLabel: '対象フィールド',
    targetText: fieldText(change.field),
    operationName: Operations.operationName(change.operation),
    beforeText:
      change.operation === 'delete'
        ? '-'
        : Operations.formatValue(change.operation, change.before),
    afterText: Operations.formatValue(
      change.operation,
      change.after,
      change.before,
    ),
    warnings: Operations.warningsFor(
      change.operation,
      change.after,
      change.before,
    ),
  });

  // 完了アクション前の確認(モバイルの確認ボトムシートは本文が文字列のみのため、テキストで組み立てる)。
  const CONFIRM_NOTICE =
    'OKを押すと、あなたの権限で対象アプリの設定を変更し、運用環境へ反映(アプリを更新)します。';

  const confirmationText = (change) => {
    const s = summarize(change);
    const item = (label, value) =>
      value.includes('\n') ? `${label}:\n${value}` : `${label}: ${value}`;
    const lines = [
      item('対象アプリ', s.appText),
      item(s.targetLabel, s.targetText),
      item('変更内容', s.operationName),
      item('変更前', s.beforeText),
      item('変更後', s.afterText),
    ];
    if (s.warnings.length > 0) {
      lines.push('', ...s.warnings.map((w) => `※ ${w}`));
    }
    lines.push('', CONFIRM_NOTICE);
    return lines.join('\n');
  };

  const ChangeRequest = {
    CONFIRM_NOTICE,
    confirmationText,
    FORMAT,
    VERSION,
    buildChange,
    serialize,
    parseChange,
    buildApplyRequest,
    buildViewApplyRequest,
    summarize,
    fieldText,
  };

  if (isNode) {
    module.exports = ChangeRequest;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.ChangeRequest = ChangeRequest;
  }
})(typeof window !== 'undefined' ? window : globalThis);
