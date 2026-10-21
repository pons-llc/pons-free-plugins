(function (root) {
  'use strict';

  const OptionChanges =
    typeof module !== 'undefined' && module.exports
      ? require('./option-changes.js')
      : root.AppSettingsRequest.OptionChanges;

  // 1件の依頼で行える「変更内容」の定義。どの変更内容を選べるかは、対象フィールドの定義
  // (GET /k/v1/app/form/fields.json のproperties.<code>)にそのプロパティがあるかで決める
  // (「フィールドの設定を変更するAPI」のリクエストパラメーターに対応。kintoneドキュメントMCPで確認済み)。
  const OPERATIONS = [
    { id: 'label', name: 'フィールド名の変更' },
    { id: 'code', name: 'フィールドコードの変更' },
    { id: 'noLabel', name: 'フィールド名の表示/非表示' },
    { id: 'required', name: '必須項目の設定' },
    { id: 'unique', name: '値の重複禁止の設定' },
    { id: 'defaultValue', name: '初期値の変更' },
    { id: 'options', name: '選択肢の変更' },
    { id: 'length', name: '文字数の制限' },
    { id: 'range', name: '値の範囲' },
    { id: 'delete', name: 'フィールドの削除' },
  ];
  const OPERATION_IDS = OPERATIONS.map((op) => op.id);

  // 「フィールドの設定を変更する/削除するAPI」の制限事項で変更・削除できないフィールド。
  const EXCLUDED_TYPES = new Set(['STATUS', 'STATUS_ASSIGNEE', 'CATEGORY']);

  // グループ・テーブルを削除すると中のフィールドもすべて消える(削除APIの補足)ため、依頼の対象にしない。
  // システムフィールドは削除してもフォームから消えるだけでデータは残り、意味のある依頼にならないため除外する。
  const UNDELETABLE_TYPES = new Set([
    'GROUP',
    'SUBTABLE',
    'RECORD_NUMBER',
    'CREATOR',
    'MODIFIER',
    'CREATED_TIME',
    'UPDATED_TIME',
  ]);

  // 初期値を変更できる種類。日付・時刻・日時は「レコード登録時の日時を初期値にする」(defaultNowValue)が
  // 優先されるなど関係が複雑、ユーザー/組織/グループ選択は{type, code}の配列で入力が煩雑なため対象外。
  const DEFAULT_VALUE_TYPES = new Set([
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'NUMBER',
    'LINK',
    'RADIO_BUTTON',
    'DROP_DOWN',
    'CHECK_BOX',
    'MULTI_SELECT',
  ]);
  const MULTI_VALUE_TYPES = new Set(['CHECK_BOX', 'MULTI_SELECT']);

  const BOOLEAN_LABELS = {
    noLabel: { true: '表示しない', false: '表示する' },
    required: { true: '必須', false: '任意' },
    unique: { true: '重複を禁止する', false: '重複を許可する' },
  };

  const has = (def, prop) =>
    !!def && Object.prototype.hasOwnProperty.call(def, prop);

  const isTruthy = (v) => v === true || v === 'true';

  const operationName = (id) => {
    const op = OPERATIONS.find((o) => o.id === id);
    return op ? op.name : id;
  };

  const applicableOperations = (def) => {
    if (!def || EXCLUDED_TYPES.has(def.type)) {
      return [];
    }
    const ops = ['label', 'code'];
    ['noLabel', 'required', 'unique'].forEach((prop) => {
      if (has(def, prop)) {
        ops.push(prop);
      }
    });
    if (
      has(def, 'defaultValue') &&
      DEFAULT_VALUE_TYPES.has(def.type) &&
      !def.lookup &&
      !def.expression
    ) {
      ops.push('defaultValue');
    }
    if (has(def, 'options')) {
      ops.push('options');
    }
    if (has(def, 'maxLength')) {
      ops.push('length');
    }
    if (has(def, 'maxValue')) {
      ops.push('range');
    }
    if (!UNDELETABLE_TYPES.has(def.type)) {
      ops.push('delete');
    }
    return ops;
  };

  // 選択肢(options)はオブジェクトのキー順ではなくindexの昇順で並ぶ。
  const optionLabels = (def) =>
    Object.keys((def && def.options) || {})
      .map((key) => def.options[key])
      .sort((a, b) => Number(a.index) - Number(b.index))
      .map((o) => o.label);

  const str = (v) => (v === undefined || v === null ? '' : String(v));

  const currentValue = (op, def) => {
    switch (op) {
      case 'label':
        return str(def.label);
      case 'code':
        return str(def.code);
      case 'noLabel':
      case 'required':
      case 'unique':
        return isTruthy(def[op]);
      case 'defaultValue':
        return Array.isArray(def.defaultValue)
          ? def.defaultValue.slice()
          : str(def.defaultValue);
      case 'options':
        return optionLabels(def);
      case 'length':
        return { min: str(def.minLength), max: str(def.maxLength) };
      case 'range':
        return { min: str(def.minValue), max: str(def.maxValue) };
      default:
        return null;
    }
  };

  // 画面の入力値を変更内容JSONに保存する形にそろえる。
  const normalizeInput = (op, raw) => {
    switch (op) {
      case 'label':
      case 'code':
        return str(raw).trim();
      case 'options':
        // 画面の行 [{ from, label, deleted }] → [{ from, label }](option-changes.js参照)
        return OptionChanges.normalizeRows(raw);
      case 'length':
      case 'range':
        return {
          min: str(raw && raw.min).trim(),
          max: str(raw && raw.max).trim(),
        };
      case 'defaultValue':
        return Array.isArray(raw) ? raw.map(str) : str(raw);
      case 'delete':
        return null;
      default:
        return raw;
    }
  };

  // kintoneのフィールドコードに使えない文字: 空白と、_ 以外の半角記号。先頭に数字は不可
  // (kintoneヘルプ「フィールドコードに使用できる文字」の記憶値。最終的な判定はAPIに任せる)。
  const INVALID_CODE_CHAR = /[\s!-/:-@[-^`{-~]/;
  const MAX_CODE_LENGTH = 128;

  const INTEGER = /^[0-9]+$/;
  const DECIMAL = /^-?[0-9]+(\.[0-9]+)?$/;

  const isStringArray = (v) =>
    Array.isArray(v) && v.every((x) => typeof x === 'string');

  const validateBounds = (value, pattern, unitLabel) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return `${unitLabel}の指定が正しくありません。`;
    }
    const { min, max } = value;
    if (typeof min !== 'string' || typeof max !== 'string') {
      return `${unitLabel}の指定が正しくありません。`;
    }
    if (min !== '' && !pattern.test(min)) {
      return `最小の${unitLabel}が正しくありません: ${min}`;
    }
    if (max !== '' && !pattern.test(max)) {
      return `最大の${unitLabel}が正しくありません: ${max}`;
    }
    if (min !== '' && max !== '' && Number(min) > Number(max)) {
      return `最小の${unitLabel}が最大より大きくなっています。`;
    }
    return '';
  };

  // 値の形を検証する。defを渡すと、対象フィールドの現在の定義(選択肢・種類・アプリ内の既存コード)に
  // 照らした検証も行う。エラーなら文言、問題なければ空文字を返す。
  const validateValue = (op, value, def, ctx) => {
    if (!OPERATION_IDS.includes(op)) {
      return `未対応の変更内容です: ${op}`;
    }
    if (def && !applicableOperations(def).includes(op)) {
      return `このフィールドでは「${operationName(op)}」は変更できません。`;
    }
    switch (op) {
      case 'label':
        if (typeof value !== 'string') {
          return 'フィールド名が正しくありません。';
        }
        return value === '' ? '新しいフィールド名を入力してください。' : '';
      case 'code': {
        if (typeof value !== 'string' || value === '') {
          return '新しいフィールドコードを入力してください。';
        }
        if (value.length > MAX_CODE_LENGTH) {
          return `フィールドコードは${MAX_CODE_LENGTH}文字以内で入力してください。`;
        }
        if (/^[0-9]/.test(value) || INVALID_CODE_CHAR.test(value)) {
          return 'フィールドコードには、空白・半角記号(_ 以外)は使えず、先頭に数字は使えません。';
        }
        const existing = (ctx && ctx.existingCodes) || null;
        if (existing && existing.has(value) && (!def || value !== def.code)) {
          return `フィールドコード「${value}」は既にアプリ内で使われています。`;
        }
        return '';
      }
      case 'noLabel':
      case 'required':
      case 'unique':
        return typeof value === 'boolean' ? '' : '設定値が正しくありません。';
      case 'defaultValue': {
        if (typeof value !== 'string' && !isStringArray(value)) {
          return '初期値が正しくありません。';
        }
        if (!def) {
          return '';
        }
        const multi = MULTI_VALUE_TYPES.has(def.type);
        if (multi !== Array.isArray(value)) {
          return '初期値の形式がフィールドの種類と合いません。';
        }
        if (has(def, 'options')) {
          const labels = optionLabels(def);
          const values = multi ? value : value === '' ? [] : [value];
          const missing = values.filter((v) => !labels.includes(v));
          if (missing.length > 0) {
            return `初期値「${missing.join('、')}」は選択肢にありません。`;
          }
          if (def.type === 'RADIO_BUTTON' && value === '') {
            return 'ラジオボタンの初期値は空にできません。';
          }
        }
        if (def.type === 'NUMBER' && value !== '' && !DECIMAL.test(value)) {
          return `初期値が数値ではありません: ${value}`;
        }
        return '';
      }
      case 'options':
        return OptionChanges.validateEntries(
          value,
          def ? optionLabels(def) : null,
        );
      case 'length':
        return validateBounds(value, INTEGER, '文字数');
      case 'range':
        return validateBounds(value, DECIMAL, '値');
      case 'delete':
        return value === null ? '' : '設定値が正しくありません。';
      default:
        return `未対応の変更内容です: ${op}`;
    }
  };

  // 「フィールドの設定を変更するAPI」に送るプロパティ(typeは呼び出し側で付ける)。
  // PUTは送ったプロパティだけが変わり、送らなかったものは保持されることを実機で確認済みのため、
  // 変更対象のプロパティだけを送る。
  const buildPropertyPatch = (op, value, def) => {
    const notes = [];
    switch (op) {
      case 'length':
        return {
          patch: { minLength: value.min, maxLength: value.max },
          notes,
        };
      case 'range':
        return { patch: { minValue: value.min, maxValue: value.max }, notes };
      case 'options':
        return OptionChanges.buildOptionsPatch(value, def);
      default:
        return { patch: { [op]: value }, notes };
    }
  };

  // 選択肢の変更後の値(entries)はbeforeが無いと削除を表示できないため、beforeも受け取る。
  const formatValue = (op, value, before) => {
    if (BOOLEAN_LABELS[op]) {
      return BOOLEAN_LABELS[op][String(!!value)];
    }
    switch (op) {
      case 'options':
        if (
          Array.isArray(value) &&
          value.length > 0 &&
          typeof value[0] === 'object'
        ) {
          return OptionChanges.describe(before, value);
        }
        return (value || []).join('\n');
      case 'length':
      case 'range': {
        const v = value || {};
        return `最小: ${v.min || '制限なし'} / 最大: ${v.max || '制限なし'}`;
      }
      case 'delete':
        return 'フィールドを削除';
      default:
        if (Array.isArray(value)) {
          return value.length === 0 ? '(なし)' : value.join('、');
        }
        return value === '' || value === undefined || value === null
          ? '(なし)'
          : String(value);
    }
  };

  const warningsFor = (op, value, before) => {
    switch (op) {
      case 'delete':
        return [
          'フィールドを削除すると、すべてのレコードのこのフィールドの値も削除され、元に戻せません。',
          'このフィールドを参照している計算式・一覧の条件・プロセス管理の条件・JavaScript・プラグインの設定にも影響します。',
        ];
      case 'code':
        return [
          'フィールドコードを参照しているJavaScript・プラグインの設定・外部連携などが動かなくなる場合があります。',
        ];
      case 'options': {
        // 文言は検証環境で確認した挙動に基づく(option-changes.js冒頭のコメント参照)。
        const entries = Array.isArray(value)
          ? value.filter((x) => x && typeof x === 'object')
          : [];
        const warnings = [];
        if (OptionChanges.renamed(entries).length > 0) {
          warnings.push(
            '名前を変更した選択肢は、既存レコードの値と、一覧・グラフの絞り込み条件も新しい名前に書き換わります。',
          );
        }
        if (before && OptionChanges.deletedLabels(before, entries).length > 0) {
          warnings.push(
            '削除した選択肢は、既存レコードには値として残ります(グラフでは末尾に表示され、その選択肢での絞り込み条件も残ります)。必要なら既存レコードの値を別途変更してください。また、削除した選択肢名は、あとで既存の選択肢の名前変更先には使えなくなります(kintoneの仕様)。',
          );
        }
        return warnings;
      }
      case 'required':
        return value
          ? [
              '既存のレコードで値が空のものは、次に編集して保存するときに入力が必要になります。',
            ]
          : [];
      case 'unique':
        return value
          ? ['既存のレコードに重複した値がある場合、反映に失敗します。']
          : [];
      default:
        return [];
    }
  };

  const Operations = {
    OPERATIONS,
    OPERATION_IDS,
    EXCLUDED_TYPES,
    MULTI_VALUE_TYPES,
    BOOLEAN_LABELS,
    operationName,
    applicableOperations,
    optionLabels,
    currentValue,
    normalizeInput,
    validateValue,
    buildPropertyPatch,
    formatValue,
    warningsFor,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Operations;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.Operations = Operations;
  }
})(typeof window !== 'undefined' ? window : globalThis);
