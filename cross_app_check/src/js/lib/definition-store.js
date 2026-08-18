(function (root) {
  'use strict';

  // 突合の定義(どのアプリを、どのキーで、どの条件で突き合わせるか)は
  // **レコード単位**で持つ。集計アプリの1レコード＝1つの突合定義＋その結果履歴になる。
  //
  // 保存先はレコードの`cac_definition`(文字列・複数行)フィールドにJSON文字列として入れる。
  // 対象アプリが可変長なので、フィールドを増やすよりJSON1本のほうが素直で、
  // 詳細画面のUIから丸ごと読み書きできる。
  // 利用者が直接編集する欄ではなく、プラグインの設定UIが書き込む。
  const DEFINITION_SCHEMA_VERSION = 1;

  const toStringValue = (value) =>
    value === null || value === undefined ? '' : String(value);

  const createBaseApp = () => ({
    appId: '',
    appName: '',
    keyFieldCode: '',
    keyFieldType: '',
    nameFieldCode: '',
    query: '',
    viewId: '',
    sourceUrl: '',
  });

  const createTarget = () => ({
    appId: '',
    appName: '',
    label: '',
    keyFieldCode: '',
    keyFieldType: '',
    dateFieldCode: '',
    query: '',
    viewId: '',
    sourceUrl: '',
  });

  const normalizeBaseApp = (raw) => {
    if (!raw || typeof raw !== 'object') {
      return createBaseApp();
    }
    return {
      appId: toStringValue(raw.appId).trim(),
      appName: toStringValue(raw.appName),
      keyFieldCode: toStringValue(raw.keyFieldCode),
      keyFieldType: toStringValue(raw.keyFieldType),
      nameFieldCode: toStringValue(raw.nameFieldCode),
      query: toStringValue(raw.query),
      viewId: toStringValue(raw.viewId),
      sourceUrl: toStringValue(raw.sourceUrl),
    };
  };

  const normalizeTarget = (raw) => {
    if (!raw || typeof raw !== 'object') {
      return createTarget();
    }
    return {
      appId: toStringValue(raw.appId).trim(),
      appName: toStringValue(raw.appName),
      label: toStringValue(raw.label),
      keyFieldCode: toStringValue(raw.keyFieldCode),
      keyFieldType: toStringValue(raw.keyFieldType),
      dateFieldCode: toStringValue(raw.dateFieldCode),
      query: toStringValue(raw.query),
      viewId: toStringValue(raw.viewId),
      sourceUrl: toStringValue(raw.sourceUrl),
    };
  };

  const createDefault = () => ({
    schemaVersion: DEFINITION_SCHEMA_VERSION,
    baseApp: createBaseApp(),
    targets: [createTarget()],
  });

  const normalize = (raw) => {
    if (!raw || typeof raw !== 'object') {
      return createDefault();
    }
    const targets = Array.isArray(raw.targets)
      ? raw.targets.map(normalizeTarget)
      : [];
    return {
      schemaVersion: DEFINITION_SCHEMA_VERSION,
      baseApp: normalizeBaseApp(raw.baseApp),
      targets: targets.length > 0 ? targets : [createTarget()],
    };
  };

  // レコードの`cac_definition`フィールドから復元する。
  // 未設定・壊れたJSONのときは空の定義を返し、画面が必ず開けるようにする。
  const loadFromRecord = (record, fieldCode) => {
    if (!record || !fieldCode) {
      return createDefault();
    }
    const field = record[fieldCode];
    const text = field && field.value ? String(field.value) : '';
    if (text.trim() === '') {
      return createDefault();
    }
    try {
      return normalize(JSON.parse(text));
    } catch {
      return createDefault();
    }
  };

  const serialize = (definition) => JSON.stringify(normalize(definition));

  // 「まだ何も設定されていない」かどうか。詳細画面で案内を出し分けるのに使う。
  const isEmpty = (definition) => {
    const normalized = normalize(definition);
    return (
      normalized.baseApp.appId === '' &&
      normalized.targets.every((target) => target.appId === '')
    );
  };

  const DefinitionStore = {
    DEFINITION_SCHEMA_VERSION,
    createDefault,
    createBaseApp,
    createTarget,
    normalize,
    loadFromRecord,
    serialize,
    isEmpty,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DefinitionStore;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.DefinitionStore = DefinitionStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
