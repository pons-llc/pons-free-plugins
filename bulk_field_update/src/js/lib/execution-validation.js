(function (root) {
  'use strict';

  const FieldEligibility =
    typeof module !== 'undefined' && module.exports
      ? require('./field-eligibility')
      : root.BulkFieldUpdate.FieldEligibility;

  // 確認ダイアログで入力された値(実行のたびに都度入力する。idea.md「任意の値を都度入力する」
  // 参照)の実行前チェック。
  //   - 選択肢系フィールド(ラジオボタン・ドロップダウン)は、APIで明示的に空にする方法が無い
  //     (空文字列を指定すると初期値が設定される仕様)ため、フィールドのrequired設定に関わらず
  //     常に選択肢から値を選ばせる。
  //   - それ以外の型は、対象フィールドがkintoneのフォーム設定で必須(required)の場合のみ、
  //     値が空だとエラーにする(必須でなければ空values=対象フィールドを空にする、という
  //     正当な操作として許可する)。
  const isBlank = (value) =>
    value === '' ||
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0);

  const validateTargetValues = (targets, formFieldsByCode) => {
    const errors = [];

    (targets || []).forEach((target) => {
      const field = (formFieldsByCode || {})[target.fieldCode];
      if (!field) {
        // フォームから削除された等、実行時点でも突き合わせできないフィールドは
        // 呼び出し側(record-patch-builder.js)が別途除外するため、ここでは無視する。
        return;
      }
      const blank = isBlank(target.value);
      const kind = FieldEligibility.inputKindOf(field);

      if (kind === 'SINGLE_CHOICE' && blank) {
        errors.push(`「${field.label}」は選択肢の中から値を選択してください。`);
        return;
      }
      if (field.required && blank) {
        errors.push(
          `「${field.label}」は必須フィールドのため、値を入力してください。`,
        );
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const ExecutionValidation = { isBlank, validateTargetValues };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExecutionValidation;
  } else {
    root.BulkFieldUpdate = root.BulkFieldUpdate || {};
    root.BulkFieldUpdate.ExecutionValidation = ExecutionValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
