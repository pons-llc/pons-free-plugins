(function (root) {
  'use strict';

  const FieldEligibility =
    typeof module !== 'undefined' && module.exports
      ? require('./field-eligibility')
      : root.BulkFieldUpdate.FieldEligibility;

  // 設定済みの初期値(targets)から、PUT /k/v1/records.jsonへ渡す1レコード分の
  // recordパッチ({フィールドコード: {value: ...}})を組み立てる純粋関数。
  // kintoneドキュメントMCP「フィールドの値を空に設定する場合」で確認した、
  // フィールド型ごとの「空」の表現に合わせて正規化する。
  //   - 日付/時刻: null
  //   - チェックボックス/複数選択: []
  //   - それ以外: ''(数値・文字列・日時・リンク等はいずれも''で空にできる)
  const normalizeValue = (fieldType, rawValue) => {
    const kind = FieldEligibility.inputKindOf(fieldType);
    if (kind === 'MULTI_CHOICE') {
      return Array.isArray(rawValue) ? rawValue : [];
    }
    if (kind === 'DATE' || kind === 'TIME') {
      return rawValue === '' || rawValue == null ? null : rawValue;
    }
    return rawValue == null ? '' : rawValue;
  };

  // targets(設定済みの対象フィールド+初期値)を、現在のフォームのフィールド定義
  // (formFieldsByCode)と突き合わせてrecordパッチを組み立てる。フォームから削除された
  // フィールドコードはpatchに含めず、skippedFieldCodesとして報告する
  // (idea.md「エッジケース: 対象フィールドが削除された場合」参照)。
  const buildPatch = (targets, formFieldsByCode) => {
    const patch = {};
    const skippedFieldCodes = [];
    (targets || []).forEach((target) => {
      const field = (formFieldsByCode || {})[target.fieldCode];
      if (!field) {
        skippedFieldCodes.push(target.fieldCode);
        return;
      }
      patch[target.fieldCode] = {
        value: normalizeValue(field.type, target.value),
      };
    });
    return { patch, skippedFieldCodes };
  };

  const RecordPatchBuilder = { normalizeValue, buildPatch };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordPatchBuilder;
  } else {
    root.BulkFieldUpdate = root.BulkFieldUpdate || {};
    root.BulkFieldUpdate.RecordPatchBuilder = RecordPatchBuilder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
